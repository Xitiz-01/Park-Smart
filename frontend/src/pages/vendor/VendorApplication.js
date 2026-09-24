import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { vendorsAPI } from '../../services/api';

const initialForm = {
  businessName: '', businessType: '', phone: '', address: '', city: '', state: '', pincode: '',
};

export default function VendorApplication() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...initialForm, phone: user?.phone || '' });
  const [submitting, setSubmitting] = useState(false);

  if (user?.vendorProfile) return <Navigate to="/vendor/status" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await vendorsAPI.register(form);
      await refreshUser();
      toast.success('Vendor application submitted');
      navigate('/vendor/status', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '40px auto', padding: 24 }} className="fade-in">
      <div className="page-header">
        <h1><Store size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Become a ParkSmart Vendor</h1>
        <p>Tell us about your parking business. An administrator will review your application.</p>
      </div>
      <form className="card" onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {[
            ['businessName', 'Business Name'], ['businessType', 'Business Type'], ['phone', 'Business Phone'],
            ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode'],
          ].map(([name, label]) => (
            <div className="form-group" key={name}>
              <label className="form-label">{label}</label>
              <input className="form-input" name={name} value={form[name]}
                onChange={(e) => setForm({ ...form, [name]: e.target.value })} required maxLength={name === 'businessName' ? 120 : 80} />
            </div>
          ))}
        </div>
        <div className="form-group" style={{ marginTop: 18 }}>
          <label className="form-label">Address</label>
          <textarea className="form-input" rows="3" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} required maxLength={250} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
          <button className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Application'}</button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/dashboard')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
