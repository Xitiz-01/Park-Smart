import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, CalendarDays, IndianRupee, MapPin, Store, Users } from 'lucide-react';
import { adminAPI } from '../../services/api';
import LoadingState from '../../components/ui/LoadingState';
import MetricCard from '../../components/ui/MetricCard';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { adminAPI.getDashboard().then((response) => setData(response.data)).finally(() => setLoading(false)); }, []);
  if (loading) return <LoadingState cards={4} />;
  if (!data) return <div className="card empty-state"><h3>Dashboard data is unavailable</h3><p>Try refreshing this page.</p></div>;

  const { stats, recentBookings } = data;
  const totalSlots = stats.slots.total || 0;
  const slotSegments = [
    { label: 'Available', value: stats.slots.available, color: 'var(--green)' },
    { label: 'Occupied', value: stats.slots.occupied, color: 'var(--red)' },
    { label: 'Reserved', value: stats.slots.reserved, color: 'var(--yellow)' },
  ];

  return (
    <div className="fade-in">
      <PageHeader eyebrow="System control" title="ParkSmart administration" description="Monitor platform activity, inventory, and operational health." actions={<Link to="/admin/vendors" className="btn btn-outline"><Store size={16} /> Review vendors</Link>} />
      <section className="dashboard-metrics">
        <MetricCard label="Total customers" value={stats.users.total} icon={<Users size={20} />} detail="Registered accounts" />
        <MetricCard label="Available slots" value={stats.slots.available} icon={<MapPin size={20} />} tone="green" detail={`${totalSlots} total spaces`} />
        <MetricCard label="Total bookings" value={stats.bookings.total} icon={<CalendarDays size={20} />} tone="amber" detail={`${stats.bookings.today} today`} />
        <MetricCard label="Total revenue" value={`₹${stats.revenue.total}`} icon={<IndianRupee size={20} />} tone="coral" detail={`₹${stats.revenue.today} today`} />
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h2>Network occupancy</h2><Link to="/admin/slots">View inventory <ArrowRight size={13} /></Link></div>
        <div className="legend-row">{slotSegments.map((item) => <span className="legend-item" key={item.label}><i style={{ background: item.color }} />{item.label} <strong>{item.value}</strong></span>)}</div>
        <div className="occupancy-track">{slotSegments.map((item) => <span key={item.label} className="occupancy-segment" style={{ width: `${totalSlots ? (item.value / totalSlots) * 100 : 0}%`, background: item.color }} />)}</div>
      </section>

      <section className="card">
        <div className="panel-head"><h2>Recent bookings</h2><Link to="/admin/bookings">View all <ArrowRight size={13} /></Link></div>
        {recentBookings.length === 0 ? <div className="empty-state"><CalendarDays size={35} /><h3>No bookings yet</h3><p>New activity will appear here.</p></div> : (
          <div className="table-wrapper"><table><thead><tr><th>Booking</th><th>Customer</th><th>Slot</th><th>Vehicle</th><th>Date</th><th>Status</th></tr></thead><tbody>{recentBookings.map((booking) => <tr key={booking._id}><td style={{ color: 'var(--accent)', fontWeight: 700 }}>#{booking.bookingCode}</td><td>{booking.user?.name}<br /><small>{booking.user?.email}</small></td><td>{booking.slot?.slotNumber} · Zone {booking.slot?.zone}</td><td>{booking.vehicle?.licensePlate}</td><td>{format(new Date(booking.createdAt), 'dd MMM yy')}</td><td><StatusBadge status={booking.status} /></td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
