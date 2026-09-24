import React from 'react';
import { useParams } from 'react-router-dom';

const labels = {
  transactions: 'Transactions', earnings: 'Earnings', settings: 'Settings',
};

export default function VendorPlaceholder() {
  const { section } = useParams();
  const label = labels[section] || 'Vendor Module';
  return <div className="fade-in"><div className="page-header"><h1>{label}</h1><p>This module is prepared for a future ParkSmart phase.</p></div><div className="card"><p style={{ color: 'var(--text-secondary)' }}>No live data is available for this module yet.</p></div></div>;
}
