import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { vehicleCatalogAPI, vehiclesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Truck, Plus, Trash2, Star, Pencil } from 'lucide-react';
import SearchableSelect from '../../components/shared/SearchableSelect';
import {
  applyCatalogDetails,
  isElectricVehicle,
  physicalVehicleType,
  vehicleClassificationLabel,
  vehicleFormPayload,
} from '../../utils/hybridParking';

const VEHICLE_TYPES = ['car', 'motorcycle'];
const BODY_STYLES = ['hatchback', 'sedan', 'suv', 'crossover', 'coupe', 'wagon', 'convertible', 'pickup', 'van', 'mpv', 'other'];
const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'hybrid', 'electric'];

const emptyForm = {
  licensePlate: '', make: '', brand: '', model: '', modelYear: '',
  vehicleType: '', bodyStyle: '', fuelType: '', color: '', isDefault: false,
};

const titleCase = (value) => value.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [makeError, setMakeError] = useState('');
  const [modelError, setModelError] = useState('');
  const [yearError, setYearError] = useState('');

  const fetchVehicles = () => vehiclesAPI.getAll()
    .then((res) => setVehicles(res.data.vehicles))
    .finally(() => setLoading(false));

  useEffect(() => { fetchVehicles(); }, []);

  const loadMakes = useCallback(async () => {
    setMakesLoading(true); setMakeError('');
    try {
      const { data } = await vehicleCatalogAPI.getBrands();
      setMakes(data.makes || data.brands || []);
    } catch (error) {
      setMakeError(error.response?.data?.message || 'Unable to load vehicle makes');
    } finally { setMakesLoading(false); }
  }, []);

  const loadModels = useCallback(async (make, legacyModel = '') => {
    if (!make) { setModels([]); return; }
    setModelsLoading(true); setModelError('');
    try {
      const { data } = await vehicleCatalogAPI.getModels({ make });
      setModels(data.models || []);
    } catch (error) {
      if (legacyModel) setModels([{ make, model: legacyModel }]);
      setModelError(error.response?.data?.message || 'Unable to load models');
    } finally { setModelsLoading(false); }
  }, []);

  const loadYears = useCallback(async (make, model, legacyYear = '') => {
    if (!make || !model) { setYears([]); return; }
    setYearsLoading(true); setYearError('');
    try {
      const { data } = await vehicleCatalogAPI.getYears({ make, model });
      setYears(data.years || []);
    } catch (error) {
      setYears(legacyYear ? [Number(legacyYear)] : []);
      setYearError(error.response?.data?.message || 'Model years unavailable; enter one if known');
    } finally { setYearsLoading(false); }
  }, []);

  useEffect(() => { if (showForm) loadMakes(); }, [showForm, loadMakes]);

  const makeOptions = useMemo(() => (
    editingId && form.make && !makes.includes(form.make) ? [form.make, ...makes] : makes
  ), [makes, editingId, form.make]);
  const modelOptions = useMemo(() => models.map((item) => item.model), [models]);

  const selectMake = (make) => {
    setForm((current) => ({ ...current, make, brand: make, model: '', modelYear: '', bodyStyle: '', fuelType: '' }));
    setYears([]);
    loadModels(make);
  };

  const fetchAndApplyDetails = useCallback(async (make, model, modelYear) => {
    try {
      const { data } = await vehicleCatalogAPI.getDetails({ make, model, ...(modelYear ? { modelYear } : {}) });
      setForm((current) => applyCatalogDetails(current, data.vehicle));
    } catch (error) {
      setModelError(error.response?.data?.message || 'Unable to load model details');
    }
  }, []);

  const selectModel = (model) => {
    setForm((current) => ({ ...current, model, modelYear: '' }));
    if (!model) { setYears([]); return; }
    loadYears(form.make, model);
    fetchAndApplyDetails(form.make, model, '');
  };

  const selectYear = (modelYear) => {
    setForm((current) => ({ ...current, modelYear }));
    if (modelYear) fetchAndApplyDetails(form.make, form.model, modelYear);
  };

  const handleSave = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const payload = vehicleFormPayload(form);
      if (editingId) await vehiclesAPI.update(editingId, payload);
      else await vehiclesAPI.add(payload);
      toast.success(editingId ? 'Vehicle updated' : 'Vehicle added');
      setShowForm(false); setForm(emptyForm); setEditingId(null); fetchVehicles();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save vehicle');
    } finally { setSaving(false); }
  };

  const startAdd = () => {
    setEditingId(null); setForm(emptyForm); setModels([]); setYears([]); setShowForm(true);
  };

  const startEdit = (vehicle) => {
    const make = vehicle.make || vehicle.brand || '';
    setEditingId(vehicle._id);
    setForm({
      licensePlate: vehicle.licensePlate || '', make, brand: make, model: vehicle.model || '',
      modelYear: vehicle.modelYear || '', vehicleType: physicalVehicleType(vehicle),
      bodyStyle: vehicle.bodyStyle || (vehicle.vehicleType === 'suv' ? 'suv' : ''),
      fuelType: vehicle.fuelType || (isElectricVehicle(vehicle) ? 'electric' : ''),
      color: vehicle.color || '', isDefault: Boolean(vehicle.isDefault),
    });
    setShowForm(true);
    loadModels(make, vehicle.model);
    loadYears(make, vehicle.model, vehicle.modelYear);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this vehicle?')) return;
    try {
      await vehiclesAPI.delete(id); toast.success('Vehicle removed'); fetchVehicles();
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to remove'); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return <div className="fade-in">
    <div className="page-header flex items-center justify-between">
      <div><h1>My Vehicles</h1><p>{vehicles.length} registered vehicle{vehicles.length !== 1 ? 's' : ''}</p></div>
      <button onClick={startAdd} className="btn btn-primary"><Plus size={16} /> Add Vehicle</button>
    </div>

    {showForm && <div className="card fade-in" style={{ marginBottom: 24, borderColor: 'var(--accent)' }}>
      <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 15 }}>{editingId ? 'Edit Vehicle' : 'Add New Vehicle'}</h3>
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">License Plate *</label>
            <input className="form-input" placeholder="MH12AB1234" value={form.licensePlate} onChange={(e) => setForm({ ...form, licensePlate: e.target.value })} required />
          </div>
          <SearchableSelect label="Make" value={form.make} options={makeOptions} onChange={selectMake} placeholder="Search makes" loading={makesLoading} error={makeError} onRetry={loadMakes} required />
          <SearchableSelect label="Model" value={form.model} options={modelOptions} onChange={selectModel} placeholder={form.make ? 'Search models' : 'Choose a make first'} loading={modelsLoading} error={modelError} onRetry={() => loadModels(form.make, form.model)} disabled={!form.make} required />
          <div className="form-group">
            <label className="form-label">Model Year <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
            {years.length ? <select className="form-input" value={form.modelYear} onChange={(e) => selectYear(e.target.value)} disabled={yearsLoading}>
              <option value="">Not specified</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select> : <input className="form-input" type="number" min="1886" max={new Date().getFullYear() + 2} placeholder={yearsLoading ? 'Loading…' : 'Enter year if known'} value={form.modelYear} onChange={(e) => selectYear(e.target.value)} disabled={!form.model || yearsLoading} />}
            {yearError && <div className="catalog-control-message" role="alert"><span>{yearError}</span><button type="button" onClick={() => loadYears(form.make, form.model, form.modelYear)}>Retry</button></div>}
          </div>
          <div className="form-group">
            <label className="form-label">Vehicle Type *</label>
            <select className="form-input" value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })} required>
              <option value="" disabled>Select vehicle type</option>{VEHICLE_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Body Style *</label>
            <select className="form-input" value={form.bodyStyle} onChange={(e) => setForm({ ...form, bodyStyle: e.target.value })} required>
              <option value="" disabled>Select body style</option>{BODY_STYLES.map((style) => <option key={style} value={style}>{style.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fuel Type *</label>
            <select className="form-input" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} required>
              <option value="" disabled>Select fuel type</option>{FUEL_TYPES.map((type) => <option key={type} value={type}>{type.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Color</label><input className="form-input" placeholder="White, Black..." value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
        </div>
        <div style={{ width: '100%', margin: '10px 0 20px' }}><label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} style={{ width: 16, height: 16 }} /> Set as default vehicle
        </label></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="btn btn-outline">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !form.make || !form.model || !form.vehicleType || !form.bodyStyle || !form.fuelType}>{saving ? 'Saving...' : editingId ? 'Update Vehicle' : 'Save Vehicle'}</button>
        </div>
      </form>
    </div>}

    {vehicles.length === 0 ? <div className="empty-state card"><Truck size={40} style={{ margin: '0 auto 12px' }} /><h3>No vehicles registered</h3><p>Add your vehicle to start booking parking slots.</p></div> :
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
        {vehicles.map((vehicle) => <div key={vehicle._id} className="card" style={{ position: 'relative' }}>
          {vehicle.isDefault && <div style={{ position: 'absolute', top: 12, right: 12 }}><span className="badge badge-yellow"><Star size={10} fill="currentColor" /> Default</span></div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, background: 'var(--accent-glow)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Truck color="var(--accent)" size={20} /></div>
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>{vehicle.licensePlate}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{vehicleClassificationLabel(vehicle)}</div></div>
          </div>
          {(vehicle.make || vehicle.brand || vehicle.model) && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{vehicle.make || vehicle.brand} {vehicle.model} {vehicle.modelYear || ''}</div>}
          {vehicle.color && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Color: {vehicle.color}</div>}
          <div style={{ display: 'flex', gap: 8 }}><button onClick={() => startEdit(vehicle)} className="btn btn-outline btn-sm"><Pencil size={14} /> Edit</button><button onClick={() => handleDelete(vehicle._id)} className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trash2 size={14} /> Remove</button></div>
        </div>)}
      </div>}
  </div>;
}
