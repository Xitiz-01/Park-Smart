import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ParkingSquare, Plus, RefreshCw, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { vendorsAPI } from '../../services/api';

const emptyForm = { slotNumber: '', prefix: 'EV', count: 4, vehicleType: 'ev', evCompatible: true, chargerType: 'CCS2', connectorType: 'CCS2', chargerPowerKw: 22 };

export default function VendorSlots() {
  const [params] = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(params.get('location') || '');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('bulk');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    vendorsAPI.getLocations().then(({ data }) => {
      const evLocations = data.locations.filter((location) => location.evSupported && location.vehicleTypes.includes('ev'));
      setLocations(evLocations);
      setLocationId((current) => evLocations.some((item) => item._id === current) ? current : evLocations[0]?._id || '');
    }).finally(() => setLoading(false));
  }, []);
  const loadSlots = async (id = locationId) => {
    if (!id) return setSlots([]);
    setLoading(true);
    try { const { data } = await vendorsAPI.getLocationSlots(id); setSlots(data.slots); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to load EV slots'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (locationId) loadSlots(locationId); }, [locationId]);
  const current = locations.find((location) => location._id === locationId);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      if (mode === 'bulk') await vendorsAPI.bulkCreateSlots(locationId, form);
      else await vendorsAPI.createSlot(locationId, form);
      toast.success(mode === 'bulk' ? 'EV charging slots created' : 'EV charging slot created');
      setForm((value) => ({ ...value, slotNumber: '' }));
      await loadSlots();
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to create EV slots'); }
    finally { setSaving(false); }
  };
  const setStatus = async (slot, status) => {
    try { await vendorsAPI.updateSlot(slot._id, { status }); await loadSlots(); toast.success('EV slot status updated'); }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update slot'); }
  };

  return <div className="fade-in">
    <div className="page-header"><h1>EV Charging Slots</h1><p>Regular parking uses capacity. Only exact EV charging bays are managed here.</p></div>
    <div className="card" style={{ marginBottom: 20 }}><div className="form-group"><label className="form-label">EV-enabled location</label><select className="form-input" value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">Select a location</option>{locations.map((location) => <option key={location._id} value={location._id}>{location.name} ({location.status})</option>)}</select></div></div>
    {!locationId ? <div className="card empty-state"><Zap size={40} /><h3>No EV-enabled location</h3><p>Enable EV support and pricing on a parking location first.</p></div> : <>
      <form className="card" onSubmit={submit} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}><button type="button" className={`btn btn-sm ${mode === 'bulk' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('bulk')}>Bulk Create</button><button type="button" className={`btn btn-sm ${mode === 'single' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('single')}>Single Slot</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {mode === 'bulk' ? <><div className="form-group"><label className="form-label">Prefix</label><input className="form-input" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })} required /></div><div className="form-group"><label className="form-label">Number of bays</label><input className="form-input" type="number" min="1" max="200" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} required /></div></> : <div className="form-group"><label className="form-label">Slot number</label><input className="form-input" value={form.slotNumber} onChange={(e) => setForm({ ...form, slotNumber: e.target.value.toUpperCase() })} required /></div>}
          <div className="form-group"><label className="form-label">Charger type</label><input className="form-input" value={form.chargerType} onChange={(e) => setForm({ ...form, chargerType: e.target.value })} placeholder="DC fast / AC" /></div>
          <div className="form-group"><label className="form-label">Connector</label><input className="form-input" value={form.connectorType} onChange={(e) => setForm({ ...form, connectorType: e.target.value })} placeholder="CCS2" /></div>
          <div className="form-group"><label className="form-label">Power (kW)</label><input className="form-input" type="number" min="0" max="1000" step="0.1" value={form.chargerPowerKw} onChange={(e) => setForm({ ...form, chargerPowerKw: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving || current?.status !== 'active'}><Plus size={15} /> {saving ? 'Creating…' : mode === 'bulk' ? 'Create EV slots' : 'Add EV slot'}</button>
      </form>
      <div className="card"><div className="flex items-center justify-between" style={{ marginBottom: 14 }}><h2 style={{ fontSize: 16 }}>{slots.length} EV Slots</h2><button className="btn btn-sm btn-outline" onClick={() => loadSlots()}><RefreshCw size={13} /> Refresh</button></div>
        <div className="table-wrapper"><table><thead><tr><th>Slot</th><th>Charger</th><th>Connector</th><th>Power</th><th>Rate</th><th>Status</th><th>Action</th></tr></thead><tbody>{slots.map((slot) => <tr key={slot._id}><td style={{ fontWeight: 700 }}>{slot.slotNumber}</td><td>{slot.chargerType || '—'}</td><td>{slot.connectorType || '—'}</td><td>{slot.chargerPowerKw ? `${slot.chargerPowerKw} kW` : '—'}</td><td>₹{slot.pricePerHour}/hr</td><td><span className={`badge ${slot.status === 'available' ? 'badge-green' : 'badge-yellow'}`}>{slot.status}</span></td><td>{['available', 'maintenance'].includes(slot.status) && <button className="btn btn-sm btn-outline" onClick={() => setStatus(slot, slot.status === 'available' ? 'maintenance' : 'available')}>{slot.status === 'available' ? 'Maintenance' : 'Make available'}</button>}</td></tr>)}</tbody></table>{!loading && !slots.length && <div className="empty-state"><ParkingSquare size={38} /><h3>No EV slots at this location yet.</h3></div>}</div>
      </div>
    </>}
  </div>;
}
