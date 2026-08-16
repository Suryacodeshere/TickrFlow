'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Link from 'next/link';
import { ArrowLeft, Calendar, MapPin, ShieldAlert, Timer, CheckCircle, XCircle } from 'lucide-react';

interface Seat {
  id: number;
  row: string;
  number: number;
  category: string;
  price: number;
  status: 'AVAILABLE' | 'BOOKED';
  isLocked: boolean;
  lockedBy: string | null;
}

interface EventData {
  id: number;
  title: string;
  description: string;
  date: string;
  location: string;
  seats: Seat[];
}

export default function EventBookingPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, getAuthHeaders } = useAuth();
  const { socket, joinEvent, leaveEvent } = useSocket();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selection and locking states
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [lockedSeatIds, setLockedSeatIds] = useState<number[]>([]); // Current user's acquired locks
  const [isLocked, setIsLocked] = useState(false); // Whether current user holds active locks
  
  // Checkout states
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [timerActive, setTimerActive] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Mock Payment Modal state
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockOrderDetails, setMockOrderDetails] = useState<any>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // 1. Fetch event detail on load
  const fetchEventDetails = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/events/${id}`);
      if (!response.ok) {
        throw new Error('Event not found');
      }
      const data = await response.json();
      setEvent(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventDetails();
    joinEvent(String(id));

    return () => {
      leaveEvent(String(id));
      // Release locks if page is closed
      handleReleaseLocksDirect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  // Direct cleanup helper for page closes / triggers
  const handleReleaseLocksDirect = async () => {
    if (lockedSeatIds.length === 0) return;
    try {
      await fetch(`${backendUrl}/api/bookings/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ eventId: id, seatIds: lockedSeatIds })
      });
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Setup WebSocket Live Synchronization
  useEffect(() => {
    if (!socket) return;

    // Listen for seat locks by other users
    socket.on('seats:locked', ({ seatIds, userId: lockerId }: { seatIds: number[]; userId: number }) => {
      if (Number(lockerId) === user?.id) return; // Ignore our own locks handled via REST
      setEvent(prev => {
        if (!prev) return null;
        return {
          ...prev,
          seats: prev.seats.map(seat => {
            if (seatIds.includes(seat.id)) {
              return { ...seat, isLocked: true, lockedBy: String(lockerId) };
            }
            return seat;
          })
        };
      });
    });

    // Listen for seat unlocks
    socket.on('seats:unlocked', ({ seatIds }: { seatIds: number[] }) => {
      setEvent(prev => {
        if (!prev) return null;
        return {
          ...prev,
          seats: prev.seats.map(seat => {
            if (seatIds.includes(seat.id)) {
              return { ...seat, isLocked: false, lockedBy: null };
            }
            return seat;
          })
        };
      });
    });

    // Listen for finalized seat bookings
    socket.on('seats:booked', ({ seatIds }: { seatIds: number[] }) => {
      // If we are looking at this, clear selected or current user locks
      setSelectedSeatIds(prev => prev.filter(sid => !seatIds.includes(sid)));
      setLockedSeatIds(prev => {
        const remaining = prev.filter(sid => !seatIds.includes(sid));
        if (remaining.length === 0) {
          setTimerActive(false);
          setIsLocked(false);
        }
        return remaining;
      });

      setEvent(prev => {
        if (!prev) return null;
        return {
          ...prev,
          seats: prev.seats.map(seat => {
            if (seatIds.includes(seat.id)) {
              return { ...seat, status: 'BOOKED', isLocked: false, lockedBy: null };
            }
            return seat;
          })
        };
      });
    });

    return () => {
      socket.off('seats:locked');
      socket.off('seats:unlocked');
      socket.off('seats:booked');
    };
  }, [socket, user]);

  // 3. 5-Minute Lock Expiry Countdown Timer
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Lock expired! Reset state
            setIsLocked(false);
            setLockedSeatIds([]);
            setSelectedSeatIds([]);
            setTimerActive(false);
            setError('Your 5-minute seat reservation expired. Please select seats again.');
            fetchEventDetails(); // Reload event seats
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timeLeft]);

  // Format countdown text MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle seat selection (only if available and not locked)
  const toggleSeatSelection = (seat: Seat) => {
    if (isLocked) return; // Cannot change selection while payment is pending
    if (seat.status === 'BOOKED' || (seat.isLocked && seat.lockedBy !== String(user?.id))) return;

    setSelectedSeatIds(prev => 
      prev.includes(seat.id) ? prev.filter(id => id !== seat.id) : [...prev, seat.id]
    );
  };

  // Request Redis TTL Lock
  const handleAcquireLocks = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (selectedSeatIds.length === 0) return;
    setError('');

    try {
      const response = await fetch(`${backendUrl}/api/bookings/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ eventId: id, seatIds: selectedSeatIds })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to lock seats');
      }

      setLockedSeatIds(selectedSeatIds);
      setIsLocked(true);
      setTimeLeft(300); // 5 minutes
      setTimerActive(true);
    } catch (err: any) {
      setError(err.message || 'Seat lock acquisition failed. The seat might have just been selected by another user.');
      fetchEventDetails(); // Refresh grid state
    }
  };

  // Release Holds manually
  const handleReleaseLocks = async () => {
    if (lockedSeatIds.length === 0) return;
    setError('');

    try {
      const response = await fetch(`${backendUrl}/api/bookings/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ eventId: id, seatIds: lockedSeatIds })
      });

      if (!response.ok) {
        throw new Error('Failed to unlock seats');
      }

      setLockedSeatIds([]);
      setSelectedSeatIds([]);
      setIsLocked(false);
      setTimerActive(false);
      setTimeLeft(0);
    } catch (err: any) {
      setError(err.message || 'Failed to release reservation');
    }
  };

  // Initiate Razorpay Checkout Order creation
  const handleCheckout = async () => {
    setPaymentLoading(true);
    setError('');

    try {
      const response = await fetch(`${backendUrl}/api/bookings/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ eventId: id, seatIds: lockedSeatIds })
      });

      const orderData = await response.json();
      if (!response.ok) {
        throw new Error(orderData.error || 'Order creation failed');
      }

      // Check if it is running in Mock Mode
      if (orderData.isMock) {
        setMockOrderDetails(orderData);
        setShowMockModal(true);
        setPaymentLoading(false);
        return;
      }

      // Trigger standard Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: Math.round(orderData.amount * 100),
        currency: orderData.currency,
        name: 'TickrFlow Tickets',
        description: `Order Ref: ${orderData.bookingRef}`,
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: user?.name,
          email: user?.email
        },
        theme: {
          color: '#6366f1' // Indigo-500
        },
        handler: async function (res: any) {
          await verifyPayment(
            res.razorpay_order_id,
            res.razorpay_payment_id,
            res.razorpay_signature
          );
        },
        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err.message || 'Checkout failed. The reservation may have expired.');
      setPaymentLoading(false);
    }
  };

  // Call API to verify payment
  const verifyPayment = async (orderId: string, paymentId: string, signature: string) => {
    setPaymentLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/bookings/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Payment signature verification failed');
      }

      // Successful transaction
      setPaymentSuccess(true);
      setTimerActive(false);
      setIsLocked(false);
      setLockedSeatIds([]);
      setSelectedSeatIds([]);
      
      // Redirect to home dashboard after delay
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Contact support.');
    } finally {
      setPaymentLoading(false);
      setShowMockModal(false);
    }
  };

  const handleMockPaymentSuccess = async () => {
    if (!mockOrderDetails) return;
    const mockPaymentId = `pay_mock_${Date.now()}`;
    const mockSignature = `sig_mock_${Date.now()}`;
    await verifyPayment(mockOrderDetails.razorpayOrderId, mockPaymentId, mockSignature);
  };

  const handleMockPaymentCancel = () => {
    setShowMockModal(false);
    setPaymentLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen h-screen">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <ShieldAlert className="h-16 w-16 text-rose-500" />
        <h3 className="text-2xl font-bold text-white">Oops! Something went wrong</h3>
        <p className="text-slate-400 max-w-sm">{error}</p>
        <Link href="/" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all">
          Back to Events
        </Link>
      </div>
    );
  }

  if (!event) return null;

  // Calculate prices
  const selectedSeats = event.seats.filter(s => selectedSeatIds.includes(s.id));
  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="min-h-screen flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      {/* Header Info */}
      <div className="max-w-7xl mx-auto w-full mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold mb-6 transition-all">
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </Link>

        {error && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div>
            <h1 className="text-3xl font-extrabold text-white">{event.title}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-400">
              <span className="flex items-center gap-1.5 shrink-0">
                <Calendar className="h-4 w-4 text-indigo-400" />
                {new Date(event.date).toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <MapPin className="h-4 w-4 text-indigo-400" />
                {event.location}
              </span>
            </div>
          </div>

          {/* Seat Legend */}
          <div className="flex flex-wrap gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-slate-800 border border-white/10 rounded-md"></span>
              <span className="text-slate-400">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-indigo-600 rounded-md shadow-lg shadow-indigo-500/20"></span>
              <span className="text-slate-400">Selected</span>
            </div>
            <div className="flex items-center gap-1.5 animate-pulse">
              <span className="w-4 h-4 bg-amber-500 rounded-md shadow-lg shadow-amber-500/20"></span>
              <span className="text-slate-400">Locked (Other User)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 bg-rose-950/40 border border-rose-900/30 text-rose-500 rounded-md flex items-center justify-center font-bold text-[8px]">X</span>
              <span className="text-slate-400">Booked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Seat Grid Container */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8 flex-grow">
        {/* Visual Seat Map */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Stage Area */}
          <div className="w-full max-w-md text-center py-4 border-b border-indigo-500/20 relative mb-16">
            <div className="absolute top-0 left-0 w-full h-8 stage-glow pointer-events-none"></div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-300">STAGE</span>
          </div>

          {/* Seat Grid Layout */}
          <div className="space-y-4 w-full flex flex-col items-center overflow-x-auto pb-4">
            {/* Extract rows */}
            {Array.from(new Set(event.seats.map(s => s.row))).sort().map((rowName) => {
              const rowSeats = event.seats.filter(s => s.row === rowName).sort((a,b) => a.number - b.number);
              return (
                <div key={rowName} className="flex items-center gap-3 shrink-0">
                  {/* Row Letter */}
                  <span className="w-6 text-sm font-bold text-slate-500 text-center">{rowName}</span>
                  
                  {/* Row Seats */}
                  <div className="flex gap-2">
                    {rowSeats.map((seat) => {
                      const isSelected = selectedSeatIds.includes(seat.id);
                      const isOtherLocked = seat.isLocked && seat.lockedBy !== String(user?.id);
                      const isBooked = seat.status === 'BOOKED';
                      
                      let seatColorClass = 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-white/5';
                      
                      if (isBooked) {
                        seatColorClass = 'bg-rose-950/20 border border-rose-900/30 text-rose-500 cursor-not-allowed';
                      } else if (isOtherLocked) {
                        seatColorClass = 'bg-amber-500/90 text-slate-900 seat-locked-anim cursor-not-allowed border border-transparent';
                      } else if (isSelected) {
                        seatColorClass = 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 border border-transparent scale-105';
                      }

                      return (
                        <button
                          key={seat.id}
                          disabled={isBooked || isOtherLocked || isLocked}
                          onClick={() => toggleSeatSelection(seat)}
                          className={`w-9 h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${seatColorClass}`}
                          title={`${seat.category} Row ${seat.row} Seat ${seat.number} - ₹${seat.price}`}
                        >
                          {isBooked ? 'x' : seat.number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-xs text-slate-500 text-center">
            Click available seat numbers to select. Click lock once selections are finished.
          </div>
        </div>

        {/* Action Panel Sidebar */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between h-fit relative">
          <div>
            <h3 className="text-lg font-bold text-white pb-4 border-b border-white/5">Order Summary</h3>
            
            {/* Timer Overlay */}
            {timerActive && (
              <div className="mt-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-amber-400 animate-spin" />
                  <span className="text-xs font-semibold">Payment Window Open</span>
                </div>
                <span className="text-lg font-bold tracking-wider">{formatTimer(timeLeft)}</span>
              </div>
            )}

            {/* Selected Seats Details */}
            <div className="mt-6 space-y-4">
              {selectedSeats.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No seats selected. Choose seats from the layout map.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Selections</p>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {selectedSeats.map(s => (
                      <div key={s.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-white/5 text-sm">
                        <div>
                          <p className="font-bold text-white">Seat {s.row}{s.number}</p>
                          <p className="text-xs text-slate-500">{s.category}</p>
                        </div>
                        <span className="font-semibold text-indigo-400">₹{s.price}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-white/5">
                    <span className="text-sm text-slate-400 font-medium">Total Amount</span>
                    <span className="text-xl font-bold text-white">₹{totalPrice}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {!isLocked ? (
              <button
                disabled={selectedSeatIds.length === 0}
                onClick={handleAcquireLocks}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 disabled:border-white/5 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-lg hover:shadow-indigo-500/20 cursor-pointer text-center"
              >
                Reserve Selected Seats
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  disabled={paymentLoading || paymentSuccess}
                  onClick={handleCheckout}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-98 cursor-pointer flex items-center justify-center"
                >
                  {paymentLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Proceed to Payment'
                  )}
                </button>
                <button
                  disabled={paymentLoading || paymentSuccess}
                  onClick={handleReleaseLocks}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-white font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancel Hold / Release Seats
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simulated Payment Modal Overlay */}
      {showMockModal && mockOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel border border-white/15 rounded-3xl p-6 text-center space-y-6 relative overflow-hidden">
            {/* Pulsing glow background */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto mb-2">
              <Timer className="h-6 w-6 animate-pulse" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Razorpay Payment Simulator</h3>
              <p className="text-xs text-slate-400 mt-1">Mock checkout integration for local testing</p>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-4 border border-white/5 space-y-2 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="font-mono text-xs text-white truncate max-w-[200px]">{mockOrderDetails.razorpayOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Booking Ref:</span>
                <span className="font-semibold text-white">{mockOrderDetails.bookingRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Due:</span>
                <span className="font-bold text-indigo-400">₹{mockOrderDetails.amount}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleMockPaymentSuccess}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-md cursor-pointer"
              >
                Simulate Success
              </button>
              <button
                onClick={handleMockPaymentCancel}
                className="py-3 px-4 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white font-semibold text-sm transition-all cursor-pointer"
              >
                Cancel Checkout
              </button>
            </div>
            
            <p className="text-[10px] text-slate-500 leading-relaxed">
              *Confirming successful mock payment will invoke the verification API endpoint directly and secure the seats in PostgreSQL.
            </p>
          </div>
        </div>
      )}

      {/* Payment Success Overlay */}
      {paymentSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm glass-panel border border-emerald-500/30 rounded-3xl p-8 text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto animate-bounce">
              <CheckCircle className="h-10 w-10" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-white">Booking Confirmed!</h3>
              <p className="text-sm text-slate-400 mt-2">
                Your payment was received successfully. We are generating your entry passes now.
              </p>
            </div>
            
            <p className="text-xs text-indigo-400 animate-pulse font-medium">
              Redirecting you to ticket wallet...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
