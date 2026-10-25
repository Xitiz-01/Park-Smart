import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import FormField from '@/components/kit/FormField';
import { CapacityMini } from '@/components/kit/lotmap';
import { cn } from '@/lib/utils';
import AddressLocationPicker, { emptyAddressSelection } from '../shared/AddressLocationPicker';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VEHICLES = [['car', 'Car'], ['motorcycle', 'Motorcycle'], ['ev', 'EV']];
const AMENITIES = [
  ['covered', 'Covered Parking'], ['cctv', 'CCTV'], ['security_guard', 'Security Guard'],
  ['ev_charging', 'EV Charging'], ['accessible', 'Accessible Parking'], ['24_7_access', '24/7 Access'],
];
const defaultHours = Object.fromEntries(DAYS.map((day) => [day, { open: true, allDay: false, openTime: '06:00', closeTime: '23:00' }]));

const canonicalVehicleType = (type) => ['car', 'suv'].includes(type) ? 'car' : ['bike', 'motorcycle'].includes(type) ? 'motorcycle' : type;
export const createInitialState = (location) => location ? {
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
  vehicleTypes: [...new Set((location.vehicleTypes || []).map(canonicalVehicleType))],
  pricing: {
    car: location.pricing?.car ?? location.pricing?.suv ?? 0,
    motorcycle: location.pricing?.motorcycle ?? location.pricing?.bike ?? 0,
    ev: location.pricing?.ev ?? 0,
  },
  capacity: {
    car: Number(location.capacity?.car || 0) + Number(location.capacity?.suv || 0),
    motorcycle: Number(location.capacity?.motorcycle || 0) + Number(location.capacity?.bike || 0),
  },
  evSupported: Boolean(location.evSupported),
  evDetails: location.evDetails || { slotCount: 0, chargerType: '' },
  amenities: location.amenities || [],
  operatingHours: location.operatingHours || defaultHours,
} : {
  name: '', description: '', address: emptyAddressSelection, vehicleTypes: ['car'], pricing: { car: 0 }, capacity: { car: 1 },
  evSupported: false, evDetails: { slotCount: 0, chargerType: '' }, amenities: [], operatingHours: defaultHours,
};

// The request body, unchanged from the single-page form.
export const locationPayload = (form) => ({
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
  capacity: form.capacity,
  evSupported: form.evSupported,
  evDetails: form.evDetails,
  amenities: form.amenities,
  operatingHours: form.operatingHours,
});

export const STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'address', label: 'Address and map' },
  { id: 'pricing', label: 'Prices and hours' },
  { id: 'capacity', label: 'Capacity and EV' },
  { id: 'review', label: 'Review' },
];

const dayLabel = (day) => day[0].toUpperCase() + day.slice(1);
const hoursText = (hours) => (!hours.open ? 'Closed' : hours.allDay ? 'Open 24 hours' : `${hours.openTime}–${hours.closeTime}`);

function StepNav({ step, reachable, onGo }) {
  return (
    <nav aria-label="Location editor steps" className="mb-6">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-2 p-0 text-sm sm:gap-x-2">
        {STEPS.map(({ id, label }, index) => {
          const state = index < step ? 'done' : index === step ? 'current' : 'todo';
          return (
            <li key={id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onGo(index)}
                disabled={index > reachable}
                aria-current={state === 'current' ? 'step' : undefined}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 enabled:hover:bg-surface-sunken disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-focus"
              >
                <span className={cn(
                  'grid size-7 place-items-center rounded-md font-mono text-xs font-semibold',
                  state === 'done' && 'bg-slot-available-soft text-slot-available',
                  state === 'current' && 'bg-brand text-brand-foreground',
                  state === 'todo' && 'bg-surface-sunken text-text-muted',
                )}>
                  {state === 'done' ? <Check aria-hidden="true" className="size-4" /> : index + 1}
                </span>
                <span className={cn(state === 'todo' ? 'text-text-muted' : 'text-foreground', state === 'current' ? 'font-medium' : 'max-sm:sr-only')}>
                  {label}<span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ''}</span>
                </span>
              </button>
              {index < STEPS.length - 1 && <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-border max-sm:hidden" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ChoiceChip({ checked, onChange, children }) {
  return (
    <label className={cn(
      'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
      checked ? 'border-brand bg-brand-soft text-brand-strong' : 'bg-surface-raised hover:bg-surface-sunken',
    )}>
      <Checkbox checked={checked} onCheckedChange={onChange} />
      {children}
    </label>
  );
}

function ReviewSection({ title, onEdit, children }) {
  return (
    <section className="border-t py-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}><Pencil data-icon="inline-start" />Edit<span className="sr-only"> {title.toLowerCase()}</span></Button>
      </div>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">{children}</dl>
    </section>
  );
}

const Row = ({ label, children }) => (
  <>
    <dt className="text-text-muted">{label}</dt>
    <dd className="m-0 break-words">{children}</dd>
  </>
);

export default function ParkingLocationForm({ initialLocation, onSubmit, saving }) {
  const initial = useMemo(() => createInitialState(initialLocation), [initialLocation]);
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  // New locations unlock steps in order; existing ones can jump anywhere.
  const [reachable, setReachable] = useState(initialLocation ? STEPS.length - 1 : 0);
  const [stepError, setStepError] = useState('');
  const formRef = useRef(null);
  const headingRef = useRef(null);

  // Five steps is a lot to lose: warn before the tab closes or reloads with
  // unsaved edits. (In-app links can't be guarded without a data router.)
  const submitted = useRef(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { if (!submitted.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const toggleVehicle = (type) => {
    const exists = form.vehicleTypes.includes(type);
    const vehicleTypes = exists ? form.vehicleTypes.filter((item) => item !== type) : [...form.vehicleTypes, type];
    setForm({
      ...form,
      vehicleTypes,
      pricing: !exists && form.pricing[type] === undefined ? { ...form.pricing, [type]: 0 } : form.pricing,
      capacity: !exists && type !== 'ev' && form.capacity[type] === undefined ? { ...form.capacity, [type]: 1 } : form.capacity,
      evSupported: type === 'ev' && !exists ? true : form.evSupported,
    });
  };
  const toggleAmenity = (value) => setForm({ ...form, amenities: form.amenities.includes(value) ? form.amenities.filter((item) => item !== value) : [...form.amenities, value] });
  const updateDay = (day, updates) => setForm({ ...form, operatingHours: { ...form.operatingHours, [day]: { ...form.operatingHours[day], ...updates } } });

  // Native validation for the fields on screen, plus the two rules the
  // browser can't check: a verified address and at least one vehicle type.
  const stepIsValid = () => {
    if (!formRef.current?.reportValidity()) return false;
    if (STEPS[step].id === 'address' && !form.address.verified) {
      setStepError('Pick one of the address suggestions so the location can be verified.');
      return false;
    }
    if (STEPS[step].id === 'pricing' && !form.vehicleTypes.length) {
      setStepError('Choose at least one vehicle type.');
      return false;
    }
    setStepError('');
    return true;
  };

  const goTo = (index) => {
    if (index > step && !stepIsValid()) return;
    setStepError('');
    setStep(index);
    setReachable((value) => Math.max(value, index));
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const submit = (event) => {
    event.preventDefault();
    if (STEPS[step].id !== 'review') { goTo(step + 1); return; }
    if (!form.address.verified) return;
    submitted.current = true;
    onSubmit(locationPayload(form));
  };

  const current = STEPS[step].id;
  const capacityTypes = VEHICLES.filter(([type]) => type !== 'ev' && form.vehicleTypes.includes(type));
  const canSave = !saving && form.address.verified && form.vehicleTypes.length > 0;

  return (
    <div>
      <StepNav step={step} reachable={reachable} onGo={goTo} />
      <form ref={formRef} onSubmit={submit} className="rounded-2xl border bg-card p-5 shadow-hairline sm:p-6">
        <h2 ref={headingRef} tabIndex={-1} className="mb-1 font-display text-xl font-semibold outline-none">{STEPS[step].label}</h2>
        <p className="mb-6 text-sm text-text-muted">Step {step + 1} of {STEPS.length}</p>

        {current === 'details' && (
          <div className="grid max-w-2xl gap-5">
            <FormField label="Location name" description="What drivers see on the map and their ticket." required>
              <Input name="name" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
            </FormField>
            <FormField label="Description" description="Entrance, height limits, how to find you. Optional.">
              <Textarea name="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
            </FormField>
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-sm font-medium">Amenities</legend>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map(([value, label]) => (
                  <ChoiceChip key={value} checked={form.amenities.includes(value)} onChange={() => toggleAmenity(value)}>{label}</ChoiceChip>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {current === 'address' && (
          <AddressLocationPicker value={form.address} onChange={(address) => setForm({ ...form, address })} />
        )}

        {current === 'pricing' && (
          <div className="grid gap-8">
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-sm font-medium">Vehicles you accept</legend>
              <div className="flex flex-wrap gap-2">
                {VEHICLES.map(([type, label]) => (
                  <ChoiceChip key={type} checked={form.vehicleTypes.includes(type)} onChange={() => toggleVehicle(type)}>{label}</ChoiceChip>
                ))}
              </div>
              <p className="mt-2 text-sm text-text-muted">Cars and motorcycles book a space from your capacity. EVs book an exact charging bay.</p>
            </fieldset>
            {form.vehicleTypes.length > 0 && (
              <div className="grid max-w-2xl gap-5 sm:grid-cols-3">
                {VEHICLES.filter(([type]) => form.vehicleTypes.includes(type)).map(([type, label]) => (
                  <FormField key={type} label={`${label}, ₹ per hour`} required>
                    <Input type="number" inputMode="decimal" min="0" step="0.01" className="font-mono" value={form.pricing[type] ?? ''} onChange={(e) => setForm({ ...form, pricing: { ...form.pricing, [type]: e.target.value } })} />
                  </FormField>
                ))}
              </div>
            )}
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-3 text-sm font-medium">Opening hours</legend>
              <ul className="m-0 grid list-none gap-2 p-0">
                {DAYS.map((day) => {
                  const hours = form.operatingHours[day] || defaultHours[day];
                  const timesDisabled = !hours.open || hours.allDay;
                  return (
                    <li key={day} className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-2 rounded-lg bg-surface-sunken px-3 py-2 sm:grid-cols-[6.5rem_7rem_7.5rem_minmax(0,18rem)]">
                      <span className="text-sm font-medium">{dayLabel(day)}</span>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={hours.open} onCheckedChange={(checked) => updateDay(day, { open: checked })} aria-label={`Open on ${dayLabel(day)}`} />
                        {hours.open ? 'Open' : 'Closed'}
                      </label>
                      <label className="col-start-2 flex items-center gap-2 text-sm sm:col-start-auto">
                        <Checkbox checked={hours.allDay} disabled={!hours.open} onCheckedChange={(checked) => updateDay(day, { allDay: checked === true })} />
                        24 hours
                      </label>
                      <div className="col-start-2 flex items-center gap-2 sm:col-start-auto">
                        <Input type="time" aria-label={`${dayLabel(day)} opens`} disabled={timesDisabled} value={hours.openTime} onChange={(e) => updateDay(day, { openTime: e.target.value })} className="w-full min-w-0 font-mono" />
                        <span aria-hidden="true" className="text-text-muted">–</span>
                        <Input type="time" aria-label={`${dayLabel(day)} closes`} disabled={timesDisabled} value={hours.closeTime} onChange={(e) => updateDay(day, { closeTime: e.target.value })} className="w-full min-w-0 font-mono" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          </div>
        )}

        {current === 'capacity' && (
          <div className="grid max-w-2xl gap-8">
            {capacityTypes.length > 0 ? (
              <div className="grid gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  {capacityTypes.map(([type, label]) => (
                    <FormField key={type} label={`${label} spaces`} required>
                      <Input type="number" inputMode="numeric" min="0" max="100000" step="1" className="font-mono" value={form.capacity[type] ?? ''} onChange={(e) => setForm({ ...form, capacity: { ...form.capacity, [type]: e.target.value } })} />
                    </FormField>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {capacityTypes.map(([type, label]) => {
                    const total = Math.max(0, Math.floor(Number(form.capacity[type]) || 0));
                    return (
                      <div key={type}>
                        <p className="mb-1.5 text-xs text-text-muted">{label} drivers see, when it’s empty</p>
                        <CapacityMini available={total} total={total} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No capacity to set: you only accept EVs, which book exact charging bays.</p>
            )}
            <fieldset className="m-0 grid gap-4 border-0 p-0">
              <legend className="sr-only">EV charging</legend>
              <label className="flex items-center gap-3 text-sm font-medium">
                <Switch checked={form.evSupported} onCheckedChange={(checked) => setForm({ ...form, evSupported: checked })} />
                EV charging available
              </label>
              {form.evSupported && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Planned EV bays">
                      <Input type="number" inputMode="numeric" min="0" className="font-mono" value={form.evDetails.slotCount} onChange={(e) => setForm({ ...form, evDetails: { ...form.evDetails, slotCount: e.target.value } })} />
                    </FormField>
                    <FormField label="Charger type">
                      <Input value={form.evDetails.chargerType} onChange={(e) => setForm({ ...form, evDetails: { ...form.evDetails, chargerType: e.target.value } })} placeholder="e.g. CCS2…" autoComplete="off" />
                    </FormField>
                  </div>
                  <p className="text-sm text-text-muted">You add the exact charging bays on the EV bays page once this location is live.</p>
                </>
              )}
            </fieldset>
          </div>
        )}

        {current === 'review' && (
          <div className="max-w-3xl">
            <ReviewSection title="Details" onEdit={() => goTo(0)}>
              <Row label="Name">{form.name}</Row>
              <Row label="Description">{form.description || <span className="text-text-muted">None</span>}</Row>
              <Row label="Amenities">{form.amenities.length ? AMENITIES.filter(([value]) => form.amenities.includes(value)).map(([, label]) => label).join(', ') : <span className="text-text-muted">None</span>}</Row>
            </ReviewSection>
            <ReviewSection title="Address" onEdit={() => goTo(1)}>
              <Row label="Address">{form.address.formattedAddress || form.address.search}</Row>
              <Row label="City, state">{[form.address.city, form.address.state, form.address.pincode].filter(Boolean).join(', ')}</Row>
              <Row label="Pin">{form.address.verified ? <span className="font-mono">{Number(form.address.latitude).toFixed(5)}, {Number(form.address.longitude).toFixed(5)}</span> : <span className="text-danger">Not verified</span>}</Row>
            </ReviewSection>
            <ReviewSection title="Prices and hours" onEdit={() => goTo(2)}>
              {VEHICLES.filter(([type]) => form.vehicleTypes.includes(type)).map(([type, label]) => (
                <Row key={type} label={label}><span className="font-mono">₹{form.pricing[type] ?? 0}</span> per hour</Row>
              ))}
              {DAYS.map((day) => <Row key={day} label={dayLabel(day)}>{hoursText(form.operatingHours[day] || defaultHours[day])}</Row>)}
            </ReviewSection>
            <ReviewSection title="Capacity and EV" onEdit={() => goTo(3)}>
              {capacityTypes.map(([type, label]) => <Row key={type} label={`${label} spaces`}><span className="font-mono">{form.capacity[type] ?? 0}</span></Row>)}
              <Row label="EV charging">{form.evSupported ? `Yes, ${form.evDetails.slotCount || 0} bays planned${form.evDetails.chargerType ? `, ${form.evDetails.chargerType}` : ''}` : 'No'}</Row>
            </ReviewSection>
          </div>
        )}

        {stepError && <p role="alert" className="mt-5 text-sm text-danger">{stepError}</p>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <Button type="button" variant="outline" onClick={() => goTo(step - 1)} disabled={step === 0}>
            <ArrowLeft data-icon="inline-start" />Back
          </Button>
          {current === 'review' ? (
            <Button type="submit" disabled={!canSave}>
              {saving && <Spinner data-icon="inline-start" />}
              {saving ? 'Saving…' : initialLocation ? 'Save changes' : 'Create location'}
            </Button>
          ) : (
            <Button type="submit">Next: {STEPS[step + 1].label}<ArrowRight data-icon="inline-end" /></Button>
          )}
        </div>
        {current === 'review' && !form.address.verified && <p className="mt-3 text-right text-sm text-danger">Verify the address before saving.</p>}
      </form>
    </div>
  );
}
