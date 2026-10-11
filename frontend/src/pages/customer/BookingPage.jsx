import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addHours, format } from 'date-fns';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { io } from 'socket.io-client';
import { BatteryCharging, Car, CheckCircle2, Clock, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { bookingsAPI, parkingLocationsAPI, slotsAPI, vehiclesAPI } from '../../services/api';
import EVSlotBoard from '../../components/parking/EVSlotBoard';
import {
  bookingPayloadForVehicle,
  isElectricVehicle,
  isAvailabilityEventForLocation,
  physicalVehicleType,
  shouldShowEVSlotBoard,
  vehicleClassificationLabel,
} from '../../utils/hybridParking';

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
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    Promise.all([vehiclesAPI.getAll(), legacy ? slotsAPI.getById(slotId) : Promise.resolve(null)])
      .then(([vehicleResponse, slotResponse]) => {
        const list = vehicleResponse.data.vehicles || [];
        setVehicles(list);
        const requestedVehicleId = query.get('vehicleId');
        const requestedType = query.get('vehicleType');
        const requestedFuel = query.get('fuelType');
        const preferred = list.find((vehicle) => vehicle._id === requestedVehicleId)
          || list.find((vehicle) => physicalVehicleType(vehicle) === requestedType && vehicle.fuelType === requestedFuel && vehicle.isDefault)
          || list.find((vehicle) => physicalVehicleType(vehicle) === requestedType && vehicle.fuelType === requestedFuel)
          || list.find((vehicle) => vehicle.isDefault) || list[0];
        setVehicleId(preferred?._id || '');
        if (slotResponse) setLegacySlot(slotResponse.data.slot);
      })
      .catch(() => { toast.error('Unable to load booking details'); navigate('/dashboard/nearby'); })
      .finally(() => setLoading(false));
  }, [legacy, navigate, query, slotId]);

  const vehicle = vehicles.find((item) => item._id === vehicleId);
  const refreshAvailability = useCallback(async () => {
    if (legacy || !locationId || !vehicle || !startTime || !endTime) return;
    const { data } = await parkingLocationsAPI.getById(locationId, {
      vehicleType: physicalVehicleType(vehicle),
      fuelType: isElectricVehicle(vehicle) ? 'electric' : vehicle.fuelType,
      startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(),
    });
    setLocation(data.location);
    const availableSlots = data.location.availability?.evSlots?.filter((slot) => slot.available) || [];
    setEvSlotId((current) => availableSlots.some((slot) => slot._id === current) ? current : '');
  }, [endTime, legacy, locationId, startTime, vehicle]);

  useEffect(() => {
    if (legacy || !locationId || !vehicle || !startTime || !endTime) return undefined;
    const timer = setTimeout(() => {
      refreshAvailability().catch((error) => { setLocation(null); toast.error(error.response?.data?.message || 'Unable to check availability'); });
    }, 250);
    return () => clearTimeout(timer);
  }, [legacy, locationId, vehicle, startTime, endTime, refreshAvailability]);

  useEffect(() => {
    if (!shouldShowEVSlotBoard(vehicle, legacy) || !locationId) return undefined;
    const socket = io((process.env.REACT_APP_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, ''), { transports: ['websocket'], withCredentials: true });
    let timer;
    const refreshIfRelevant = ({ locationId: changedLocation } = {}) => {
      if (!isAvailabilityEventForLocation({ locationId: changedLocation }, locationId)) return;
      clearTimeout(timer);
      timer = setTimeout(() => refreshAvailability().catch(() => {}), 180);
    };
    socket.on('availability:changed', refreshIfRelevant);
    return () => { clearTimeout(timer); socket.disconnect(); };
  }, [legacy, locationId, refreshAvailability, vehicle]);

  const hours = useMemo(() => Math.max(0, Math.ceil((new Date(endTime) - new Date(startTime)) / 3600000)), [startTime, endTime]);
  const rate = legacySlot?.pricePerHour ?? location?.pricePerHour ?? 0;
  const isEv = isElectricVehicle(vehicle);
  const selectedEvSlot = location?.availability?.evSlots?.find((slot) => slot._id === evSlotId);
  const available = legacy ? legacySlot?.status === 'available' : Number(location?.availability?.available || 0) > 0;

  const submit = async (event) => {
    event.preventDefault();
    if (!vehicleId) return toast.error('Add and select a vehicle first');
    if (new Date(endTime) <= new Date(startTime)) return toast.error('End time must be after start time');
    if (!available) return toast.error('No parking is available for this time');
    if (!legacy && isEv && !evSlotId) return toast.error('Select an EV charging slot');
    setSubmitting(true);
    try {
      const response = await bookingsAPI.create(bookingPayloadForVehicle({
        legacy, legacySlotId: slotId, locationId, vehicle, vehicleId, evSlotId, startTime, endTime,
      }));
      toast.success(isEv ? 'EV charging slot reserved' : 'Parking capacity reserved');
      if (isEv && !legacy) setConfirmation(response.data.booking);
      else navigate('/dashboard/bookings');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to reserve parking');
      if (isEv && [400, 409].includes(error.response?.status)) refreshAvailability().catch(() => {});
    }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  const title = legacy ? `Legacy slot ${legacySlot?.slotNumber || ''}` : location?.name || 'Parking location';
  const address = legacy ? legacySlot?.location?.label : location?.address?.formattedAddress;
  const distanceKm = query.get('distanceKm');

  if (confirmation) return <div className="fade-in" style={{ maxWidth: 850, margin: '0 auto' }}>
    <div className="page-header"><h1>EV bay reserved</h1><p>Your charging bay is secured for the selected time.</p></div>
    <section className="card ev-confirmation">
      <div className="ev-confirmation-head"><span><CheckCircle2 size={23} /></span><div><span className="page-eyebrow">Reservation confirmed</span><h2>{confirmation.slot?.slotNumber}</h2></div></div>
      <div className="ev-confirmation-grid">
        <div><span>Charger</span><strong>{confirmation.slot?.chargerPowerKw ? `${confirmation.slot.chargerPowerKw} kW` : confirmation.slot?.chargerType || 'EV charger'}</strong></div>
        <div><span>Parking</span><strong>{confirmation.parkingLocation?.name || confirmation.slot?.parkingLocation?.name || title}</strong></div>
        <div><span>Arrival</span><strong>{format(new Date(confirmation.startTime), 'dd MMM, h:mm a')}</strong></div>
        <div><span>Booking</span><strong>{confirmation.bookingCode}</strong></div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}><button className="btn btn-primary" onClick={() => navigate('/dashboard/bookings')}>View my bookings</button><button className="btn btn-outline" onClick={() => navigate('/dashboard/nearby')}><MapPin size={14} /> Find another location</button></div>
    </section>
  </div>;

  return <div className="fade-in" style={{ maxWidth: 850, margin: '0 auto' }}>
    <div className="page-header"><h1>{title}</h1><p><MapPin size={14} style={{ verticalAlign: 'middle' }} /> {address || 'Loading location details…'}</p></div>
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 16 }}>Vehicle and time</h2>
        <div className="form-group"><label className="form-label">Your vehicle</label><select className="form-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required><option value="">Choose a vehicle</option>{vehicles.map((item) => <option key={item._id} value={item._id}>{item.licensePlate} — {item.brand} {item.model} ({vehicleClassificationLabel(item)})</option>)}</select></div>
        {!vehicles.length && <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Add a vehicle from My Vehicles before reserving.</p>}
        <div className="booking-time-grid" style={{ marginTop: 16 }}><div className="form-group"><label className="form-label">Arrival</label><input className="form-input" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div><div className="form-group"><label className="form-label">Departure</label><input className="form-input" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></div></div>
      </section>

      {!legacy && location && <section className="card">
        <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: 'wrap' }}><div><h2 style={{ fontSize: 17 }}>Live availability</h2><p style={{ color: 'var(--text-muted)', marginTop: 4 }}>{location.availability.isOpen ? `${location.availability.available} of ${location.availability.total} available` : 'Closed for the selected time'}</p></div><span className={`badge ${available ? 'badge-green' : 'badge-red'}`}>{available ? 'Available' : 'Unavailable'}</span></div>
        {shouldShowEVSlotBoard(vehicle, legacy) && <div className="ev-slot-selection-layout">
          <EVSlotBoard slots={location.availability.evSlots || []} selectedId={evSlotId} onSelect={setEvSlotId} subtitle="Choose one available charging bay. Availability is rechecked when you reserve." />
          <aside className="ev-slot-details" aria-live="polite">
            {selectedEvSlot ? <><span className="page-eyebrow"><BatteryCharging size={13} /> Selected bay</span><h3>{selectedEvSlot.slotNumber}</h3><p>{selectedEvSlot.chargerPowerKw ? `${selectedEvSlot.chargerPowerKw} kW` : 'EV charger'} {selectedEvSlot.chargerType || ''}</p><div className="ev-slot-detail-list"><div><span>Connector</span><strong>{selectedEvSlot.connectorType || 'Not specified'}</strong></div><div><span>Status</span><strong>Available</strong></div><div><span>Requested</span><strong>{format(new Date(startTime), 'h:mm a')} – {format(new Date(endTime), 'h:mm a')}</strong></div><div><span>Rate</span><strong>₹{rate}/hr</strong></div><div><span>Estimated total</span><strong>₹{hours * rate}</strong></div></div></> : <div className="empty-state" style={{ minHeight: 260, padding: 10 }}><BatteryCharging size={30} /><h3>Select an EV bay</h3><p>Choose an available tile to review its charger and reservation details.</p></div>}
          </aside>
        </div>}
        {!isEv && <p style={{ marginTop: 14, color: 'var(--text-secondary)' }}><Car size={14} style={{ verticalAlign: 'middle' }} /> Regular vehicles reserve capacity at this location; no numbered slot is assigned.</p>}
        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>{(location.amenities || []).map((item) => item.replaceAll('_', ' ')).join(' • ')}</div>
      </section>}

      {!legacy && location && <section className="card">
        <h2 style={{ fontSize: 17, marginBottom: 14 }}>Location details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 18 }}>
          <div><p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{distanceKm ? `${distanceKm} km from your search origin` : 'Verified vendor location'}</p><p style={{ marginTop: 10, fontSize: 13 }}><strong>Supported:</strong> {location.vehicleTypes.map((type) => type.toUpperCase()).join(', ')}</p><div style={{ marginTop: 12, display: 'grid', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>{Object.entries(location.operatingHours || {}).map(([day, hoursValue]) => <div className="flex justify-between" key={day}><span style={{ textTransform: 'capitalize' }}>{day}</span><span>{!hoursValue.open ? 'Closed' : hoursValue.allDay ? '24 hours' : `${hoursValue.openTime}–${hoursValue.closeTime}`}</span></div>)}</div></div>
          <MapContainer center={[location.location.coordinates[1], location.location.coordinates[0]]} zoom={15} dragging={false} scrollWheelZoom={false} style={{ height: 230, minHeight: 230, borderRadius: 10 }}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><CircleMarker center={[location.location.coordinates[1], location.location.coordinates[0]]} radius={8} pathOptions={{ color: '#147d6f', fillColor: '#147d6f', fillOpacity: 1 }} /></MapContainer>
        </div>
      </section>}

      <section className="card"><h2 style={{ fontSize: 17, marginBottom: 14 }}>Reservation estimate</h2><div style={{ display: 'grid', gap: 10 }}><div className="flex items-center justify-between"><span><Clock size={14} /> Duration</span><strong>{hours} hour{hours === 1 ? '' : 's'}</strong></div><div className="flex items-center justify-between"><span>Rate snapshot</span><strong>₹{rate}/hr</strong></div><div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}><span>Estimated amount</span><strong style={{ color: 'var(--accent)', fontSize: 20 }}>₹{hours * rate}</strong></div></div><p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>Payment is not collected in this phase. The final amount is calculated from the saved rate at checkout.</p></section>
      <div style={{ display: 'flex', gap: 12 }}><button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>Back</button><button className="btn btn-primary" disabled={submitting || !available || !vehicleId || (isEv && !legacy && !evSlotId)}>{submitting ? 'Reserving…' : isEv ? evSlotId ? `Reserve ${selectedEvSlot?.slotNumber || 'EV slot'}` : 'Select an EV bay' : 'Reserve parking'}</button></div>
    </form>
  </div>;
}
