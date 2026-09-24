import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { vendorsAPI } from '../../services/api';

export default function ParkingLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { vendorsAPI.getLocations().then(({ data }) => setLocations(data.locations)).catch((error) => toast.error(error.response?.data?.message || 'Unable to load parking locations')).finally(() => setLoading(false)); }, []);
  return <div className="fade-in">
    <div className="page-header flex items-center justify-between" style={{ gap: 12, flexWrap: 'wrap' }}><div><h1>My Parking Locations</h1><p>Manage each physical parking facility independently</p></div><Link className="btn btn-primary" to="/vendor/locations/new"><Plus size={16} /> Add Parking Location</Link></div>
    {loading ? <div className="loading-spinner"><div className="spinner" /></div> : locations.length === 0 ? <div className="card empty-state"><MapPin size={42} /><h3>You haven't added a parking location yet.</h3><Link className="btn btn-primary" to="/vendor/locations/new" style={{ marginTop: 16 }}>Add Your First Parking Location</Link></div> :
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>{locations.map((location) => <div className="card" key={location._id}>
        <div className="flex items-center justify-between"><h2 style={{ fontSize: 17 }}>{location.name}</h2><span className={`badge ${location.status === 'active' ? 'badge-green' : 'badge-red'}`}>{location.status}</span></div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>{location.address.city}, {location.address.state}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0', fontSize: 13 }}>{location.vehicleTypes.map((type) => <span key={type} style={{ textTransform: 'capitalize' }}>{type}: <strong>₹{location.pricing?.[type] ?? 0}/hr</strong></span>)}</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{location.slotStats.available} / {location.slotStats.total} slots available</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}><Link className="btn btn-sm btn-outline" to={`/vendor/locations/${location._id}/edit`}><Settings size={14} /> Manage</Link><Link className="btn btn-sm btn-outline" to={`/vendor/slots?location=${location._id}`}>Slots</Link></div>
      </div>)}</div>}
  </div>;
}
