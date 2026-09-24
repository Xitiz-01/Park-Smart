import React, { useMemo, useState } from 'react';
import AddressLocationPicker, { emptyAddressSelection } from '../shared/AddressLocationPicker';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VEHICLES = [['car', 'Car'], ['bike', 'Bike'], ['ev', 'EV'], ['motorcycle', 'Motorcycle'], ['suv', 'SUV']];
const AMENITIES = [
  ['covered', 'Covered Parking'], ['cctv', 'CCTV'], ['security_guard', 'Security Guard'],
  ['ev_charging', 'EV Charging'], ['accessible', 'Accessible Parking'], ['24_7_access', '24/7 Access'],
];
const defaultHours = Object.fromEntries(DAYS.map((day) => [day, { open: true, allDay: false, openTime: '06:00', closeTime: '23:00' }]));

const createInitialState = (location) => location ? {
  name: location.name,
  description: location.description || '',
  address: {
    ...emptyAddressSelection,
    ...location.address,
    search: location.address.formattedAddress,
    latitude: location.location.coordinates[1],
    longitude: location.location.coordinates[0],
    verified: true,
  },
  vehicleTypes: location.vehicleTypes || [],
  pricing: location.pricing || {},
  evSupported: Boolean(location.evSupported),
  evDetails: location.evDetails || { slotCount: 0, chargerType: '' },
  amenities: location.amenities || [],
  operatingHours: location.operatingHours || defaultHours,
} : {
  name: '', description: '', address: emptyAddressSelection, vehicleTypes: ['car'], pricing: { car: 0 },
  evSupported: false, evDetails: { slotCount: 0, chargerType: '' }, amenities: [], operatingHours: defaultHours,
};

export default function ParkingLocationForm({ initialLocation, onSubmit, saving }) {
  const initial = useMemo(() => createInitialState(initialLocation), [initialLocation]);
  const [form, setForm] = useState(initial);

  const toggleVehicle = (type) => {
    const exists = form.vehicleTypes.includes(type);
    const vehicleTypes = exists ? form.vehicleTypes.filter((item) => item !== type) : [...form.vehicleTypes, type];
    setForm({ ...form, vehicleTypes, evSupported: type === 'ev' && !exists ? true : form.evSupported });
  };
  const toggleAmenity = (value) => setForm({ ...form, amenities: form.amenities.includes(value) ? form.amenities.filter((item) => item !== value) : [...form.amenities, value] });
  const updateDay = (day, updates) => setForm({ ...form, operatingHours: { ...form.operatingHours, [day]: { ...form.operatingHours[day], ...updates } } });

  const submit = (event) => {
    event.preventDefault();
    if (!form.address.verified) return;
    onSubmit({
      name: form.name,
      description: form.description,
      address: {
        formattedAddress: form.address.formattedAddress,
        addressLine1: form.address.addressLine1,
        city: form.address.city,
        district: form.address.district,
        state: form.address.state,
        pincode: form.address.pincode,
        country: form.address.country,
      },
      latitude: form.address.latitude,
      longitude: form.address.longitude,
      selectionToken: form.address.selectionToken,
      vehicleTypes: form.vehicleTypes,
      pricing: form.pricing,
      evSupported: form.evSupported,
      evDetails: form.evDetails,
      amenities: form.amenities,
      operatingHours: form.operatingHours,
    });
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 16 }}>Basic Information</h2>
        <div className="form-group"><label className="form-label">Parking Location Name</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength="120" required /></div>
        <div className="form-group" style={{ marginTop: 15 }}><label className="form-label">Description</label><textarea className="form-input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength="1000" /></div>
      </section>
      <section className="card"><h2 style={{ fontSize: 17, marginBottom: 16 }}>Address and Map Position</h2><AddressLocationPicker value={form.address} onChange={(address) => setForm({ ...form, address })} /></section>
      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 16 }}>Supported Vehicles and Pricing</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {VEHICLES.map(([type, label]) => <label key={type} style={{ display: 'flex', gap: 7, alignItems: 'center' }}><input type="checkbox" checked={form.vehicleTypes.includes(type)} onChange={() => toggleVehicle(type)} /> {label}</label>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginTop: 18 }}>
          {VEHICLES.filter(([type]) => form.vehicleTypes.includes(type)).map(([type, label]) => <div className="form-group" key={type}><label className="form-label">{label} ₹ / hour</label><input className="form-input" type="number" min="0" step="0.01" value={form.pricing[type] ?? ''} onChange={(e) => setForm({ ...form, pricing: { ...form.pricing, [type]: e.target.value } })} required /></div>)}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}><input type="checkbox" checked={form.evSupported} onChange={(e) => setForm({ ...form, evSupported: e.target.checked })} /> EV charging available</label>
        {form.evSupported && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <div className="form-group"><label className="form-label">Planned EV Slots</label><input className="form-input" type="number" min="0" value={form.evDetails.slotCount} onChange={(e) => setForm({ ...form, evDetails: { ...form.evDetails, slotCount: e.target.value } })} /></div>
          <div className="form-group"><label className="form-label">Charger Type</label><input className="form-input" value={form.evDetails.chargerType} onChange={(e) => setForm({ ...form, evDetails: { ...form.evDetails, chargerType: e.target.value } })} placeholder="e.g. CCS2" /></div>
        </div>}
      </section>
      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 16 }}>Operating Hours</h2>
        <div className="operating-hours">
          {DAYS.map((day) => { const hours = form.operatingHours[day] || defaultHours[day]; return <div key={day} className="hours-row">
            <strong>{day}</strong>
            <label className="hours-toggle"><input type="checkbox" checked={hours.open} onChange={(e) => updateDay(day, { open: e.target.checked })} /> Open</label>
            <label className="hours-toggle"><input type="checkbox" checked={hours.allDay} disabled={!hours.open} onChange={(e) => updateDay(day, { allDay: e.target.checked })} /> 24 hrs</label>
            <input className="form-input" type="time" disabled={!hours.open || hours.allDay} value={hours.openTime} onChange={(e) => updateDay(day, { openTime: e.target.value })} />
            <input className="form-input" type="time" disabled={!hours.open || hours.allDay} value={hours.closeTime} onChange={(e) => updateDay(day, { closeTime: e.target.value })} />
          </div>; })}
        </div>
      </section>
      <section className="card"><h2 style={{ fontSize: 17, marginBottom: 16 }}>Amenities</h2><div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>{AMENITIES.map(([value, label]) => <label key={value} style={{ display: 'flex', gap: 7, alignItems: 'center' }}><input type="checkbox" checked={form.amenities.includes(value)} onChange={() => toggleAmenity(value)} /> {label}</label>)}</div></section>
      {!form.address.verified && <div style={{ color: 'var(--yellow)', fontSize: 13 }}>Select a verified address before saving.</div>}
      <button className="btn btn-primary" disabled={saving || !form.address.verified || !form.vehicleTypes.length} style={{ alignSelf: 'flex-start' }}>{saving ? 'Saving…' : initialLocation ? 'Save Location' : 'Create Parking Location'}</button>
    </form>
  );
}
