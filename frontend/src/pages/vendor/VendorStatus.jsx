import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Clock, RefreshCw, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const statusCopy = {
  pending: ['Pending', 'Your application has been submitted and is awaiting approval.', 'badge-yellow'],
  rejected: ['Rejected', 'Your vendor application was not approved. Contact support if you need more information.', 'badge-red'],
  suspended: ['Suspended', 'Your vendor access is suspended. Contact support for assistance.', 'badge-red'],
};

export default function VendorStatus() {
  const { user, refreshUser, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const profile = user?.vendorProfile;

  if (!profile) return <Navigate to="/vendor/apply" replace />;
  if (user.role === 'vendor' && profile.vendorStatus === 'active') return <Navigate to="/vendor" replace />;

  const [label, message, badge] = statusCopy[profile.vendorStatus] || statusCopy.pending;
  const refresh = async () => {
    setRefreshing(true);
    try { await refreshUser(); toast.success('Application status refreshed'); }
    catch { toast.error('Unable to refresh status'); }
    finally { setRefreshing(false); }
  };

  return (
    <div style={{ maxWidth: 620, margin: '80px auto', padding: 24 }} className="fade-in">
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <Store size={42} color="var(--accent)" style={{ marginBottom: 16 }} />
        <h1 style={{ fontSize: 24, marginBottom: 10 }}>Vendor Application</h1>
        <span className={`badge ${badge}`} style={{ marginBottom: 18 }}><Clock size={13} /> {label}</span>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>{profile.businessName}</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={15} /> {refreshing ? 'Refreshing...' : 'Refresh Status'}
          </button>
          <Link className="btn btn-outline" to="/dashboard">Customer Dashboard</Link>
          <button className="btn btn-outline" onClick={logout}>Log out</button>
        </div>
      </div>
    </div>
  );
}
