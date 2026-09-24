import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarDays, CircleParking, IndianRupee, MapPin, ParkingSquare, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { vendorsAPI } from '../../services/api';
import LoadingState from '../../components/ui/LoadingState';
import MetricCard from '../../components/ui/MetricCard';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';

export default function VendorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vendorsAPI.getDashboard()
      .then((response) => setData(response.data))
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load vendor dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState cards={4} />;
  const stats = data?.stats || { parkingLocations: 0, totalSlots: 0, availableSlots: 0, occupiedSlots: 0, activeBookings: 0, totalEarnings: 0 };
  const total = stats.totalSlots || 0;
  const availablePct = total ? (stats.availableSlots / total) * 100 : 0;
  const occupiedPct = total ? (stats.occupiedSlots / total) * 100 : 0;

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Operations overview" title="Your parking business, at a glance" description="Live inventory and booking signals across every managed location." actions={<Link to="/vendor/locations/new" className="btn btn-primary"><Plus size={16} /> Add location</Link>} />
      <section className="dashboard-metrics">
        <MetricCard label="Parking locations" value={stats.parkingLocations} icon={<MapPin size={20} />} detail="Managed facilities" />
        <MetricCard label="Available slots" value={stats.availableSlots} icon={<CircleParking size={20} />} tone="green" detail={`${stats.totalSlots} total spaces`} />
        <MetricCard label="Active bookings" value={stats.activeBookings} icon={<CalendarDays size={20} />} tone="amber" detail="Currently in progress" />
        <MetricCard label="Total earnings" value={`₹${stats.totalEarnings}`} icon={<IndianRupee size={20} />} tone="violet" detail="Recorded payments" />
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <div className="panel-head"><h2>Live slot operations</h2><Link to="/vendor/slots">Manage slots <ArrowRight size={13} /></Link></div>
          <div className="legend-row">
            <span className="legend-item"><i style={{ background: 'var(--green)' }} />Available <strong>{stats.availableSlots}</strong></span>
            <span className="legend-item"><i style={{ background: 'var(--yellow)' }} />Occupied / reserved <strong>{stats.occupiedSlots}</strong></span>
            <span className="legend-item"><i style={{ background: '#334155' }} />Other <strong>{Math.max(0, total - stats.availableSlots - stats.occupiedSlots)}</strong></span>
          </div>
          <div className="occupancy-track" aria-label="Slot utilisation">
            <span className="occupancy-segment" style={{ width: `${availablePct}%`, background: 'var(--green)' }} />
            <span className="occupancy-segment" style={{ width: `${occupiedPct}%`, background: 'var(--yellow)' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 15 }}>Totals are calculated from your vendor-owned parking data and update with live booking activity.</p>
        </section>
        <aside className="card">
          <div className="panel-head"><h2>Account readiness</h2><StatusBadge status={data?.vendorStatus || 'active'} /></div>
          <div className="quick-actions">
            <Link to="/vendor/locations" className="quick-action"><span><MapPin size={18} /></span><div><strong>Parking locations</strong><small>Review address and pricing</small></div><ArrowRight size={14} /></Link>
            <Link to="/vendor/bookings" className="quick-action"><span><BadgeCheck size={18} /></span><div><strong>Incoming bookings</strong><small>Track customer activity</small></div><ArrowRight size={14} /></Link>
            <Link to="/vendor/slots" className="quick-action"><span><ParkingSquare size={18} /></span><div><strong>Slot inventory</strong><small>Add or update spaces</small></div><ArrowRight size={14} /></Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
