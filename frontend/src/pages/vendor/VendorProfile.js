import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { vendorsAPI } from '../../services/api';

const editableFields = [
  ['businessName', 'Business Name'], ['businessType', 'Business Type'], ['phone', 'Business Phone'],
];

export default function VendorProfile() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    vendorsAPI.getMyProfile()
      .then(({ data }) => { setProfile(data.vendorProfile); setForm(data.vendorProfile); })
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load vendor profile'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries(editableFields.map(([field]) => [field, form[field]]));
      const { data } = await vendorsAPI.updateMyProfile(payload);
      setProfile(data.vendorProfile);
      setForm(data.vendorProfile);
      await refreshUser();
      toast.success('Vendor profile updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!profile) return <div className="card">Vendor profile could not be loaded.</div>;

  return (
    <div className="fade-in" style={{ maxWidth: 780 }}>
      <div className="page-header"><h1><Store size={23} style={{ verticalAlign: 'middle', marginRight: 8 }} />Vendor Profile</h1><p>Manage your public business information</p></div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div><div className="form-label">Vendor Name</div><div style={{ marginTop: 7 }}>{user.name}</div></div>
          <div><div className="form-label">Email</div><div style={{ marginTop: 7 }}>{user.email}</div></div>
          <div><div className="form-label">Approval Status</div><span className="badge badge-green" style={{ marginTop: 7 }}>{profile.vendorStatus}</span></div>
          <div style={{ gridColumn: '1 / -1' }}><div className="form-label">Verified Business Address</div><div style={{ marginTop: 7 }}>{profile.businessAddress?.formattedAddress || `${profile.address}, ${profile.city}, ${profile.state} ${profile.pincode}`}</div></div>
        </div>
      </div>
      <form className="card" onSubmit={save}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {editableFields.map(([field, label]) => (
            <div className="form-group" key={field} style={field === 'address' ? { gridColumn: '1 / -1' } : undefined}>
              <label className="form-label">{label}</label>
              {field === 'address'
                ? <textarea className="form-input" rows="3" value={form[field] || ''} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required />
                : <input className="form-input" value={form[field] || ''} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required />}
            </div>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginTop: 22 }} disabled={saving}><Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}</button>
      </form>
    </div>
  );
}
