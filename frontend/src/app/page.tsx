'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Calendar, MapPin, Ticket, LogIn, LogOut, ArrowRight, ClipboardList, Eye } from 'lucide-react';

interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  location: string;
  totalSeats: number;
}

interface Booking {
  id: number;
  bookingRef: string;
  totalAmount: number;
  status: string;
  qrCode: string | null;
  createdAt: string;
  event: {
    title: string;
    date: string;
    location: string;
  };
  seats: Array<{
    seat: {
      row: string;
      number: number;
      category: string;
    };
  }>;
}

export default function LandingPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState<string | null>(null);

  const { user, logout, getAuthHeaders } = useAuth();
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    // Fetch Events
    const fetchEvents = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/events`);
        if (response.ok) {
          const data = await response.json();
          setEvents(data);
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
  }, [backendUrl]);

  // Fetch bookings if user is attendee
  const fetchMyBookings = async () => {
    if (!user || user.role !== 'ATTENDEE') return;
    setLoadingBookings(true);
    try {
      const response = await fetch(`${backendUrl}/api/bookings/my-bookings`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'ATTENDEE') {
      fetchMyBookings();
    }
  }, [user]);

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-2xl tracking-tight text-white hover:opacity-90 transition-all">
            <Ticket className="h-6 w-6 text-indigo-500 animate-pulse" />
            <span className="bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent">TickrFlow</span>
          </Link>
          
          <nav className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-indigo-400 capitalize">{user.role.toLowerCase()}</p>
                </div>
                
                {user.role === 'ORGANIZER' && (
                  <Link href="/dashboard" className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-all">
                    Dashboard
                  </Link>
                )}

                {user.role === 'ATTENDEE' && (
                  <button 
                    onClick={() => { setShowBookingsModal(true); fetchMyBookings(); }}
                    className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-white/10 bg-slate-900/50 hover:bg-slate-900/80 text-white transition-all cursor-pointer"
                  >
                    <ClipboardList className="h-4 w-4" />
                    My Tickets
                  </button>
                )}

                <button 
                  onClick={logout} 
                  className="p-2 sm:px-4 sm:py-2 text-xs sm:text-sm text-rose-400 border border-rose-500/20 hover:bg-rose-500/10 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <Link href="/login" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Hero Banner */}
        <section className="text-center py-16 sm:py-20 relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/30 backdrop-blur-sm p-6 sm:p-12 mb-16">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-72 h-72 bg-rose-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-6 inline-block">
            ⚡ Redis Concurrency Protection Enabled
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-500 bg-clip-text text-transparent leading-tight max-w-4xl mx-auto">
            Book Your Seats Instantly, Without Double-Bookings
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto">
            Experience ultra-fast ticket selection. Select a seat to reserve it instantly. Lock expires automatically in 5 minutes if payment is not completed.
          </p>
          <div className="mt-10 flex justify-center">
            <a href="#events" className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/30">
              Explore Active Events
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </section>

        {/* Events Section */}
        <section id="events" className="space-y-8 scroll-mt-24">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Featured Concerts & Events</h2>
            <p className="text-sm text-slate-400 mt-1">Real-time seat state changes sync live with all users on the map</p>
          </div>

          {loadingEvents ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-80 bg-slate-900/40 rounded-3xl animate-pulse border border-white/5"></div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 glass-panel rounded-3xl border border-white/5">
              <Ticket className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No events currently scheduled. Check back soon!</p>
              {user?.role === 'ORGANIZER' && (
                <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm mt-2 block">
                  Create an Event in Dashboard &rarr;
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {events.map((event) => (
                <div key={event.id} className="glass-card flex flex-col justify-between p-6 rounded-3xl group">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {event.title}
                    </h3>
                    <p className="text-sm text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span>{formatDate(event.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <MapPin className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Link 
                      href={`/events/${event.id}`}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 border border-white/10 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10 text-white font-semibold text-sm transition-all"
                    >
                      Book Tickets
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/5 bg-slate-950 py-8 text-center text-xs sm:text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} TickrFlow. All rights reserved.</p>
      </footer>

      {/* Tickets Drawer / Modal */}
      {showBookingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl glass-panel border border-white/10 rounded-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">Your Confirmed Tickets</h3>
                <p className="text-xs text-slate-400 mt-0.5">Show QR codes at the gate to gain entry</p>
              </div>
              <button 
                onClick={() => { setShowBookingsModal(false); setSelectedQR(null); }}
                className="text-slate-400 hover:text-white text-sm font-semibold p-1 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex-grow overflow-y-auto py-6 space-y-4 pr-1">
              {loadingBookings ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12">
                  <Ticket className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No tickets purchased yet.</p>
                </div>
              ) : (
                bookings.map((booking) => (
                  <div key={booking.id} className="border border-white/5 bg-slate-900/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        {booking.status}
                      </span>
                      <h4 className="text-md font-bold text-white pt-1">{booking.event.title}</h4>
                      <p className="text-xs text-slate-400">{formatDate(booking.event.date)}</p>
                      <p className="text-xs text-slate-400">{booking.event.location}</p>
                      <div className="pt-2 text-xs font-semibold text-indigo-400">
                        Seat(s): {booking.seats.map(bs => `${bs.seat.row}${bs.seat.number}`).join(', ')} ({booking.seats[0]?.seat.category})
                      </div>
                      <p className="text-xs text-slate-500 pt-1">Booking Ref: {booking.bookingRef}</p>
                    </div>

                    <div className="flex flex-col items-center justify-center shrink-0 w-full md:w-auto">
                      {booking.qrCode ? (
                        <div className="flex flex-col items-center gap-2">
                          <button
                            onClick={() => setSelectedQR(booking.qrCode)}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold py-1.5 px-3 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/15 transition-all cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View QR Ticket
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">QR Code Unavailable</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Viewer Modal */}
      {selectedQR && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-sm glass-panel border border-white/15 rounded-3xl p-6 text-center space-y-6">
            <h3 className="text-lg font-bold text-white">Scan Entry Pass</h3>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl">
              <img src={selectedQR} alt="Ticket QR Code" className="w-48 h-48 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">
              Keep this QR code ready at the venue entrance. Safe travels!
            </p>
            <button
              onClick={() => setSelectedQR(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all cursor-pointer"
            >
              Close ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
