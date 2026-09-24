import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ParkingSquare, Plus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { vendorsAPI } from '../../services/api';

export default function VendorSlots() {
  const [params] = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(params.get('location') || '');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('bulk');
  const [form, setForm] = useState({ slotNumber: '', prefix: 'C', count: 10, vehicleType: 'car', evCompatible: false });

  useEffect(() => { vendorsAPI.getLocations().then(({ data }) => { setLocations(data.locations); setLocationId((current) => current || data.locations[0]?._id || ''); }).finally(() => setLoading(false)); }, []);
  const loadSlots = async (id = locationId) => { if (!id) return setSlots([]); setLoading(true); try { const { data } = await vendorsAPI.getLocationSlots(id); setSlots(data.slots); } catch (error) { toast.error(error.response?.data?.message || 'Unable to load slots'); } finally { setLoading(false); } };
  useEffect(() => { if (locationId) loadSlots(locationId); }, [locationId]);

  const current = locations.find((location) => location._id === locationId);
  useEffect(() => {
    if (current && !current.vehicleTypes.includes(form.vehicleType)) {
      const vehicleType = current.vehicleTypes[0];
      setForm((previous) => ({ ...previous, vehicleType, evCompatible: vehicleType === 'ev' }));
    }
  }, [current, form.vehicleType]);
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { if (mode === 'bulk') await vendorsAPI.bulkCreateSlots(locationId, form); else await vendorsAPI.createSlot(locationId, form); toast.success(mode === 'bulk' ? 'Parking slots created' : 'Parking slot created'); setForm({ ...form, slotNumber: '' }); await loadSlots(); } catch (error) { toast.error(error.response?.data?.message || 'Unable to create slots'); } finally { setSaving(false); } };
  const setStatus = async (slot, status) => { try { await vendorsAPI.updateSlot(slot._id, { status }); await loadSlots(); toast.success('Slot status updated'); } catch (error) { toast.error(error.response?.data?.message || 'Unable to update slot'); } };

  return <div className="fade-in">
    <div className="page-header"><h1>Parking Slots</h1><p>Create and manage slots within each parking location</p></div>
    <div className="card" style={{ marginBottom: 20 }}><div className="form-group"><label className="form-label">Parking Location</label><select className="form-input" value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">Select a location</option>{locations.map((location) => <option key={location._id} value={location._id}>{location.name} ({location.status})</option>)}</select></div></div>
    {!locationId ? <div className="card empty-state"><ParkingSquare size={40} /><h3>Add a parking location before creating slots.</h3></div> : <>
      <form className="card" onSubmit={submit} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}><button type="button" className={`btn btn-sm ${mode === 'bulk' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('bulk')}>Bulk Create</button><button type="button" className={`btn btn-sm ${mode === 'single' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('single')}>Single Slot</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
          {mode === 'bulk' ? <><div className="form-group"><label className="form-label">Prefix</label><input className="form-input" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })} required /></div><div className="form-group"><label className="form-label">Number of Slots</label><input className="form-input" type="number" min="1" max="200" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} required /></div></> : <div className="form-group"><label className="form-label">Slot Number</label><input className="form-input" value={form.slotNumber} onChange={(e) => setForm({ ...form, slotNumber: e.target.value.toUpperCase() })} required /></div>}
          <div className="form-group"><label className="form-label">Vehicle Type</label><select className="form-input" value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value, evCompatible: e.target.value === 'ev' })}>{current?.vehicleTypes.map((type) => <option value={type} key={type}>{type.toUpperCase()}</option>)}</select></div>
        </div>
        <label style={{ display: 'flex', gap: 7, marginTop: 14 }}><input type="checkbox" checked={form.evCompatible} onChange={(e) => setForm({ ...form, evCompatible: e.target.checked })} /> EV compatible</label>
        <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving || current?.status !== 'active'}><Plus size={15} /> {saving ? 'Creating…' : mode === 'bulk' ? 'Create Slots' : 'Add Slot'}</button>
      </form>
      <div className="card"><div className="flex items-center justify-between" style={{ marginBottom: 14 }}><h2 style={{ fontSize: 16 }}>{slots.length} Slots</h2><button className="btn btn-sm btn-outline" onClick={() => loadSlots()}><RefreshCw size={13} /> Refresh</button></div>
        <div className="table-wrapper"><table><thead><tr><th>Slot</th><th>Vehicle</th><th>Rate</th><th>EV</th><th>Status</th><th>Action</th></tr></thead><tbody>{slots.map((slot) => <tr key={slot._id}><td style={{ fontWeight: 700 }}>{slot.slotNumber}</td><td style={{ textTransform: 'capitalize' }}>{slot.vehicleType}</td><td>₹{slot.pricePerHour}/hr</td><td>{slot.evCompatible ? 'Yes' : 'No'}</td><td><span className={`badge ${slot.status === 'available' ? 'badge-green' : 'badge-yellow'}`}>{slot.status}</span></td><td>{['available', 'maintenance'].includes(slot.status) && <button className="btn btn-sm btn-outline" onClick={() => setStatus(slot, slot.status === 'available' ? 'maintenance' : 'available')}>{slot.status === 'available' ? 'Maintenance' : 'Make Available'}</button>}</td></tr>)}</tbody></table>{!loading && slots.length === 0 && <div className="empty-state"><ParkingSquare size={38} /><h3>No slots at this location yet.</h3></div>}</div>
      </div>
    </>}
  </div>;
}
