import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { format } from 'date-fns';
import { Users, MapPin, CalendarDays, IndianRupee, TrendingUp, Activity } from 'lucide-react';

const StatCard = ({ label, value, sub, color, icon }) => (
  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    upcoming:  { cls: 'badge-blue',   label: 'Upcoming' },
    active:    { cls: 'badge-green',  label: 'Active' },
    completed: { cls: 'badge-purple', label: 'Completed' },
    cancelled: { cls: 'badge-red',    label: 'Cancelled' },
  };
  const s = map[status] || { cls: 'badge-blue', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getDashboard()
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!data) return null;

  const { stats, recentBookings } = data;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>System overview and real-time stats</p>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Customers" value={stats.users.total} color="var(--accent)" icon={<Users size={22} />} />
        <StatCard label="Available Slots" value={stats.slots.available} sub={`${stats.slots.occupied} occupied · ${stats.slots.reserved} reserved`} color="var(--green)" icon={<MapPin size={22} />} />
        <StatCard label="Total Bookings" value={stats.bookings.total} sub={`${stats.bookings.today} today`} color="var(--yellow)" icon={<CalendarDays size={22} />} />
        <StatCard label="Total Revenue" value={`₹${stats.revenue.total}`} sub={`₹${stats.revenue.today} today`} color="var(--purple)" icon={<IndianRupee size={22} />} />
      </div>

      {/* Slot occupancy bar */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Slot Occupancy</span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{stats.slots.total} total slots</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Available', count: stats.slots.available, color: 'var(--green)' },
            { label: 'Occupied',  count: stats.slots.occupied,  color: 'var(--red)' },
            { label: 'Reserved',  count: stats.slots.reserved,  color: 'var(--yellow)' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
              {s.label}: <strong style={{ color: 'var(--text-primary)' }}>{s.count}</strong>
            </div>
          ))}
        </div>
        {/* Stacked bar */}
        <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex' }}>
          {[
            { count: stats.slots.available, color: 'var(--green)' },
            { count: stats.slots.occupied,  color: 'var(--red)' },
            { count: stats.slots.reserved,  color: 'var(--yellow)' },
          ].map((s, i) => (
            <div key={i} style={{ width: `${(s.count / stats.slots.total) * 100}%`, background: s.color, transition: 'width 0.5s' }} />
          ))}
        </div>
      </div>

      {/* Recent bookings table */}
      <div className="card">
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Recent Bookings</h2>
        {recentBookings.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No bookings yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Customer</th>
                  <th>Slot</th>
                  <th>Vehicle</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map(b => (
                  <tr key={b._id}>
                    <td style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--accent)' }}>#{b.bookingCode}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{b.user?.name}<br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.user?.email}</span></td>
                    <td>{b.slot?.slotNumber} — Zone {b.slot?.zone}</td>
                    <td>{b.vehicle?.licensePlate}</td>
                    <td>{format(new Date(b.createdAt), 'dd MMM yy')}</td>
                    <td><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
