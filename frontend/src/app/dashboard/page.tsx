'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Ticket, Plus, Calendar, MapPin, DollarSign, Users, Award, 
  ChevronRight, ArrowLeft, BarChart2, ShieldCheck, X
} from 'lucide-react';

interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  location: string;
  totalSeats: number;
  seats?: Array<{ status: string; price: number }>;
}

export default function DashboardPage() {
  const { user, loading, getAuthHeaders } = useAuth();
  const router = useRouter();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState('');
  
  // Create event form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [rows, setRows] = useState('A,B,C,D');
  const [seatsPerRow, setSeatsPerRow] = useState('8');
  
  // Custom categories state
  const [cat1Name, setCat1Name] = useState('VIP');
  const [cat1Rows, setCat1Rows] = useState('A,B');
  const [cat1Price, setCat1Price] = useState('1500');
  
  const [cat2Name, setCat2Name] = useState('General');
  const [cat2Rows, setCat2Rows] = useState('C,D');
  const [cat2Price, setCat2Price] = useState('800');

  const [submitting, setSubmitting] = useState(false);
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // Protect route
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'ORGANIZER') {
        router.push('/');
      }
    }
  }, [user, loading, router]);

  // Fetch organizer events and details
  const fetchOrganizerData = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/events`);
      if (response.ok) {
        const eventsData = await response.json();
        
        // Fetch seats details for each event to calculate bookings stats
        const enrichedEvents = await Promise.all(
          eventsData.map(async (ev: Event) => {
            try {
              const res = await fetch(`${backendUrl}/api/events/${ev.id}`);
              if (res.ok) {
                const detailed = await res.json();
                return {
                  ...ev,
                  seats: detailed.seats
                };
              }
            } catch (err) {
              console.error(err);
            }
            return ev;
          })
        );
        setEvents(enrichedEvents);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError('Could not connect to backend server');
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'ORGANIZER') {
      fetchOrganizerData();
    }
  }, [user]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const parsedRows = rows.split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
    const parsedSeatsPerRow = parseInt(seatsPerRow, 10);

    if (parsedRows.length === 0 || isNaN(parsedSeatsPerRow) || parsedSeatsPerRow <= 0) {
      setError('Invalid rows or seats per row configuration');
      setSubmitting(false);
      return;
    }

    // Structure categories
    const seatCategories = {
      [cat1Name]: {
        rows: cat1Rows.split(',').map(r => r.trim().toUpperCase()).filter(Boolean),
        price: parseFloat(cat1Price) || 0
      },
      [cat2Name]: {
        rows: cat2Rows.split(',').map(r => r.trim().toUpperCase()).filter(Boolean),
        price: parseFloat(cat2Price) || 0
      }
    };

    try {
      const response = await fetch(`${backendUrl}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          title,
          description,
          date,
          location,
          rows: parsedRows,
          seatsPerRow: parsedSeatsPerRow,
          seatCategories
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create event');
      }

      // Success
      setShowCreateModal(false);
      // Reset fields
      setTitle('');
      setDescription('');
      setDate('');
      setLocation('');
      
      // Refresh list
      fetchOrganizerData();
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user || user.role !== 'ORGANIZER') {
    return (
      <div className="flex items-center justify-center min-h-screen h-screen">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Calculate high-level metrics
  let totalRevenue = 0;
  let totalTicketsSold = 0;
  let totalCapacity = 0;

  events.forEach(ev => {
    if (ev.seats) {
      const bookedSeats = ev.seats.filter(s => s.status === 'BOOKED');
      totalTicketsSold += bookedSeats.length;
      totalRevenue += bookedSeats.reduce((sum, s) => sum + s.price, 0);
      totalCapacity += ev.seats.length;
    } else {
      totalCapacity += ev.totalSeats;
    }
  });

  const overallOccupancy = totalCapacity > 0 ? Math.round((totalTicketsSold / totalCapacity) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-2xl tracking-tight text-white hover:opacity-90">
            <Ticket className="h-6 w-6 text-indigo-500" />
            <span className="bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent">TickrFlow</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Organizer Panel
            </span>
            <Link href="/" className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Public Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/5 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Organizer Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">Manage events, layouts, and monitor ticketing queues in real-time.</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Event Layout
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3 rounded-xl mb-8">
            {error}
          </div>
        )}

        {/* Analytics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Card 1 */}
          <div className="glass-panel p-6 rounded-3xl border border-white/5">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Sales</span>
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-white mt-4">₹{totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">Confirmed payments</p>
          </div>
          {/* Card 2 */}
          <div className="glass-panel p-6 rounded-3xl border border-white/5">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Tickets Booked</span>
              <Ticket className="h-5 w-5 text-indigo-400" />
            </div>
            <p className="text-3xl font-black text-white mt-4">{totalTicketsSold}</p>
            <p className="text-xs text-slate-500 mt-1">Seats occupied</p>
          </div>
          {/* Card 3 */}
          <div className="glass-panel p-6 rounded-3xl border border-white/5">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Grid Capacity</span>
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-3xl font-black text-white mt-4">{totalCapacity}</p>
            <p className="text-xs text-slate-500 mt-1">Total seats mapped</p>
          </div>
          {/* Card 4 */}
          <div className="glass-panel p-6 rounded-3xl border border-white/5">
            <div className="flex justify-between items-start text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Avg Occupancy</span>
              <BarChart2 className="h-5 w-5 text-indigo-400" />
            </div>
            <p className="text-3xl font-black text-white mt-4">{overallOccupancy}%</p>
            {/* Custom mini bar chart */}
            <div className="w-full bg-slate-900 rounded-full h-1.5 mt-3 border border-white/5">
              <div 
                className="bg-indigo-500 h-1.5 rounded-full" 
                style={{ width: `${overallOccupancy}%` }}
              ></div>
            </div>
          </div>
        </section>

        {/* Managed Events List */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-white">Event Inventories</h2>
          
          {loadingEvents ? (
            <div className="space-y-4">
              {[1, 2].map(n => (
                <div key={n} className="h-24 bg-slate-900/40 rounded-2xl border border-white/5 animate-pulse"></div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 glass-panel border border-white/5 rounded-3xl">
              <p className="text-slate-500 text-sm">No events generated yet. Click New Event to start.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => {
                const booked = event.seats ? event.seats.filter(s => s.status === 'BOOKED').length : 0;
                const total = event.seats ? event.seats.length : event.totalSeats;
                const percent = total > 0 ? Math.round((booked / total) * 100) : 0;
                const revenue = event.seats ? event.seats.filter(s => s.status === 'BOOKED').reduce((sum, s) => sum + s.price, 0) : 0;

                return (
                  <div key={event.id} className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-white/10 transition-colors">
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-white">{event.title}</h3>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                          {event.location}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-8 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Occupancy</p>
                        <p className="font-bold text-white mt-0.5">{booked} / {total} seats ({percent}%)</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Revenue</p>
                        <p className="font-bold text-emerald-400 mt-0.5">₹{revenue.toLocaleString()}</p>
                      </div>
                      
                      <Link 
                        href={`/events/${event.id}`}
                        className="flex items-center gap-1 py-2 px-3 rounded-lg border border-white/10 bg-slate-900/50 hover:bg-slate-900 hover:text-indigo-400 text-xs text-white transition-all"
                      >
                        Seat Map
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Creation Modal Overlay */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl glass-panel border border-white/10 rounded-3xl p-6 md:p-8 relative my-8">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-lg cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-2xl font-bold text-white mb-6">Create Custom Event Layout</h3>

            <form onSubmit={handleCreateEvent} className="space-y-5 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Event Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Coldplay Live in Mumbai"
                    className="w-full px-3 py-2.5 border border-white/10 bg-slate-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-white/10 bg-slate-900/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Venue Location</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. D.Y. Patil Stadium, Mumbai"
                  className="w-full px-3 py-2.5 border border-white/10 bg-slate-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details of performance, entry terms, etc."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-white/10 bg-slate-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Rows (Comma separated letters)</label>
                  <input
                    type="text"
                    required
                    value={rows}
                    onChange={(e) => setRows(e.target.value)}
                    placeholder="A,B,C,D"
                    className="w-full px-3 py-2.5 border border-white/10 bg-slate-900/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Seats per Row</label>
                  <input
                    type="number"
                    required
                    value={seatsPerRow}
                    onChange={(e) => setSeatsPerRow(e.target.value)}
                    placeholder="8"
                    min="1"
                    className="w-full px-3 py-2.5 border border-white/10 bg-slate-900/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Dynamic Seat Categories Setup */}
              <div className="space-y-3 pt-3 border-t border-white/5">
                <span className="text-xs font-extrabold uppercase text-indigo-400 tracking-wider">Category Configurations</span>
                
                {/* Category 1 (VIP) */}
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Category 1 Name</label>
                    <input
                      type="text"
                      value={cat1Name}
                      onChange={(e) => setCat1Name(e.target.value)}
                      className="w-full px-2 py-1.5 border border-white/5 bg-slate-900/40 rounded-lg text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Applied Rows</label>
                    <input
                      type="text"
                      value={cat1Rows}
                      onChange={(e) => setCat1Rows(e.target.value)}
                      className="w-full px-2 py-1.5 border border-white/5 bg-slate-900/40 rounded-lg text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Price (₹)</label>
                    <input
                      type="number"
                      value={cat1Price}
                      onChange={(e) => setCat1Price(e.target.value)}
                      className="w-full px-2 py-1.5 border border-white/5 bg-slate-900/40 rounded-lg text-white"
                    />
                  </div>
                </div>

                {/* Category 2 (General) */}
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Category 2 Name</label>
                    <input
                      type="text"
                      value={cat2Name}
                      onChange={(e) => setCat2Name(e.target.value)}
                      className="w-full px-2 py-1.5 border border-white/5 bg-slate-900/40 rounded-lg text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Applied Rows</label>
                    <input
                      type="text"
                      value={cat2Rows}
                      onChange={(e) => setCat2Rows(e.target.value)}
                      className="w-full px-2 py-1.5 border border-white/5 bg-slate-900/40 rounded-lg text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Price (₹)</label>
                    <input
                      type="number"
                      value={cat2Price}
                      onChange={(e) => setCat2Price(e.target.value)}
                      className="w-full px-2 py-1.5 border border-white/5 bg-slate-900/40 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg hover:shadow-indigo-500/20 cursor-pointer flex items-center justify-center"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Generate Seat Grid'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950 py-8 text-center text-xs text-slate-500 mt-12">
        <p>&copy; {new Date().getFullYear()} TickrFlow. Organizer Dashboard console.</p>
      </footer>
    </div>
  );
}
