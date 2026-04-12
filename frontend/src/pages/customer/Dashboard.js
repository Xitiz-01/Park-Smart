import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { slotsAPI, bookingsAPI } from '../../services/api';
import { MapPin, CalendarDays, Clock, ArrowRight, ParkingSquare } from 'lucide-react';
import { format } from 'date-fns';

const StatusBadge = ({ status }) => {
  const map = {
    available:  { cls: 'badge-green',  label: 'Available' },
    occupied:   { cls: 'badge-red',    label: 'Occupied' },
    reserved:   { cls: 'badge-yellow', label: 'Reserved' },
    upcoming:   { cls: 'badge-blue',   label: 'Upcoming' },
    active:     { cls: 'badge-green',  label: 'Active' },
    completed:  { cls: 'badge-purple', label: 'Completed' },
    cancelled:  { cls: 'badge-red',    label: 'Cancelled' },
    maintenance:{ cls: 'badge-yellow', label: 'Maintenance' },
  };
  const s = map[status] || { cls: 'badge-blue', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

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

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const occupancyPct = slotStats ? Math.round((slotStats.occupied / slotStats.total) * 100) : 0;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <h1>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p>Here's the current parking status</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Available Slots', value: slotStats?.available ?? '—', color: 'var(--green)', icon: <MapPin size={20} /> },
          { label: 'Occupied Slots',  value: slotStats?.occupied  ?? '—', color: 'var(--red)',   icon: <ParkingSquare size={20} /> },
          { label: 'Total Slots',     value: slotStats?.total     ?? '—', color: 'var(--accent)', icon: <MapPin size={20} /> },
          { label: 'Occupancy Rate',  value: `${occupancyPct}%`,          color: 'var(--yellow)', icon: <Clock size={20} /> },
        ].map((s, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <Link to="/dashboard/slots" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', background: 'var(--accent)', borderRadius: 'var(--radius)',
          color: '#fff', fontWeight: 700, fontSize: 15, transition: 'opacity 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <span>Find &amp; Reserve Slot</span>
          <ArrowRight size={18} />
        </Link>
        <Link to="/dashboard/bookings" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, transition: 'border-color 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <span>View My Bookings</span>
          <CalendarDays size={18} />
        </Link>
      </div>

      {/* Recent Bookings */}
      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16 }}>Recent Bookings</h2>
          <Link to="/dashboard/bookings" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>View all →</Link>
        </div>

        {recentBookings.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={40} style={{ margin: '0 auto 12px' }} />
            <h3>No bookings yet</h3>
            <p style={{ fontSize: 14 }}>Reserve your first parking slot to get started.</p>
            <Link to="/dashboard/slots" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>Find Parking</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentBookings.map((b) => (
              <div key={b._id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', flexWrap: 'wrap', gap: 8
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                    Slot {b.slot?.slotNumber} — Zone {b.slot?.zone}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {format(new Date(b.startTime), 'dd MMM yyyy, hh:mm a')} · {b.bookingCode}
                  </div>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
