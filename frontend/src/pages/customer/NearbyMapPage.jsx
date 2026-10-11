import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { addHours, addMinutes, format } from 'date-fns';
import { Bike, Car, List, LocateFixed, Map as MapIcon, MapPin, Search, SlidersHorizontal, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { parkingLocationsAPI, vehiclesAPI } from '../../services/api';
import useAvailabilitySocket from '../../hooks/useAvailabilitySocket';
import {
  isElectricVehicle,
  parkingDetailsPath,
  physicalVehicleType,
  vehicleClassificationLabel,
} from '../../utils/hybridParking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CapacityMini } from '@/components/kit/lotmap';
import EmptyState from '@/components/kit/EmptyState';
import FormField from '@/components/kit/FormField';
import { ListSkeleton } from '@/components/kit/Loaders';
import PageHeader from '@/components/kit/PageHeader';
import { formatRupees } from '@/lib/bookings';
import { readDiscoveryCache, writeDiscoveryCache } from '@/lib/discoveryCache';
import { cn } from '@/lib/utils';

const DEFAULT_CENTER = { lat: 18.5204, lng: 73.8567 };
const RADII = [2, 5, 10, 25, 50];
const AMENITIES = [['covered', 'Covered'], ['cctv', 'CCTV'], ['security_guard', 'Security guard'], ['accessible', 'Accessible'], ['ev_charging', 'EV charging']];
const SORTS = [['nearest', 'Nearest'], ['lowest_price', 'Lowest price'], ['highest_availability', 'Most free']];
const dateInput = (date) => format(date, "yyyy-MM-dd'T'HH:mm");

// How full a location is, for marker and meter colour (always paired with a count).
export const availabilityTone = (availability) => {
  if (!availability?.isOpen) return 'closed';
  if (!availability.available) return 'full';
  if (availability.total && availability.available / availability.total < 0.15) return 'low';
  return 'free';
};

// Price-pill marker coloured by availability; styled in globals.css with tokens.
const priceIcon = (location, active) => L.divIcon({
  className: '',
  html: `<span class="ps-pin ps-pin-${availabilityTone(location.availability)}${active ? ' ps-pin-active' : ''}">₹${Number(location.pricePerHour) || 0}</span>`,
  iconSize: null,
  iconAnchor: [24, 16],
});
const originIcon = L.divIcon({ className: '', html: '<span class="ps-origin" aria-hidden="true"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { map.setView([center.lat, center.lng], 14); }, [center, map]);
  return null;
}

const VehicleIcon = ({ vehicle, className }) => {
  if (isElectricVehicle(vehicle)) return <Zap aria-hidden="true" className={className} />;
  if (physicalVehicleType(vehicle) === 'motorcycle') return <Bike aria-hidden="true" className={className} />;
  return <Car aria-hidden="true" className={className} />;
};

function ResultCard({ location, href, ev, active, onHover, cardRef }) {
  const { availability } = location;
  const tone = availabilityTone(availability);
  const share = availability.total ? availability.available / availability.total : 0;
  return (
    <article
      ref={cardRef}
      onMouseEnter={() => onHover(location._id)}
      onFocus={() => onHover(location._id)}
      className={cn('rounded-xl border bg-card p-4 transition-[border-color,box-shadow]', active && 'border-brand shadow-raised')}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-medium">{location.name}</h3>
        <p className="shrink-0 text-right"><span className="font-mono font-semibold">{formatRupees(location.pricePerHour)}</span><span className="text-sm text-text-muted">/hr</span></p>
      </div>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-text-muted">
        <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0 break-words">{location.address?.formattedAddress}</span>
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
          <div className={cn('h-full rounded-full', tone === 'free' ? 'bg-slot-available' : tone === 'low' ? 'bg-slot-reserved-solid' : 'bg-transparent')} style={{ width: `${share * 100}%` }} />
        </div>
        <p className="shrink-0 text-sm">
          {availability.isOpen
            ? <><span className="font-mono font-semibold">{availability.available}</span> of <span className="font-mono">{availability.total}</span> free</>
            : 'Closed for this time'}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
        <span>{location.distanceKm} km away</span>
        {location.evSupported && <span className="inline-flex items-center gap-1 text-slot-ev"><Zap aria-hidden="true" className="size-3.5" />EV bays</span>}
        {ev && <span>Pick your exact charging bay when you book</span>}
      </div>
      <Button asChild size="sm" className="mt-4 w-full"><Link to={href}>View and reserve</Link></Button>
    </article>
  );
}

export default function NearbyMapPage() {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [filters, setFilters] = useState(() => ({
    radiusKm: 10, startTime: dateInput(addHours(new Date(), 1)),
    endTime: dateInput(addHours(new Date(), 3)), sort: 'nearest', amenities: '',
    maxPrice: '', available: true, evOnly: false,
  }));
  const [draft, setDraft] = useState(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const cardRefs = useRef({});
  const selectedVehicle = vehicles.find((vehicle) => vehicle._id === vehicleId);

  const fetchLocations = useCallback(async (coords = center, next = filters, vehicle = selectedVehicle) => {
    if (!vehicle) {
      setLocations([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = {
        ...next, lat: coords.lat, lng: coords.lng,
        vehicleType: physicalVehicleType(vehicle),
        fuelType: isElectricVehicle(vehicle) ? 'electric' : vehicle.fuelType,
        ev: next.evOnly,
        startTime: new Date(next.startTime).toISOString(), endTime: new Date(next.endTime).toISOString(),
        amenities: next.amenities, available: next.available,
      };
      delete params.evOnly;
      if (!params.fuelType) delete params.fuelType;
      if (!params.maxPrice) delete params.maxPrice;
      const { data } = await parkingLocationsAPI.getNearby(params);
      setLocations(data.locations || []);
      setCached(false);
      writeDiscoveryCache({ center: coords, filters: next, vehicleId: vehicle._id, locations: data.locations, savedAt: new Date().toISOString() });
    } catch (error) {
      const saved = readDiscoveryCache();
      if (saved && saved.vehicleId === vehicle._id) {
        setLocations(saved.locations || []);
        setCenter(saved.center || coords);
        setCached(true);
        toast('Showing last synced discovery results');
        return;
      }
      toast.error(error.response?.data?.message || 'Unable to discover parking');
    } finally { setLoading(false); }
  }, [center, filters, selectedVehicle]);

  const locate = useCallback((vehicle = selectedVehicle) => {
    if (!navigator.geolocation) return fetchLocations(DEFAULT_CENTER, filters, vehicle);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const next = { lat: coords.latitude, lng: coords.longitude };
      setCenter(next);
      fetchLocations(next, filters, vehicle);
    }, () => {
      toast('Location access was unavailable. Showing Pune.');
      fetchLocations(DEFAULT_CENTER, filters, vehicle);
    }, { enableHighAccuracy: true, timeout: 10000 });
  }, [fetchLocations, filters, selectedVehicle]);

  useEffect(() => {
    vehiclesAPI.getAll().then(({ data }) => {
      const list = data.vehicles || [];
      const preferred = list.find((vehicle) => vehicle.isDefault) || list[0];
      setVehicles(list);
      setVehicleId(preferred?._id || '');
      if (preferred) locate(preferred);
      else setLoading(false);
    }).catch(() => { setLoading(false); toast.error('Unable to load your vehicles'); });
  }, []);
  useAvailabilitySocket({ debounceMs: 300, onChange: () => fetchLocations() });

  const queryFor = useCallback((location) => parkingDetailsPath(location._id, {
    ...filters,
    vehicleId: selectedVehicle?._id,
    vehicleType: physicalVehicleType(selectedVehicle),
    fuelType: isElectricVehicle(selectedVehicle) ? 'electric' : selectedVehicle?.fuelType,
    distanceKm: location.distanceKm,
  }), [filters, selectedVehicle]);

  // Time presets keep the current stay length and search straight away.
  const durationMs = Math.max(3600000, new Date(filters.endTime) - new Date(filters.startTime) || 7200000);
  const applyStart = (start) => {
    const next = { ...filters, startTime: dateInput(start), endTime: dateInput(new Date(start.getTime() + durationMs)) };
    setFilters(next); setDraft(next);
    fetchLocations(center, next);
  };
  const presets = [
    { id: 'now', label: 'Now', start: () => addMinutes(new Date(), 2) },
    { id: 'h1', label: 'In 1 h', start: () => addHours(new Date(), 1) },
    { id: 'h2', label: 'In 2 h', start: () => addHours(new Date(), 2) },
  ];

  const chooseVehicle = (id) => {
    setVehicleId(id);
    const vehicle = vehicles.find((item) => item._id === id);
    if (vehicle) fetchLocations(center, filters, vehicle);
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setFilters(draft);
    setFiltersOpen(false);
    fetchLocations(center, draft);
  };

  const resultText = useMemo(() => loading ? 'Checking live capacity…' : `${locations.length} reservable location${locations.length === 1 ? '' : 's'}`, [loading, locations.length]);
  const activeFilterCount = [filters.radiusKm !== 10, filters.sort !== 'nearest', Boolean(filters.maxPrice), Boolean(filters.amenities), !filters.available, filters.evOnly].filter(Boolean).length;
  const ev = isElectricVehicle(selectedVehicle);

  const focusLocation = (id) => {
    setActiveId(id);
    setMobileView('list');
    cardRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  return (
    <>
      <PageHeader
        eyebrow="Driver"
        title="Find parking"
        description={<>{resultText}<span className="text-text-muted"> · {cached ? 'cached result' : 'live vendor inventory'}</span></>}
      />

      {/* Search bar: vehicle, time, filters */}
      <form
        onSubmit={(event) => { event.preventDefault(); fetchLocations(); }}
        className="mb-4 flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-hairline lg:flex-row lg:items-center"
        aria-label="Search parking"
      >
        <div className="flex min-w-0 items-center gap-2 lg:w-72">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-strong pointer-coarse:size-11">
            <VehicleIcon vehicle={selectedVehicle} className="size-5" />
          </span>
          <label htmlFor="nearby-vehicle" className="sr-only">Vehicle</label>
          <NativeSelect id="nearby-vehicle" value={vehicleId} onChange={(e) => chooseVehicle(e.target.value)} required className="w-full min-w-0">
            <NativeSelectOption value="">Choose a vehicle</NativeSelectOption>
            {vehicles.map((vehicle) => <NativeSelectOption key={vehicle._id} value={vehicle._id}>{vehicle.licensePlate} — {vehicleClassificationLabel(vehicle)}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" variant="outline" aria-label="Arrival time" className="flex-wrap" onValueChange={(id) => { const preset = presets.find((p) => p.id === id); if (preset) applyStart(preset.start()); }}>
            {presets.map((preset) => <ToggleGroupItem key={preset.id} value={preset.id}>{preset.label}</ToggleGroupItem>)}
          </ToggleGroup>
          <Popover>
            <PopoverTrigger asChild><Button type="button" variant="outline">{format(new Date(filters.startTime), 'EEE HH:mm')}–{format(new Date(filters.endTime), 'HH:mm')}</Button></PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <div className="grid gap-4">
                <FormField label="Arrive"><Input type="datetime-local" value={filters.startTime} onChange={(e) => { setFilters({ ...filters, startTime: e.target.value }); setDraft({ ...draft, startTime: e.target.value }); }} required /></FormField>
                <FormField label="Leave"><Input type="datetime-local" value={filters.endTime} onChange={(e) => { setFilters({ ...filters, endTime: e.target.value }); setDraft({ ...draft, endTime: e.target.value }); }} required /></FormField>
                {/* The popover renders outside the form, so search directly. */}
                <Button type="button" onClick={() => fetchLocations(center, filters)}>Search this time</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Popover open={filtersOpen} onOpenChange={(open) => { setFiltersOpen(open); if (open) setDraft(filters); }}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline"><SlidersHorizontal data-icon="inline-start" />Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <span id="radius-label" className="text-sm font-medium">Within <span className="font-mono">{draft.radiusKm} km</span></span>
                  <Slider aria-labelledby="radius-label" min={0} max={RADII.length - 1} step={1} value={[Math.max(0, RADII.indexOf(Number(draft.radiusKm)))]} onValueChange={([index]) => setDraft({ ...draft, radiusKm: RADII[index] })} />
                </div>
                <div className="grid gap-2">
                  <span id="sort-label" className="text-sm font-medium">Sort by</span>
                  <ToggleGroup aria-labelledby="sort-label" type="single" variant="outline" value={draft.sort} onValueChange={(value) => value && setDraft({ ...draft, sort: value })} className="flex-wrap">
                    {SORTS.map(([value, label]) => <ToggleGroupItem key={value} value={value}>{label}</ToggleGroupItem>)}
                  </ToggleGroup>
                </div>
                <FormField label="Max price per hour" description="Leave empty for any price.">
                  <Input type="number" min="0" inputMode="numeric" value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} placeholder="Any" />
                </FormField>
                <div className="grid gap-2">
                  <span id="amenity-label" className="text-sm font-medium">Must have</span>
                  <ToggleGroup aria-labelledby="amenity-label" type="single" variant="outline" value={draft.amenities} onValueChange={(value) => setDraft({ ...draft, amenities: value || '' })} className="flex-wrap justify-start">
                    {AMENITIES.map(([value, label]) => <ToggleGroupItem key={value} value={value} size="sm">{label}</ToggleGroupItem>)}
                  </ToggleGroup>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm">Available spaces only<Switch checked={draft.available} onCheckedChange={(value) => setDraft({ ...draft, available: value })} /></label>
                <label className="flex items-center justify-between gap-3 text-sm">EV-capable locations only<Switch checked={draft.evOnly} onCheckedChange={(value) => setDraft({ ...draft, evOnly: value })} /></label>
                <Button type="button" onClick={applyFilters}>Show results</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button type="button" variant="outline" onClick={() => locate()}><LocateFixed data-icon="inline-start" />My location</Button>
          <Button type="submit"><Search data-icon="inline-start" />Search</Button>
        </div>
      </form>

      {/* Phones: list or map */}
      <ToggleGroup type="single" variant="outline" value={mobileView} onValueChange={(value) => value && setMobileView(value)} aria-label="Show" className="mb-3 w-full lg:hidden">
        <ToggleGroupItem value="list" className="flex-1"><List aria-hidden="true" />List</ToggleGroupItem>
        <ToggleGroupItem value="map" className="flex-1"><MapIcon aria-hidden="true" />Map</ToggleGroupItem>
      </ToggleGroup>

      <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-16rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <section aria-label="Parking results" className={cn('min-w-0 overflow-y-auto lg:pr-1', mobileView === 'map' && 'max-lg:hidden')}>
          {loading && !locations.length ? <ListSkeleton rows={3} /> : locations.length === 0 ? (
            <EmptyState title="No parking matches this time" description="Try a wider radius, another time, or clear a filter." />
          ) : (
            <ul className="grid list-none grid-cols-1 gap-3 p-0">
              {locations.map((location) => (
                <li key={location._id}>
                  <ResultCard
                    location={location}
                    href={queryFor(location)}
                    ev={ev}
                    active={activeId === location._id}
                    onHover={setActiveId}
                    cardRef={(node) => { cardRefs.current[location._id] = node; }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className={cn('ps-map relative h-[60vh] min-h-80 overflow-hidden rounded-2xl border lg:h-full', mobileView === 'list' && 'max-lg:hidden')}>
          <MapContainer center={[center.lat, center.lng]} zoom={14} className="size-full">
            <Recenter center={center} />
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Circle center={[center.lat, center.lng]} radius={Number(filters.radiusKm) * 1000} pathOptions={{ className: 'ps-map-radius' }} />
            <Marker position={[center.lat, center.lng]} icon={originIcon} title="Your search origin"><Popup>Your search origin</Popup></Marker>
            {locations.map((location) => (
              <Marker
                key={location._id}
                position={[location.location.coordinates[1], location.location.coordinates[0]]}
                icon={priceIcon(location, activeId === location._id)}
                title={`${location.name}, ${formatRupees(location.pricePerHour)} per hour`}
                eventHandlers={{ click: () => focusLocation(location._id) }}
              >
                <Popup>
                  <div className="grid w-52 gap-2">
                    <strong className="font-medium">{location.name}</strong>
                    <CapacityMini available={location.availability.available} total={location.availability.total} />
                    <span className="text-sm">{formatRupees(location.pricePerHour)}/hr · {location.distanceKm} km</span>
                    <Link to={queryFor(location)} className="font-medium text-brand-strong underline-offset-4 hover:underline">Reserve</Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </>
  );
}
