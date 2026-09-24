import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, CalendarDays, CarFront, Clock3, MapPin, Navigation, ParkingSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { bookingsAPI, slotsAPI } from '../../services/api';
import LoadingState from '../../components/ui/LoadingState';
import MetricCard from '../../components/ui/MetricCard';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [slotStats, setSlotStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([slotsAPI.getAll(), bookingsAPI.getMyBookings()])
      .then(([slotsRes, bookingsRes]) => {
        setSlotStats(slotsRes.data.stats);
        setRecentBookings(bookingsRes.data.bookings.slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState cards={4} />;
  const total = slotStats?.total || 0;
  const occupancyPct = total ? Math.round(((slotStats?.occupied || 0) / total) * 100) : 0;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Driver overview"
        title={`Good to see you, ${user?.name?.split(' ')[0] || 'driver'}`}
        description="A live view of parking availability and your latest activity."
        actions={<Link to="/dashboard/slots" className="btn btn-primary"><MapPin size={16} /> Find parking</Link>}
      />

      <section className="dashboard-metrics" aria-label="Parking statistics">
        <MetricCard label="Available now" value={slotStats?.available ?? '—'} icon={<MapPin size={20} />} tone="green" detail="Ready to reserve" />
        <MetricCard label="Occupied slots" value={slotStats?.occupied ?? '—'} icon={<ParkingSquare size={20} />} tone="red" detail="Live inventory" />
        <MetricCard label="Total spaces" value={slotStats?.total ?? '—'} icon={<CarFront size={20} />} tone="graphite" detail="Across all locations" />
        <MetricCard label="Occupancy" value={`${occupancyPct}%`} icon={<Clock3 size={20} />} tone="amber" detail="Current utilisation" />
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <div className="panel-head"><h2>Recent bookings</h2><Link to="/dashboard/bookings">View all <ArrowRight size={13} /></Link></div>
          {recentBookings.length === 0 ? (
            <div className="empty-state">
              <CalendarDays size={36} /><h3>Your bookings will appear here</h3><p>Reserve a space and manage the journey from this dashboard.</p>
              <Link to="/dashboard/slots" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>Explore parking</Link>
            </div>
          ) : (
            <div className="booking-list">
              {recentBookings.map((booking) => (
                <div className="booking-row" key={booking._id}>
                  <div><strong>Slot {booking.slot?.slotNumber} · Zone {booking.slot?.zone}</strong><small>{format(new Date(booking.startTime), 'dd MMM yyyy, hh:mm a')} · {booking.bookingCode}</small></div>
                  <StatusBadge status={booking.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="card">
          <div className="panel-head"><h2>Quick actions</h2></div>
          <div className="quick-actions">
            <Link to="/dashboard/nearby" className="quick-action"><span><Navigation size={18} /></span><div><strong>Open nearby map</strong><small>Discover parking around you</small></div><ArrowRight size={14} /></Link>
            <Link to="/dashboard/vehicles" className="quick-action"><span><CarFront size={18} /></span><div><strong>Manage vehicles</strong><small>Keep booking details ready</small></div><ArrowRight size={14} /></Link>
            <Link to="/dashboard/bookings" className="quick-action"><span><CalendarDays size={18} /></span><div><strong>Booking history</strong><small>Review current and past trips</small></div><ArrowRight size={14} /></Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
