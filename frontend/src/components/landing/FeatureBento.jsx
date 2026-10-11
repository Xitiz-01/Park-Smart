import { useState } from 'react';
import { Bike, Car, MapPin, ShieldCheck, Zap } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SlotBoard, SlotTile } from '@/components/kit/SlotBoard';
import StatusBadge from '@/components/kit/StatusBadge';
import { cn } from '@/lib/utils';

// Each cell shows the real thing (kit components with sample data) rather
// than an icon and a paragraph. All sample data is labelled illustrative.

function Cell({ title, body, className, children }) {
  return (
    <article className={cn('flex flex-col overflow-hidden rounded-2xl border bg-card shadow-hairline', className)}>
      <div className="p-6 pb-0">
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <p className="mt-2 max-w-md text-pretty text-text-muted">{body}</p>
      </div>
      <div className="mt-6 flex-1 p-6 pt-0">{children}</div>
    </article>
  );
}

function Illustrative() {
  return <p className="mb-3 text-xs text-text-muted">Illustrative</p>;
}

const locations = [
  { name: 'Riverside Multilevel', distance: '0.4 km', free: 12, total: 40, rate: 60, ev: true },
  { name: 'Station Road Surface Lot', distance: '1.1 km', free: 3, total: 25, rate: 40, ev: false },
];

function Availability() {
  return (
    <div>
      <Illustrative />
      <ul className="grid gap-3">
        {locations.map((loc) => {
          const share = loc.free / loc.total;
          const tone = share < 0.15 ? 'bg-slot-reserved-solid' : 'bg-slot-available';
          return (
            <li key={loc.name} className="rounded-xl border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{loc.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-text-muted">
                    <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="size-3.5" />{loc.distance}</span>
                    {loc.ev && <span className="inline-flex items-center gap-1 text-slot-ev"><Zap aria-hidden="true" className="size-3.5" />EV bays</span>}
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="font-mono text-lg font-semibold">₹{loc.rate}</span>
                  <span className="text-sm text-text-muted">/hr</span>
                </p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                  <div className={cn('h-full rounded-full', tone)} style={{ width: `${share * 100}%` }} />
                </div>
                <p className="text-sm"><span className="font-mono font-semibold">{loc.free}</span> of <span className="font-mono">{loc.total}</span> free</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const pins = [
  { x: 18, y: 30, price: 60, tone: 'available' },
  { x: 62, y: 22, price: 40, tone: 'reserved' },
  { x: 44, y: 62, price: 50, tone: 'available' },
  { x: 78, y: 70, price: 80, tone: 'occupied' },
];
const pinTone = {
  available: 'bg-slot-available-soft text-slot-available ring-1 ring-slot-available/40',
  reserved: 'bg-slot-reserved-soft text-slot-reserved ring-1 ring-slot-reserved/40',
  occupied: 'bg-surface-raised text-text-muted ring-1 ring-border',
};

function MiniMap() {
  return (
    <div>
      <Illustrative />
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-surface-sunken">
        <svg viewBox="0 0 100 75" aria-hidden="true" className="absolute inset-0 size-full text-border">
          <path d="M-5 40 C 25 35, 45 50, 105 42" fill="none" stroke="currentColor" strokeWidth="5" />
          <path d="M35 -5 C 38 25, 30 55, 42 80" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M70 -5 L 66 80" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="50" cy="42" r="2.5" className="fill-brand" />
          <circle cx="50" cy="42" r="7" className="fill-brand" opacity="0.15" />
        </svg>
        {pins.map((pin) => (
          <span
            key={`${pin.x}-${pin.y}`}
            className={cn('absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 font-mono text-xs font-semibold shadow-raised', pinTone[pin.tone])}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          >
            ₹{pin.price}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm text-text-muted">Pins show the hourly rate, coloured by how much space is left.</p>
    </div>
  );
}

const sampleBays = [
  { value: 'ev1', id: 'EV01', powerKw: 22, meta: 'Type 2', state: 'available' },
  { value: 'ev2', id: 'EV02', powerKw: 60, meta: 'CCS2', state: 'available' },
  { value: 'ev3', id: 'EV03', powerKw: 22, meta: 'Type 2', state: 'reserved' },
  { value: 'ev4', id: 'EV04', powerKw: 22, meta: 'Type 2', state: 'maintenance' },
];

function EvBays() {
  const [selected, setSelected] = useState('ev2');
  return (
    <div>
      <Illustrative />
      <SlotBoard label="Sample EV charging bays" onValueChange={setSelected} className="sm:grid-cols-2 xl:grid-cols-4">
        {sampleBays.map((bay) => (
          <SlotTile key={bay.value} {...bay} ev detail={`${bay.powerKw} kW`} state={bay.state === 'available' && bay.value === selected ? 'selected' : bay.state} />
        ))}
      </SlotBoard>
    </div>
  );
}

const vehicles = {
  petrol: { label: 'Petrol car', icon: Car, result: 'Reserves a space from the location’s car capacity.' },
  bike: { label: 'Motorcycle', icon: Bike, result: 'Reserves a space from the motorcycle capacity.' },
  electric: { label: 'Electric car', icon: Zap, result: 'Picks an exact charging bay, with its power and connector.' },
};

function VehicleAware() {
  const [vehicle, setVehicle] = useState('electric');
  const current = vehicles[vehicle];
  return (
    <div>
      <ToggleGroup type="single" variant="outline" value={vehicle} onValueChange={(value) => value && setVehicle(value)} aria-label="Vehicle" className="flex-wrap">
        {Object.entries(vehicles).map(([key, { label, icon: Icon }]) => (
          <ToggleGroupItem key={key} value={key}><Icon aria-hidden="true" />{label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="mt-4 rounded-xl border bg-surface p-4 text-foreground" aria-live="polite">{current.result}</p>
    </div>
  );
}

const events = [
  { bay: 'B4', status: 'reserved', text: 'reserved for 10:00–12:00' },
  { bay: 'A5', status: 'occupied', text: 'checked in' },
  { bay: 'C2', status: 'available', text: 'checked out, free again' },
];

function LiveUpdates() {
  return (
    <div>
      <Illustrative />
      <ol className="grid gap-2">
        {events.map((event) => (
          <li key={event.bay} className="flex items-center justify-between gap-3 rounded-lg border bg-surface px-3 py-2.5 text-sm">
            <span className="min-w-0"><span className="font-mono font-semibold">{event.bay}</span> {event.text}</span>
            <StatusBadge status={event.status} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Operators() {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-surface p-4">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-lg bg-slot-available-soft text-slot-available"><ShieldCheck className="size-5" /></span>
      <div className="min-w-0">
        <p className="font-medium">Each location is authorised separately</p>
        <p className="text-sm text-text-muted">Operators prove they can run a site before it takes bookings.</p>
      </div>
      <StatusBadge status="verified" className="ml-auto hidden sm:inline-flex" />
    </div>
  );
}

export default function FeatureBento() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <h2 id="features-title" className="max-w-2xl font-display text-display-xl font-semibold text-balance">Know what’s free before you leave.</h2>
        <p className="mt-4 max-w-2xl text-lg text-text-muted">Live counts, real bays, and the right kind of space for the vehicle you’re driving.</p>
        <div className="mt-12 grid gap-4 lg:grid-cols-6">
          <Cell className="lg:col-span-4" title="Live availability" body="Every location shows how many spaces are free for your time window and what it costs per hour.">
            <Availability />
          </Cell>
          <Cell className="lg:col-span-2" title="On the map" body="Browse what’s around you, or around where you’re going.">
            <MiniMap />
          </Cell>
          <Cell className="lg:col-span-3" title="Choose your charging bay" body="EV drivers see each charger’s power and connector, and reserve that exact bay.">
            <EvBays />
          </Cell>
          <Cell className="lg:col-span-3" title="Matched to your vehicle" body="Your vehicle decides how you book, so you never reserve a space that doesn’t fit.">
            <VehicleAware />
          </Cell>
          <Cell className="lg:col-span-3" title="Updates as it happens" body="Bookings, check-ins and check-outs update open pages straight away, without a refresh.">
            <LiveUpdates />
          </Cell>
          <Cell className="lg:col-span-3" title="Verified operators" body="Operators are reviewed by ParkSmart before any of their locations go live.">
            <Operators />
          </Cell>
        </div>
      </div>
    </section>
  );
}
