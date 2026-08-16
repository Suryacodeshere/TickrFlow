import prisma from '../config/db.js';
import { getLockedSeatsForEvent } from '../config/redis.js';

export async function createEvent(req, res) {
  try {
    const { title, description, date, location, rows, seatsPerRow, seatCategories } = req.body;

    if (!title || !date || !location || !rows || !seatsPerRow || !seatCategories) {
      return res.status(400).json({ error: 'Missing required event creation fields' });
    }

    // Parse seatsPerRow to integer
    const colsCount = parseInt(seatsPerRow, 10);
    if (isNaN(colsCount) || colsCount <= 0) {
      return res.status(400).json({ error: 'Invalid seats per row configuration' });
    }

    // seatCategories structure: { VIP: { rows: ['A', 'B'], price: 1500 }, General: { rows: ['C', 'D', 'E'], price: 500 } }
    // We will build a helper map to easily lookup price and category name by row letter
    const rowCategoryMap = new Map();
    for (const [categoryName, config] of Object.entries(seatCategories)) {
      const configRows = Array.isArray(config.rows) ? config.rows : [config.rows];
      for (const row of configRows) {
        rowCategoryMap.set(row.toUpperCase(), {
          name: categoryName,
          price: parseFloat(config.price) || 0
        });
      }
    }

    // Create the event in a transaction, then create seats
    const event = await prisma.$transaction(async (tx) => {
      const totalSeatsCount = rows.length * colsCount;
      
      const newEvent = await tx.event.create({
        data: {
          title,
          description: description || '',
          date: new Date(date),
          location,
          totalSeats: totalSeatsCount
        }
      });

      // Prepare seats data
      const seatsData = [];
      for (const rowLetter of rows) {
        const uRow = rowLetter.toUpperCase();
        const catInfo = rowCategoryMap.get(uRow) || { name: 'General', price: 500 }; // Fallback default

        for (let col = 1; col <= colsCount; col++) {
          seatsData.push({
            eventId: newEvent.id,
            row: uRow,
            number: col,
            category: catInfo.name,
            price: catInfo.price,
            status: 'AVAILABLE'
          });
        }
      }

      // Bulk insert seats
      await tx.seat.createMany({
        data: seatsData
      });

      return newEvent;
    });

    // Return created event with its seats
    const eventWithSeats = await prisma.event.findUnique({
      where: { id: event.id },
      include: { seats: true }
    });

    res.status(201).json(eventWithSeats);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event and seats' });
  }
}

export async function getAllEvents(req, res) {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: 'asc' }
    });
    res.json(events);
  } catch (error) {
    console.error('Get all events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}

export async function getEventDetails(req, res) {
  try {
    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        seats: {
          orderBy: [
            { row: 'asc' },
            { number: 'asc' }
          ]
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Fetch active lock states from Redis (or memory fallback)
    const lockedSeatsMap = await getLockedSeatsForEvent(eventId);

    // Merge active locks into the seats response
    const seatsWithLocks = event.seats.map(seat => {
      const lockedBy = lockedSeatsMap[seat.id] || null;
      return {
        ...seat,
        isLocked: lockedBy !== null,
        lockedBy: lockedBy
      };
    });

    res.json({
      ...event,
      seats: seatsWithLocks
    });
  } catch (error) {
    console.error('Get event details error:', error);
    res.status(500).json({ error: 'Failed to fetch event details' });
  }
}
