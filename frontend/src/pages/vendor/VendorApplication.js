import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { vendorsAPI } from '../../services/api';
import AddressLocationPicker, { emptyAddressSelection } from '../../components/shared/AddressLocationPicker';

const initialForm = {
  businessName: '', businessType: '', phone: '',
};

export default function VendorApplication() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...initialForm, phone: user?.phone || '' });
  const [address, setAddress] = useState(emptyAddressSelection);
  const [submitting, setSubmitting] = useState(false);

  if (user?.vendorProfile) return <Navigate to="/vendor/status" replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!address.verified || !address.selectionToken) return toast.error('Select a valid business address suggestion');
    setSubmitting(true);
    try {
      await vendorsAPI.register({
        ...form,
        address: address.addressLine1 || address.formattedAddress,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        latitude: address.latitude,
        longitude: address.longitude,
        selectionToken: address.selectionToken,
      });
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
          ].map(([name, label]) => (
            <div className="form-group" key={name}>
              <label className="form-label">{label}</label>
              <input className="form-input" name={name} value={form[name]}
                onChange={(e) => setForm({ ...form, [name]: e.target.value })} required
                pattern={name === 'phone' ? '(?:\\+91[ -]?)?[6-9][0-9 ]{9,14}' : undefined}
                maxLength={name === 'businessName' ? 120 : 80} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 14 }}>Business Address</h2>
          <AddressLocationPicker value={address} onChange={setAddress} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
          <button className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Application'}</button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/dashboard')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
