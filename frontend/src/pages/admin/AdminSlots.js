import React, { useEffect, useState } from 'react';
import { slotsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, RefreshCw, Database } from 'lucide-react';

const emptyForm = { slotNumber: '', floor: 'G', zone: 'A', type: 'standard', status: 'available', pricePerHour: 30, features: { hasCCTV: true, hasCover: false, hasEVCharger: false } };

const StatusBadge = ({ status }) => {
  const map = { available: 'badge-green', occupied: 'badge-red', reserved: 'badge-yellow', maintenance: 'badge-yellow' };
  return <span className={`badge ${map[status] || 'badge-blue'}`}>{status}</span>;
};

export default function AdminSlots() {
  const [slots, setSlots] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSlot, setEditSlot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [filters, setFilters] = useState({ zone: '', status: '' });

  const fetchSlots = () => {
    const params = {};
    if (filters.zone) params.zone = filters.zone;
    if (filters.status) params.status = filters.status;
    slotsAPI.getAll(params)
      .then(res => { setSlots(res.data.slots); setStats(res.data.stats); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSlots(); }, [filters]);

  const openAdd = () => { setEditSlot(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (slot) => {
    setEditSlot(slot);
    setForm({ slotNumber: slot.slotNumber, floor: slot.floor, zone: slot.zone, type: slot.type, status: slot.status, pricePerHour: slot.pricePerHour, features: { ...slot.features } });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editSlot) {
        await slotsAPI.update(editSlot._id, form);
        toast.success('Slot updated');
      } else {
        await slotsAPI.create(form);
        toast.success('Slot created');
      }
      setShowForm(false);
      fetchSlots();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this slot?')) return;
    try {
      await slotsAPI.delete(id);
      toast.success('Slot deleted');
      fetchSlots();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
  };

  const handleSeed = async () => {
    if (!window.confirm('This will DELETE all existing slots and create 60 new ones. Continue?')) return;
    setSeeding(true);
    try {
      const res = await slotsAPI.seed();
      toast.success(res.data.message);
      fetchSlots();
    } catch (err) { toast.error('Seeding failed'); }
    finally { setSeeding(false); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Manage Slots</h1>
          <p>{stats.available} available · {stats.occupied} occupied · {stats.total} total</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSeed} className="btn btn-outline" disabled={seeding}>
            <Database size={15} /> {seeding ? 'Seeding...' : 'Seed 60 Slots'}
          </button>
          <button onClick={fetchSlots} className="btn btn-outline"><RefreshCw size={15} /></button>
          <button onClick={openAdd} className="btn btn-primary"><Plus size={15} /> Add Slot</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 'auto' }} value={filters.zone} onChange={e => setFilters({ ...filters, zone: e.target.value })}>
          <option value="">All Zones</option>
          {['A','B','C','D'].map(z => <option key={z} value={z}>Zone {z}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Status</option>
          {['available','occupied','reserved','maintenance'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card fade-in" style={{ marginBottom: 24, borderColor: 'var(--accent)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20 }}>{editSlot ? 'Edit Slot' : 'Add New Slot'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Slot Number *</label>
                <input className="form-input" placeholder="e.g. AG01" value={form.slotNumber}
                  onChange={e => setForm({ ...form, slotNumber: e.target.value })} required disabled={!!editSlot} />
              </div>
              <div className="form-group">
                <label className="form-label">Floor</label>
                <select className="form-input" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })}>
                  {['G','1','2','3'].map(f => <option key={f} value={f}>Floor {f}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Zone</label>
                <select className="form-input" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}>
                  {['A','B','C','D'].map(z => <option key={z} value={z}>Zone {z}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {['standard','compact','disabled','ev'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {['available','occupied','reserved','maintenance'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Price/Hour (₹)</label>
                <input type="number" className="form-input" value={form.pricePerHour}
                  onChange={e => setForm({ ...form, pricePerHour: Number(e.target.value) })} min={1} required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
              {[['hasCCTV','CCTV'],['hasCover','Covered'],['hasEVCharger','EV Charger']].map(([k, label]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.features[k]} onChange={e => setForm({ ...form, features: { ...form.features, [k]: e.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline">Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editSlot ? 'Update Slot' : 'Create Slot'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Slot #</th><th>Floor</th><th>Zone</th><th>Type</th><th>Status</th><th>Price/Hr</th><th>Features</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.map(slot => (
                <tr key={slot._id}>
                  <td style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 700 }}>{slot.slotNumber}</td>
                  <td>{slot.floor}</td>
                  <td>{slot.zone}</td>
                  <td style={{ textTransform: 'capitalize' }}>{slot.type}</td>
                  <td><StatusBadge status={slot.status} /></td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>₹{slot.pricePerHour}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {slot.features?.hasCCTV ? '📷 ' : ''}{slot.features?.hasCover ? '🏠 ' : ''}{slot.features?.hasEVCharger ? '⚡' : ''}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(slot)} className="btn btn-outline btn-sm"><Edit2 size={13} /></button>
                      <button onClick={() => handleDelete(slot._id)} className="btn btn-danger btn-sm"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {slots.length === 0 && <div className="empty-state"><p>No slots found. Use "Seed 60 Slots" to populate.</p></div>}
        </div>
      </div>
    </div>
  );
}
