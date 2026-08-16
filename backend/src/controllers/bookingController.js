import crypto from 'crypto';
import Razorpay from 'razorpay';
import prisma from '../config/db.js';
import { lockSeat, unlockSeat, getSeatLockOwner } from '../config/redis.js';
import { generateQRCode } from '../utils/qrCode.js';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_placeholder';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_placeholder';

const isMockPayment = RAZORPAY_KEY_ID === 'rzp_test_placeholder';

let razorpay = null;
if (!isMockPayment) {
  try {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  } catch (err) {
    console.error('Failed to initialize Razorpay client:', err.message);
  }
}

/**
 * Helper to generate random booking reference: TF-XXXX-XXXX
 */
function generateBookingRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `TF-${part1}-${part2}`;
}

export async function lockSeatsEndpoint(req, res) {
  try {
    const { eventId, seatIds } = req.body;
    const userId = req.user.id;

    if (!eventId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'Event ID and non-empty Seat IDs array are required' });
    }

    // Verify seats exist and belong to this event, and are currently AVAILABLE
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: seatIds.map(id => parseInt(id, 10)) },
        eventId: parseInt(eventId, 10)
      }
    });

    if (seats.length !== seatIds.length) {
      return res.status(404).json({ error: 'One or more seats not found' });
    }

    // Verify database booking status
    const unavailableSeats = seats.filter(s => s.status === 'BOOKED');
    if (unavailableSeats.length > 0) {
      return res.status(409).json({ error: 'One or more seats are already booked' });
    }

    // Attempt to acquire Redis locks sequentially
    const lockedSoFar = [];
    let success = true;
    for (const seat of seats) {
      const acquired = await lockSeat(eventId, seat.id, userId, 300); // 5-minute hold
      if (acquired) {
        lockedSoFar.push(seat.id);
      } else {
        success = false;
        break;
      }
    }

    if (!success) {
      // Rollback: unlock seats locked in this request
      for (const seatId of lockedSoFar) {
        await unlockSeat(eventId, seatId, userId);
      }
      return res.status(409).json({
        error: 'One or more seats are currently held by another user. Try again.'
      });
    }

    // Broadcast live lock event via WebSockets
    const io = req.app.get('socketio');
    if (io) {
      io.to(`event:${eventId}`).emit('seats:locked', {
        seatIds: lockedSoFar,
        userId: userId
      });
    }

    res.json({
      message: 'Seats temporarily locked for 5 minutes',
      seatIds: lockedSoFar
    });
  } catch (error) {
    console.error('Lock seats endpoint error:', error);
    res.status(500).json({ error: 'Failed to reserve seats' });
  }
}

export async function unlockSeatsEndpoint(req, res) {
  try {
    const { eventId, seatIds } = req.body;
    const userId = req.user.id;

    if (!eventId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'Event ID and Seat IDs array are required' });
    }

    const unlocked = [];
    for (const seatId of seatIds) {
      const didUnlock = await unlockSeat(eventId, seatId, userId);
      if (didUnlock) {
        unlocked.push(seatId);
      }
    }

    if (unlocked.length > 0) {
      const io = req.app.get('socketio');
      if (io) {
        io.to(`event:${eventId}`).emit('seats:unlocked', {
          seatIds: unlocked
        });
      }
    }

    res.json({
      message: 'Seats unlocked successfully',
      unlockedSeatIds: unlocked
    });
  } catch (error) {
    console.error('Unlock seats endpoint error:', error);
    res.status(500).json({ error: 'Failed to release seats' });
  }
}

export async function createOrder(req, res) {
  try {
    const { eventId, seatIds } = req.body;
    const userId = req.user.id;

    if (!eventId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'Event ID and Seat IDs array are required' });
    }

    // Verify seats belong to event and are locked by this user
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: seatIds.map(id => parseInt(id, 10)) },
        eventId: parseInt(eventId, 10)
      }
    });

    if (seats.length !== seatIds.length) {
      return res.status(404).json({ error: 'One or more seats not found' });
    }

    // Check lock ownership for each seat
    for (const seat of seats) {
      const owner = await getSeatLockOwner(eventId, seat.id);
      if (owner !== String(userId)) {
        return res.status(403).json({
          error: `You do not hold the lock for seat ${seat.row}${seat.number}. It may have expired.`
        });
      }
    }

    // Calculate total price
    const totalAmount = seats.reduce((sum, seat) => sum + seat.price, 0);
    const bookingRef = generateBookingRef();

    let razorpayOrderId = `mock_order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (!isMockPayment && razorpay) {
      // Create actual Razorpay order
      const options = {
        amount: Math.round(totalAmount * 100), // Razorpay accepts paisa (amount * 100)
        currency: 'INR',
        receipt: bookingRef
      };
      const order = await razorpay.orders.create(options);
      razorpayOrderId = order.id;
    }

    // Database record in PENDING status using Prisma transaction
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          bookingRef,
          userId,
          eventId: parseInt(eventId, 10),
          totalAmount,
          status: 'PENDING',
          seats: {
            create: seats.map(s => ({
              seatId: s.id
            }))
          }
        }
      });

      await tx.payment.create({
        data: {
          bookingId: newBooking.id,
          razorpayOrderId,
          amount: totalAmount,
          status: 'PENDING'
        }
      });

      return newBooking;
    });

    res.status(201).json({
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      razorpayOrderId,
      amount: totalAmount,
      currency: 'INR',
      keyId: isMockPayment ? 'mock' : RAZORPAY_KEY_ID,
      isMock: isMockPayment
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to initiate checkout process' });
  }
}

/**
 * Shared logic to finalize a booking upon payment success
 */
async function finalizeBooking(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  // Find pending payment
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId },
    include: {
      booking: {
        include: {
          seats: {
            include: { seat: true }
          },
          user: true
        }
      }
    }
  });

  if (!payment) {
    throw new Error('Payment record not found for Order ID: ' + razorpayOrderId);
  }

  if (payment.status === 'SUCCESS') {
    return payment.booking; // Already processed
  }

  const booking = payment.booking;
  const seatIds = booking.seats.map(bs => bs.seatId);
  const eventId = booking.eventId;

  // Final confirmation transaction
  const updatedBooking = await prisma.$transaction(async (tx) => {
    // Double check seat booking status in Postgres
    const checkSeats = await tx.seat.findMany({
      where: { id: { in: seatIds } },
      select: { id: true, status: true, row: true, number: true }
    });

    const alreadyBooked = checkSeats.filter(s => s.status === 'BOOKED');
    if (alreadyBooked.length > 0) {
      throw new Error(`Seats ${alreadyBooked.map(s => `${s.row}${s.number}`).join(', ')} already booked`);
    }

    // 1. Update seats status to BOOKED
    await tx.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: 'BOOKED' }
    });

    // 2. Generate QR Code containing Ticket details
    const ticketData = JSON.stringify({
      ref: booking.bookingRef,
      event: eventId,
      user: booking.userId,
      seats: checkSeats.map(s => `${s.row}${s.number}`).join(','),
      amount: booking.totalAmount
    });
    const qrCodeDataUrl = await generateQRCode(ticketData);

    // 3. Confirm the Booking
    const confBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CONFIRMED',
        qrCode: qrCodeDataUrl
      }
    });

    // 4. Update the Payment
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId,
        razorpaySignature
      }
    });

    return confBooking;
  });

  // 5. Clean up Redis Locks
  for (const seatId of seatIds) {
    // Explicit unlock to clear key
    await unlockSeat(eventId, seatId, booking.userId);
  }

  return updatedBooking;
}

/**
 * Verify & confirm payment via direct API call (Client-side success callback fallback or testing)
 */
export async function verifyPaymentEndpoint(req, res) {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return res.status(400).json({ error: 'Missing payment confirmation parameters' });
    }

    // Verify signature if not in mock mode
    if (!isMockPayment) {
      if (!razorpaySignature) {
        return res.status(400).json({ error: 'Missing razorpay signature' });
      }
      
      const text = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(text)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        return res.status(400).json({ error: 'Invalid payment signature verification failed' });
      }
    }

    // Finalize the booking in database
    const confirmedBooking = await finalizeBooking(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature || 'mock_signature'
    );

    // Broadcast booking update to all sockets in room
    const io = req.app.get('socketio');
    if (io) {
      const seatIds = confirmedBooking.seats ? confirmedBooking.seats.map(bs => bs.seatId) : [];
      // If we don't have seats in confirmedBooking, we fetch them
      const bookingSeats = await prisma.bookingSeat.findMany({
        where: { bookingId: confirmedBooking.id }
      });
      const ids = bookingSeats.map(bs => bs.seatId);

      io.to(`event:${confirmedBooking.eventId}`).emit('seats:booked', {
        seatIds: ids
      });
    }

    res.json({
      message: 'Payment verified and booking confirmed',
      booking: {
        id: confirmedBooking.id,
        bookingRef: confirmedBooking.bookingRef,
        qrCode: confirmedBooking.qrCode,
        status: confirmedBooking.status
      }
    });
  } catch (error) {
    console.error('Verify payment endpoint error:', error);
    res.status(500).json({ error: error.message || 'Payment confirmation failed' });
  }
}

/**
 * Handle Webhook sent by Razorpay asynchronously
 */
export async function razorpayWebhook(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).send('Webhook signature required');
    }

    // Validate Signature
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('⚠️ Webhook Signature verification failed');
      return res.status(400).send('Invalid webhook signature');
    }

    const event = req.body.event;
    console.log(`📡 Razorpay Webhook Event Received: ${event}`);

    // Handle payment capture / order paid events
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = req.body.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;
      const razorpaySignature = signature; // Use webhook signature as proof

      // Process finalizing booking
      const confirmedBooking = await finalizeBooking(razorpayOrderId, razorpayPaymentId, razorpaySignature);

      // Broadcast booked seats status
      const io = req.app.get('socketio');
      if (io) {
        const bookingSeats = await prisma.bookingSeat.findMany({
          where: { bookingId: confirmedBooking.id }
        });
        const ids = bookingSeats.map(bs => bs.seatId);

        io.to(`event:${confirmedBooking.eventId}`).emit('seats:booked', {
          seatIds: ids
        });
      }
      
      console.log(`✅ Webhook confirmed booking ID ${confirmedBooking.id} (Ref: ${confirmedBooking.bookingRef})`);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Razorpay Webhook processing error:', error);
    // Return 500 so Razorpay retries if it was an internal DB error, but 200 for business validation failures
    res.status(500).send('Webhook processing failed');
  }
}

/**
 * Fetch attendee bookings
 */
export async function getUserBookings(req, res) {
  try {
    const userId = req.user.id;
    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: {
        event: {
          select: { title: true, date: true, location: true }
        },
        seats: {
          include: {
            seat: {
              select: { row: true, number: true, category: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(bookings);
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
}
