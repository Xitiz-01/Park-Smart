import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addHours, format } from 'date-fns';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { ArrowLeft, Car, CheckCircle2, Clock, MapPin, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI, parkingLocationsAPI, slotsAPI, vehiclesAPI } from '../../services/api';
import useAvailabilitySocket from '../../hooks/useAvailabilitySocket';
import {
  bookingPayloadForVehicle,
  isElectricVehicle,
  physicalVehicleType,
  shouldShowEVSlotBoard,
} from '../../utils/hybridParking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { CapacityLotMap, CapacityTimeline, EvLotMap, useCapacityTimeline } from '@/components/kit/lotmap';
import EmptyState from '@/components/kit/EmptyState';
import FormField from '@/components/kit/FormField';
import { CardGridSkeleton } from '@/components/kit/Loaders';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';
import TicketStub from '@/components/kit/TicketStub';
import { formatRupees } from '@/lib/bookings';
import { cn } from '@/lib/utils';
import { vehicleLabel } from '@/lib/vehicles';

const inputDate = (value) => format(new Date(value), "yyyy-MM-dd'T'HH:mm");
const windowLabel = (start, end) => {
  const s = new Date(start); const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  return `${format(s, 'EEE d MMM, HH:mm')}–${format(e, s.toDateString() === e.toDateString() ? 'HH:mm' : 'EEE d MMM, HH:mm')}`;
};

function Steps({ current }) {
  const steps = ['Vehicle and time', 'Your spot', 'Review'];
  return (
    <ol aria-label="Booking steps" className="mb-6 flex list-none flex-wrap items-center gap-x-3 gap-y-2 p-0 text-sm">
      {steps.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li key={label} aria-current={state === 'current' ? 'step' : undefined} className="flex items-center gap-2">
            <span className={cn(
              'grid size-7 place-items-center rounded-md font-mono text-xs font-semibold',
              state === 'done' && 'bg-slot-available-soft text-slot-available',
              state === 'current' && 'bg-brand text-brand-foreground',
              state === 'todo' && 'bg-surface-sunken text-text-muted',
            )}>
              {state === 'done' ? <CheckCircle2 aria-hidden="true" className="size-4" /> : index + 1}
            </span>
            <span className={cn(state === 'todo' ? 'text-text-muted' : 'text-foreground')}>
              {label}<span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ''}</span>
            </span>
            {index < steps.length - 1 && <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function Panel({ id, title, children, className }) {
  return (
    <section aria-labelledby={id} className={cn('rounded-2xl border bg-card p-5 shadow-hairline sm:p-6', className)}>
      <h2 id={id} className="mb-4 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function BookingPage({ legacy = false }) {
  const { locationId, slotId } = useParams();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  // Computed when the page opens, not when the module loads (audit N).
  const [defaults] = useState(() => { const start = addHours(new Date(), 1); return { start, end: addHours(start, 2) }; });
  const [location, setLocation] = useState(null);
  const [legacySlot, setLegacySlot] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [evSlotId, setEvSlotId] = useState('');
  const [startTime, setStartTime] = useState(inputDate(query.get('startTime') || defaults.start));
  const [endTime, setEndTime] = useState(inputDate(query.get('endTime') || defaults.end));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [arriving, setArriving] = useState(false);
  const [notice, setNotice] = useState('');
  const selectedRef = useRef('');

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
      .catch(() => { toast.error('Booking details didn’t load. Pick a location again.'); navigate('/dashboard/nearby'); })
      .finally(() => setLoading(false));
  }, [legacy, navigate, query, slotId]);

  const vehicle = vehicles.find((item) => item._id === vehicleId);
  useEffect(() => { selectedRef.current = evSlotId; }, [evSlotId]);

  const refreshAvailability = useCallback(async () => {
    if (legacy || !locationId || !vehicle || !startTime || !endTime) return;
    const { data } = await parkingLocationsAPI.getById(locationId, {
      vehicleType: physicalVehicleType(vehicle),
      fuelType: isElectricVehicle(vehicle) ? 'electric' : vehicle.fuelType,
      startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(),
    });
    setLocation(data.location);
    const evSlots = data.location.availability?.evSlots || [];
    const availableSlots = evSlots.filter((slot) => slot.available);
    // Same rule as before: a selection that is no longer free is cleared.
    // Now the driver is told why.
    const previous = selectedRef.current;
    if (previous && !availableSlots.some((slot) => slot._id === previous)) {
      const taken = evSlots.find((slot) => slot._id === previous);
      setNotice(`${taken?.slotNumber || 'That bay'} was just taken. Pick another bay.`);
    }
    setEvSlotId((current) => availableSlots.some((slot) => slot._id === current) ? current : '');
  }, [endTime, legacy, locationId, startTime, vehicle]);

  useEffect(() => {
    if (legacy || !locationId || !vehicle || !startTime || !endTime) return undefined;
    const timer = setTimeout(() => {
      refreshAvailability().catch((error) => { setLocation(null); toast.error(error.response?.data?.message || 'Availability didn’t load. Try another time.'); });
    }, 250);
    return () => clearTimeout(timer);
  }, [legacy, locationId, vehicle, startTime, endTime, refreshAvailability]);

  const isEv = isElectricVehicle(vehicle);
  const durationMs = new Date(endTime) - new Date(startTime);
  const timeline = useCapacityTimeline({ locationId, vehicle, durationMs, enabled: !legacy && Boolean(vehicle) && !isEv });

  useAvailabilitySocket({
    enabled: !legacy && Boolean(locationId) && Boolean(vehicle),
    locationId,
    debounceMs: 180,
    onChange: () => {
      refreshAvailability().catch(() => {});
      if (!isEv) timeline.reload();
    },
  });

  const hours = useMemo(() => Math.max(0, Math.ceil((new Date(endTime) - new Date(startTime)) / 3600000)), [startTime, endTime]);
  const rate = legacySlot?.pricePerHour ?? location?.pricePerHour ?? 0;
  const selectedEvSlot = location?.availability?.evSlots?.find((slot) => slot._id === evSlotId);
  const available = legacy ? legacySlot?.status === 'available' : Number(location?.availability?.available || 0) > 0;
  const timeError = new Date(endTime) <= new Date(startTime) ? 'Leave after you arrive.' : '';

  const selectBay = (id) => { setNotice(''); setEvSlotId(id); };
  const pickWindow = (start, end) => { setStartTime(inputDate(start)); setEndTime(inputDate(end)); };

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
      if (legacy) { navigate('/dashboard/bookings'); return; }
      // The car drives in, then the confirmation ticket appears.
      setConfirmation({ booking: response.data.booking, bay: isEv ? selectedEvSlot : null });
      // The booked bay is now reserved by us, not "taken" from us.
      selectedRef.current = '';
      setEvSlotId('');
      setArriving(true);
      refreshAvailability().catch(() => {});
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to reserve parking');
      if (isEv && [400, 409].includes(error.response?.status)) refreshAvailability().catch(() => {});
    } finally { setSubmitting(false); }
  };

  if (loading) return <CardGridSkeleton count={2} className="lg:grid-cols-2" />;

  const title = legacy ? `Legacy slot ${legacySlot?.slotNumber || ''}` : location?.name || 'Parking location';
  const address = legacy ? legacySlot?.location?.label : location?.address?.formattedAddress;
  const distanceKm = query.get('distanceKm');
  const windowText = windowLabel(startTime, endTime);
  const step = confirmation ? 3 : !vehicle || timeError ? 0 : (isEv && !evSlotId) || !available ? 1 : 2;
  const coords = location?.location?.coordinates;
  const vehicleKind = physicalVehicleType(vehicle) === 'motorcycle' ? 'motorcycle spaces' : 'car spaces';

  const summary = (
    <TicketStub
      stubLabel={isEv ? 'EV bay' : 'Any bay'}
      stubValue={isEv ? (confirmation?.bay?.slotNumber || selectedEvSlot?.slotNumber || '—') : <Car aria-label="Capacity booking" className="mx-auto size-6" />}
    >
      <p className="font-medium">{title}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-text-muted">Vehicle</dt><dd className="text-right font-mono">{vehicle?.licensePlate || '—'}</dd>
        <dt className="text-text-muted">When</dt><dd className="text-right">{windowText || '—'}</dd>
        <dt className="text-text-muted">Duration</dt><dd className="text-right">{hours} hour{hours === 1 ? '' : 's'}</dd>
        <dt className="text-text-muted">Rate</dt><dd className="text-right font-mono">{formatRupees(rate)}/hr</dd>
        <dt className="font-medium">Estimate</dt><dd className="text-right font-mono text-lg font-semibold">{formatRupees(hours * rate)}</dd>
      </dl>
      {!legacy && (
        <p className="mt-3 text-sm text-text-muted">
          {isEv
            ? (confirmation ? `${confirmation.bay?.slotNumber} reserved for you.` : selectedEvSlot ? `${selectedEvSlot.slotNumber} selected. It’s rechecked when you reserve.` : 'Pick a charging bay on the map.')
            : 'Space guaranteed. Bay assigned on arrival.'}
        </p>
      )}
    </TicketStub>
  );

  return (
    <>
      <PageHeader
        eyebrow={distanceKm ? `${distanceKm} km from your search` : 'Reserve'}
        title={title}
        description={address ? <span className="inline-flex items-start gap-1.5"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{address}</span> : 'Loading location details…'}
        actions={<Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft data-icon="inline-start" />Back</Button>}
      />
      <Steps current={step} />

      <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-6">
          <Panel id="vehicle-title" title="Vehicle and time">
            {!vehicles.length ? (
              <EmptyState title="Add a vehicle first" description="Your vehicle decides whether you reserve a space or an exact charging bay.">
                <Button asChild><Link to="/dashboard/vehicles">Add a vehicle</Link></Button>
              </EmptyState>
            ) : (
              <div className="grid gap-5">
                <FormField label="Your vehicle" description={vehicle ? vehicleLabel(vehicle) : undefined}>
                  <NativeSelect name="vehicleId" value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setNotice(''); }} required className="w-full">
                    <NativeSelectOption value="">Choose a vehicle</NativeSelectOption>
                    {vehicles.map((item) => <NativeSelectOption key={item._id} value={item._id}>{item.licensePlate} — {item.brand} {item.model}</NativeSelectOption>)}
                  </NativeSelect>
                </FormField>
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField label="Arrive">
                    <Input type="datetime-local" name="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                  </FormField>
                  <FormField label="Leave" error={timeError}>
                    <Input type="datetime-local" name="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                  </FormField>
                </div>
              </div>
            )}
          </Panel>

          {!legacy && location && vehicle && (
            <Panel id="spot-title" title={isEv ? 'Choose your charging bay' : 'Space at this location'}>
              {shouldShowEVSlotBoard(vehicle, legacy) ? (
                <div className="grid gap-4">
                  <EvLotMap
                    slots={location.availability.evSlots || []}
                    selectedId={evSlotId}
                    onSelect={selectBay}
                    rate={rate}
                    label={`Charging bays at ${location.name}`}
                    notice={notice}
                    aside={<StatusBadge status={location.availability.isOpen ? 'available' : 'unavailable'}>{location.availability.isOpen ? 'Open' : 'Closed for this time'}</StatusBadge>}
                    arrivingId={arriving && confirmation?.bay ? confirmation.bay._id : null}
                  />
                  <div aria-live="polite" className="rounded-xl border bg-surface p-4 text-sm">
                    {selectedEvSlot ? (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                        <div><dt className="text-text-muted">Bay</dt><dd className="font-mono font-semibold">{selectedEvSlot.slotNumber}</dd></div>
                        <div><dt className="text-text-muted">Charger</dt><dd>{selectedEvSlot.chargerPowerKw ? `${selectedEvSlot.chargerPowerKw} kW` : 'EV charger'} {selectedEvSlot.chargerType || ''}</dd></div>
                        <div><dt className="text-text-muted">Connector</dt><dd>{selectedEvSlot.connectorType || 'Not specified'}</dd></div>
                        <div><dt className="text-text-muted">Rate</dt><dd className="font-mono">{formatRupees(rate)}/hr</dd></div>
                      </dl>
                    ) : (
                      <p className="flex items-center gap-2 text-text-muted"><Zap aria-hidden="true" className="size-4 text-slot-ev" />Pick a free bay to see its charger. Availability is rechecked when you reserve.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <p className="flex items-start gap-2 text-sm text-text-muted">
                    <Car aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    Regular vehicles reserve capacity at this location; no numbered slot is assigned.
                  </p>
                  <CapacityLotMap
                    total={location.availability.total}
                    reserved={location.availability.reserved}
                    available={location.availability.available}
                    isOpen={location.availability.isOpen}
                    windowLabel={windowText}
                    vehicleLabel={vehicleKind}
                    arriving={arriving}
                  />
                  <div>
                    <h3 className="mb-1 font-medium">Pick a quieter time</h3>
                    <p className="mb-3 text-sm text-text-muted">Free spaces for the next few hours, for a {hours}-hour stay.</p>
                    <CapacityTimeline windows={timeline.windows} loading={timeline.loading} selectedStart={startTime} onPick={pickWindow} />
                  </div>
                </div>
              )}
            </Panel>
          )}

          {!legacy && location && (
            <Panel id="details-title" title="Location details">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid content-start gap-3 text-sm">
                  <p><span className="text-text-muted">Vehicles: </span>{location.vehicleTypes.map((type) => type.charAt(0).toUpperCase() + type.slice(1)).join(', ')}</p>
                  {(location.amenities || []).length > 0 && (
                    <ul className="flex list-none flex-wrap gap-1.5 p-0" aria-label="Amenities">
                      {location.amenities.map((item) => <li key={item} className="rounded-md bg-surface-sunken px-2 py-0.5 text-xs">{item.replaceAll('_', ' ')}</li>)}
                    </ul>
                  )}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-text-muted">
                    {Object.entries(location.operatingHours || {}).map(([day, value]) => (
                      <div key={day} className="contents">
                        <dt className="capitalize">{day}</dt>
                        <dd className="text-right font-mono">{!value.open ? 'Closed' : value.allDay ? '24 hours' : `${value.openTime}–${value.closeTime}`}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {coords && (
                  <div className="ps-map h-56 overflow-hidden rounded-xl border">
                    <MapContainer center={[coords[1], coords[0]]} zoom={15} dragging={false} scrollWheelZoom={false} className="size-full">
                      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <CircleMarker center={[coords[1], coords[0]]} radius={9} pathOptions={{ className: 'ps-map-marker' }} />
                    </MapContainer>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        <aside aria-label="Booking summary" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="grid gap-3">
            {summary}
            {confirmation ? (
              <div role="status" className="rounded-xl border border-slot-available/40 bg-slot-available-soft p-4">
                <p className="flex items-center gap-2 font-medium text-slot-available"><CheckCircle2 aria-hidden="true" className="size-5" />
                  {confirmation.bay ? `${confirmation.bay.slotNumber} reserved` : 'Space guaranteed. Bay assigned on arrival'}
                </p>
                <p className="mt-1 font-mono text-sm text-foreground">{confirmation.booking?.bookingCode}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => navigate('/dashboard/bookings')}>View my bookings</Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/dashboard/nearby')}>Find another</Button>
                </div>
              </div>
            ) : (
              <>
                <Button type="submit" size="lg" className="w-full" disabled={submitting || !available || !vehicleId || Boolean(timeError) || (isEv && !legacy && !evSlotId)}>
                  {submitting ? <><Spinner data-icon="inline-start" />Reserving…</>
                    : !available && location ? 'Full for this time'
                      : isEv && !legacy ? (evSlotId ? `Reserve ${selectedEvSlot?.slotNumber || 'bay'}` : 'Pick a charging bay') : 'Reserve a space'}
                </Button>
                {!available && location && !isEv && <p className="text-sm text-text-muted">Pick a time with free spaces from the timeline.</p>}
                <p className="flex items-start gap-2 text-xs text-text-muted"><Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />Payment isn’t collected in the app yet. The final amount is worked out from this rate at check-out.</p>
              </>
            )}
          </div>
        </aside>
      </form>
    </>
  );
}
