import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addHours, format } from 'date-fns';
import { Car, Clock, MapPin, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { bookingsAPI, parkingLocationsAPI, slotsAPI, vehiclesAPI } from '../../services/api';
import { bookingTypeForVehicle } from '../../utils/hybridParking';

const inputDate = (value) => format(new Date(value), "yyyy-MM-dd'T'HH:mm");
const defaultStart = addHours(new Date(), 1);

export default function BookingPage({ legacy = false }) {
  const { locationId, slotId } = useParams();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [legacySlot, setLegacySlot] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [evSlotId, setEvSlotId] = useState('');
  const [startTime, setStartTime] = useState(inputDate(query.get('startTime') || defaultStart));
  const [endTime, setEndTime] = useState(inputDate(query.get('endTime') || addHours(defaultStart, 2)));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([vehiclesAPI.getAll(), legacy ? slotsAPI.getById(slotId) : Promise.resolve(null)])
      .then(([vehicleResponse, slotResponse]) => {
        const list = vehicleResponse.data.vehicles || [];
        setVehicles(list);
        const requestedType = query.get('vehicleType');
        const preferred = list.find((vehicle) => vehicle.vehicleType === requestedType && vehicle.isDefault)
          || list.find((vehicle) => vehicle.vehicleType === requestedType)
          || list.find((vehicle) => vehicle.isDefault) || list[0];
        setVehicleId(preferred?._id || '');
        if (slotResponse) setLegacySlot(slotResponse.data.slot);
      })
      .catch(() => { toast.error('Unable to load booking details'); navigate('/dashboard/nearby'); })
      .finally(() => setLoading(false));
  }, [legacy, navigate, query, slotId]);

  const vehicle = vehicles.find((item) => item._id === vehicleId);
  useEffect(() => {
    if (legacy || !locationId || !vehicle || !startTime || !endTime) return undefined;
    const timer = setTimeout(() => {
      parkingLocationsAPI.getById(locationId, {
        vehicleType: vehicle.vehicleType,
        startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(),
      }).then(({ data }) => {
        setLocation(data.location);
        const availableSlots = data.location.availability?.evSlots?.filter((slot) => slot.available) || [];
        setEvSlotId((current) => availableSlots.some((slot) => slot._id === current) ? current : availableSlots[0]?._id || '');
      }).catch((error) => { setLocation(null); toast.error(error.response?.data?.message || 'Unable to check availability'); });
    }, 250);
    return () => clearTimeout(timer);
  }, [legacy, locationId, vehicle, startTime, endTime]);

  const hours = useMemo(() => Math.max(0, Math.ceil((new Date(endTime) - new Date(startTime)) / 3600000)), [startTime, endTime]);
  const rate = legacySlot?.pricePerHour ?? location?.pricePerHour ?? 0;
  const isEv = vehicle?.vehicleType === 'ev';
  const available = legacy ? legacySlot?.status === 'available' : Number(location?.availability?.available || 0) > 0;

  const submit = async (event) => {
    event.preventDefault();
    if (!vehicleId) return toast.error('Add and select a vehicle first');
    if (new Date(endTime) <= new Date(startTime)) return toast.error('End time must be after start time');
    if (!available) return toast.error('No parking is available for this time');
    if (!legacy && isEv && !evSlotId) return toast.error('Select an EV charging slot');
    setSubmitting(true);
    try {
      await bookingsAPI.create({
        ...(legacy ? { slotId } : { parkingLocationId: locationId, bookingType: bookingTypeForVehicle(vehicle.vehicleType), ...(isEv ? { slotId: evSlotId } : {}) }),
        vehicleId, startTime: new Date(startTime).toISOString(), expectedEndTime: new Date(endTime).toISOString(),
      });
      toast.success(isEv ? 'EV charging slot reserved' : 'Parking capacity reserved');
      navigate('/dashboard/bookings');
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to reserve parking'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  const title = legacy ? `Legacy slot ${legacySlot?.slotNumber || ''}` : location?.name || 'Parking location';
  const address = legacy ? legacySlot?.location?.label : location?.address?.formattedAddress;

  return <div className="fade-in" style={{ maxWidth: 850, margin: '0 auto' }}>
    <div className="page-header"><h1>{title}</h1><p><MapPin size={14} style={{ verticalAlign: 'middle' }} /> {address || 'Loading location details…'}</p></div>
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 16 }}>Vehicle and time</h2>
        <div className="form-group"><label className="form-label">Your vehicle</label><select className="form-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required><option value="">Choose a vehicle</option>{vehicles.map((item) => <option key={item._id} value={item._id}>{item.licensePlate} — {item.brand} {item.model} ({item.vehicleType})</option>)}</select></div>
        {!vehicles.length && <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Add a vehicle from My Vehicles before reserving.</p>}
        <div className="booking-time-grid" style={{ marginTop: 16 }}><div className="form-group"><label className="form-label">Arrival</label><input className="form-input" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div><div className="form-group"><label className="form-label">Departure</label><input className="form-input" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></div></div>
      </section>

      {!legacy && location && <section className="card">
        <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: 'wrap' }}><div><h2 style={{ fontSize: 17 }}>Live availability</h2><p style={{ color: 'var(--text-muted)', marginTop: 4 }}>{location.availability.isOpen ? `${location.availability.available} of ${location.availability.total} available` : 'Closed for the selected time'}</p></div><span className={`badge ${available ? 'badge-green' : 'badge-red'}`}>{available ? 'Available' : 'Unavailable'}</span></div>
        {isEv && <div style={{ marginTop: 16 }}><label className="form-label"><Zap size={14} style={{ verticalAlign: 'middle' }} /> Exact EV charging slot</label><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>{(location.availability.evSlots || []).map((slot) => <button key={slot._id} type="button" disabled={!slot.available} className={`btn ${evSlotId === slot._id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setEvSlotId(slot._id)}>{slot.slotNumber}<br /><small>{slot.chargerPowerKw ? `${slot.chargerPowerKw} kW` : slot.chargerType || 'EV charger'}</small></button>)}</div></div>}
        {!isEv && <p style={{ marginTop: 14, color: 'var(--text-secondary)' }}><Car size={14} style={{ verticalAlign: 'middle' }} /> Regular vehicles reserve capacity at this location; no numbered slot is assigned.</p>}
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>{(location.amenities || []).map((item) => item.replaceAll('_', ' ')).join(' • ')}</div>
      </section>}

      <section className="card"><h2 style={{ fontSize: 17, marginBottom: 14 }}>Reservation estimate</h2><div style={{ display: 'grid', gap: 10 }}><div className="flex items-center justify-between"><span><Clock size={14} /> Duration</span><strong>{hours} hour{hours === 1 ? '' : 's'}</strong></div><div className="flex items-center justify-between"><span>Rate snapshot</span><strong>₹{rate}/hr</strong></div><div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}><span>Estimated amount</span><strong style={{ color: 'var(--accent)', fontSize: 20 }}>₹{hours * rate}</strong></div></div><p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>Payment is not collected in this phase. The final amount is calculated from the saved rate at checkout.</p></section>
      <div style={{ display: 'flex', gap: 12 }}><button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>Back</button><button className="btn btn-primary" disabled={submitting || !available || !vehicleId}>{submitting ? 'Reserving…' : isEv ? 'Reserve EV slot' : 'Reserve parking'}</button></div>
    </form>
  </div>;
}
