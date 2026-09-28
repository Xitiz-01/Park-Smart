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

const VEHICLE_TYPES = ['car', 'motorcycle', 'suv'];
const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'hybrid', 'electric'];

const emptyForm = {
  licensePlate: '',
  vehicleType: 'car',
  fuelType: 'petrol',
  brand: '',
  model: '',
  color: '',
  isDefault: false
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [brandError, setBrandError] = useState('');
  const [modelError, setModelError] = useState('');

  const fetchVehicles = () =>
    vehiclesAPI.getAll()
      .then(res => setVehicles(res.data.vehicles))
      .finally(() => setLoading(false));

  useEffect(() => { fetchVehicles(); }, []);

  const loadBrands = useCallback(async (vehicleType) => {
    setBrandsLoading(true); setBrandError('');
    try {
      const { data } = await vehicleCatalogAPI.getBrands({ vehicleType });
      setBrands(data.brands || []);
    } catch (error) {
      setBrandError(error.response?.data?.message || 'Unable to load brands');
    } finally { setBrandsLoading(false); }
  }, []);

  const loadModels = useCallback(async (brand, vehicleType, legacyModel, legacyFuel) => {
    if (!brand) { setModels([]); return; }
    setModelsLoading(true); setModelError('');
    try {
      const { data } = await vehicleCatalogAPI.getModels({ brand, vehicleType });
      setModels(data.models || []);
    } catch (error) {
      if (editingId && legacyModel) setModels([{ model: legacyModel, vehicleType, fuelTypes: legacyFuel ? [legacyFuel] : [] }]);
      else setModelError(error.response?.data?.message || 'Unable to load models');
    } finally { setModelsLoading(false); }
  }, [editingId]);

  useEffect(() => { if (showForm) loadBrands(form.vehicleType); }, [showForm, form.vehicleType, loadBrands]);
  useEffect(() => {
    if (showForm && form.brand) loadModels(form.brand, form.vehicleType, form.model, form.fuelType);
    else setModels([]);
  }, [showForm, form.brand, form.vehicleType, form.model, form.fuelType, loadModels]);

  const brandOptions = useMemo(() => (
    editingId && form.brand && !brands.includes(form.brand) ? [form.brand, ...brands] : brands
  ), [brands, editingId, form.brand]);
  const modelOptions = useMemo(() => models.map((item) => item.model), [models]);

  const selectModel = async (model) => {
    setForm((current) => ({ ...current, model }));
    if (!model) return;
    try {
      const { data } = await vehicleCatalogAPI.getDetails({ brand: form.brand, model });
      const details = data.vehicle;
      setForm((current) => applyCatalogDetails(current, details));
    } catch (error) {
      setModelError(error.response?.data?.message || 'Unable to load model details');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = vehicleFormPayload(form);
      if (editingId) await vehiclesAPI.update(editingId, payload);
      else await vehiclesAPI.add(payload);
      toast.success(editingId ? 'Vehicle updated' : 'Vehicle added');
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchVehicles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add vehicle');
    } finally {
      setSaving(false);
    }
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (vehicle) => {
    setEditingId(vehicle._id);
    setForm({
      licensePlate: vehicle.licensePlate || '',
      vehicleType: physicalVehicleType(vehicle),
      fuelType: vehicle.fuelType || (isElectricVehicle(vehicle) ? 'electric' : ''),
      brand: vehicle.brand || '', model: vehicle.model || '', color: vehicle.color || '',
      isDefault: Boolean(vehicle.isDefault),
    });
    setShowForm(true);
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

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>My Vehicles</h1>
          <p>{vehicles.length} registered vehicle{vehicles.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={startAdd} className="btn btn-primary">
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card fade-in" style={{ marginBottom: 24, borderColor: 'var(--accent)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 15 }}>
            {editingId ? 'Edit Vehicle' : 'Add New Vehicle'}
          </h3>

          <form onSubmit={handleSave}>

            {/* GRID START */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 16
              }}
            >
              <div className="form-group">
                <label className="form-label">License Plate *</label>
                <input
                  className="form-input"
                  placeholder="MH12AB1234"
                  value={form.licensePlate}
                  onChange={e => setForm({ ...form, licensePlate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Vehicle Type *</label>
                <select
                  className="form-input"
                  value={form.vehicleType}
                  onChange={e => setForm({ ...form, vehicleType: e.target.value, brand: '', model: '' })}
                >
                  {VEHICLE_TYPES.map(t => (
                    <option key={t} value={t}>{t.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <SearchableSelect
                label="Brand"
                value={form.brand}
                options={brandOptions}
                onChange={(brand) => setForm({ ...form, brand, model: '' })}
                placeholder="Search brands"
                loading={brandsLoading}
                error={brandError}
                onRetry={() => loadBrands(form.vehicleType)}
                required
              />

              <SearchableSelect
                label="Model"
                value={form.model}
                options={modelOptions}
                onChange={selectModel}
                placeholder={form.brand ? 'Search models' : 'Choose a brand first'}
                loading={modelsLoading}
                error={modelError}
                onRetry={() => loadModels(form.brand, form.vehicleType, form.model, form.fuelType)}
                disabled={!form.brand}
                required
              />

              <div className="form-group">
                <label className="form-label">Fuel Type *</label>
                <select
                  className="form-input"
                  value={form.fuelType}
                  onChange={e => setForm({ ...form, fuelType: e.target.value })}
                  required
                >
                  <option value="" disabled>Select fuel type</option>
                  {FUEL_TYPES.map(t => (
                    <option key={t} value={t}>{t.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Color</label>
                <input
                  className="form-input"
                  placeholder="White, Black..."
                  value={form.color}
                  onChange={e => setForm({ ...form, color: e.target.value })}
                />
              </div>
            </div>
            {/* GRID END */}

            {/* ✅ CHECKBOX OUTSIDE GRID */}
           <div style={{ width: '100%', margin: '10px 0 20px 0' }}>
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',  // 🔥 IMPORTANT
      gap: 10,
      fontSize: 14,
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      width: '100%'
    }}
  >
    <input
      type="checkbox"
      checked={form.isDefault}
      onChange={(e) =>
        setForm({ ...form, isDefault: e.target.checked })
      }
      style={{ width: 16, height: 16 }}
    />
    <span style={{ textAlign: 'left' }}>
      Set as default vehicle
    </span>
  </label>
</div>

            {/* BUTTONS */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
                className="btn btn-outline"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || !form.brand || !form.model || !form.fuelType}
              >
                {saving ? 'Saving...' : editingId ? 'Update Vehicle' : 'Save Vehicle'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* VEHICLE LIST */}
      {vehicles.length === 0 ? (
        <div className="empty-state card">
          <Truck size={40} style={{ margin: '0 auto 12px' }} />
          <h3>No vehicles registered</h3>
          <p>Add your vehicle to start booking parking slots.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16
          }}
        >
          {vehicles.map((v) => (
            <div key={v._id} className="card" style={{ position: 'relative' }}>
              {v.isDefault && (
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                  <span className="badge badge-yellow">
                    <Star size={10} fill="currentColor" /> Default
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background: 'var(--accent-glow)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Truck color="var(--accent)" size={20} />
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {v.licensePlate}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {vehicleClassificationLabel(v)}
                  </div>
                </div>
              </div>

              {(v.brand || v.model) && (
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {v.brand} {v.model}
                </div>
              )}

              {v.color && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Color: {v.color}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => startEdit(v)} className="btn btn-outline btn-sm">
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(v._id)}
                  className="btn btn-danger btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
