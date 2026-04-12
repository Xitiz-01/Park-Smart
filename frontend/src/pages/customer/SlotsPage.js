import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { slotsAPI } from '../../services/api';
import { MapPin, Zap, Shield, Wind, Filter } from 'lucide-react';

const TYPE_COLORS = { standard: 'var(--accent)', compact: 'var(--green)', disabled: 'var(--yellow)', ev: 'var(--purple)' };
const TYPE_LABELS = { standard: 'Standard', compact: 'Compact', disabled: 'Accessible', ev: 'EV Charging' };

const SlotCard = ({ slot }) => {
  const isAvailable = slot.status === 'available';
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${isAvailable ? 'var(--border)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: '18px 20px', transition: 'border-color 0.2s, transform 0.2s',
      opacity: isAvailable ? 1 : 0.6,
    }}
      onMouseEnter={e => { if (isAvailable) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{slot.slotNumber}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Floor {slot.floor} · Zone {slot.zone}</div>
        </div>
        <div>
          {slot.status === 'available' && <span className="badge badge-green">Available</span>}
          {slot.status === 'occupied'  && <span className="badge badge-red">Occupied</span>}
          {slot.status === 'reserved'  && <span className="badge badge-yellow">Reserved</span>}
          {slot.status === 'maintenance' && <span className="badge badge-yellow">Maintenance</span>}
        </div>
      </div>

      {/* Type */}
      <div style={{ fontSize: 13, color: TYPE_COLORS[slot.type], marginBottom: 12, fontWeight: 600 }}>
        {TYPE_LABELS[slot.type]}
      </div>

      {/* Features */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {slot.features?.hasCCTV && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}><Shield size={12} />CCTV</div>}
        {slot.features?.hasCover && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}><Wind size={12} />Covered</div>}
        {slot.features?.hasEVCharger && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--purple)' }}><Zap size={12} />EV Charger</div>}
      </div>

      {/* Price & Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>₹{slot.pricePerHour}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/hr</span>
        </div>
        {isAvailable ? (
          <Link to={`/dashboard/book/${slot._id}`} className="btn btn-primary btn-sm">Book Now</Link>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Unavailable</span>
        )}
      </div>
    </div>
  );
};

export default function SlotsPage() {
  const [slots, setSlots] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ zone: '', type: '', status: '' });

  const fetchSlots = () => {
    setLoading(true);
    const params = {};
    if (filters.zone) params.zone = filters.zone;
    if (filters.type) params.type = filters.type;
    if (filters.status) params.status = filters.status;
    slotsAPI.getAll(params)
      .then((res) => { setSlots(res.data.slots); setStats(res.data.stats); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSlots(); }, [filters]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Find Parking</h1>
        <p>{stats.available ?? '—'} of {stats.total ?? '—'} slots available</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--text-secondary)' }}>
          <Filter size={16} /> <span style={{ fontWeight: 600, fontSize: 14 }}>Filters</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Zone</label>
            <select className="form-input" value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}>
              <option value="">All Zones</option>
              {['A','B','C','D'].map(z => <option key={z} value={z}>Zone {z}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-input" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">All Types</option>
              <option value="standard">Standard</option>
              <option value="compact">Compact</option>
              <option value="disabled">Accessible</option>
              <option value="ev">EV Charging</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : slots.length === 0 ? (
        <div className="empty-state card">
          <MapPin size={40} style={{ margin: '0 auto 12px' }} />
          <h3>No slots found</h3>
          <p>Try adjusting your filters.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {slots.map((slot) => <SlotCard key={slot._id} slot={slot} />)}
        </div>
      )}
    </div>
  );
}
