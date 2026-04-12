import React, { useEffect, useState } from 'react';
import { vehiclesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Truck, Plus, Trash2, Star } from 'lucide-react';

const VEHICLE_TYPES = ['car', 'motorcycle', 'suv', 'ev'];

const emptyForm = { licensePlate: '', vehicleType: 'car', brand: '', model: '', color: '', isDefault: false };

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchVehicles = () => vehiclesAPI.getAll().then(res => setVehicles(res.data.vehicles)).finally(() => setLoading(false));
  useEffect(() => { fetchVehicles(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await vehiclesAPI.add(form);
      toast.success('Vehicle added');
      setShowForm(false);
      setForm(emptyForm);
      fetchVehicles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add vehicle');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this vehicle?')) return;
    try {
      await vehiclesAPI.delete(id);
      toast.success('Vehicle removed');
      fetchVehicles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>My Vehicles</h1>
          <p>{vehicles.length} registered vehicle{vehicles.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card fade-in" style={{ marginBottom: 24, borderColor: 'var(--accent)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 15 }}>Add New Vehicle</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">License Plate *</label>
                <input className="form-input" placeholder="MH12AB1234" value={form.licensePlate}
                  onChange={e => setForm({ ...form, licensePlate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Type *</label>
                <select className="form-input" value={form.vehicleType} onChange={e => setForm({ ...form, vehicleType: e.target.value })}>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Brand</label>
                <input className="form-input" placeholder="Maruti, Honda..." value={form.brand}
                  onChange={e => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Model</label>
                <input className="form-input" placeholder="Swift, City..." value={form.model}
                  onChange={e => setForm({ ...form, model: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input className="form-input" placeholder="White, Black..." value={form.color}
                  onChange={e => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <input type="checkbox" id="isDefault" checked={form.isDefault}
                onChange={e => setForm({ ...form, isDefault: e.target.checked })} style={{ width: 16, height: 16 }} />
              <label htmlFor="isDefault" style={{ fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Set as default vehicle
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Vehicle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="empty-state card">
          <Truck size={40} style={{ margin: '0 auto 12px' }} />
          <h3>No vehicles registered</h3>
          <p>Add your vehicle to start booking parking slots.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {vehicles.map((v) => (
            <div key={v._id} className="card" style={{ position: 'relative' }}>
              {v.isDefault && (
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  <span className="badge badge-yellow"><Star size={10} fill="currentColor" /> Default</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, background: 'var(--accent-glow)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck color="var(--accent)" size={20} />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{v.licensePlate}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{v.vehicleType}</div>
                </div>
              </div>
              {(v.brand || v.model) && (
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{v.brand} {v.model}</div>
              )}
              {v.color && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Color: {v.color}</div>
              )}
              <button onClick={() => handleDelete(v._id)} className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
