import React, { useEffect, useState } from 'react';
import { MapPin, CalendarDays, IndianRupee, BadgeCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { vendorsAPI } from '../../services/api';

export default function VendorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vendorsAPI.getDashboard()
      .then((response) => setData(response.data))
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load vendor dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  const stats = data?.stats || { parkingLocations: 0, activeBookings: 0, totalEarnings: 0 };
  const cards = [
    ['Vendor Status', data?.vendorStatus || 'active', 'var(--green)', <BadgeCheck size={21} />],
    ['Parking Locations', stats.parkingLocations, 'var(--accent)', <MapPin size={21} />],
    ['Active Bookings', stats.activeBookings, 'var(--yellow)', <CalendarDays size={21} />],
    ['Total Earnings', `₹${stats.totalEarnings}`, 'var(--green)', <IndianRupee size={21} />],
  ];

  return (
    <div className="fade-in">
      <div className="page-header"><h1>Vendor Dashboard</h1><p>Your ParkSmart business overview</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        {cards.map(([label, value, color, icon]) => (
          <div className="card" key={label} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ color, background: `${color}20`, borderRadius: 10, padding: 12 }}>{icon}</div>
            <div><div style={{ fontSize: 23, fontWeight: 700, textTransform: label === 'Vendor Status' ? 'capitalize' : 'none' }}>{value}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</div></div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 17, marginBottom: 8 }}>Vendor workspace ready</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Parking locations, bookings, slots, transactions, and earnings will connect to live marketplace data in later phases.</p>
      </div>
    </div>
  );
}
