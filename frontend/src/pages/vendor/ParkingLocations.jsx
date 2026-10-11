import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, MapPin, Pencil, Plus, Send, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { vendorsAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import { CardGridSkeleton } from '@/components/kit/Loaders';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';

const STATUS_LABELS = { active: 'Live', draft: 'Draft', inactive: 'Inactive' };
const VEHICLE_LABELS = { car: 'Car', motorcycle: 'Motorcycle', ev: 'EV', suv: 'SUV', bike: 'Bike' };

function LocationCard({ location, publishing, publishError, onPublish }) {
  const evBays = location.slotStats?.total || 0;
  return (
    <article className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-hairline">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold break-words">{location.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-muted">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{[location.address?.city, location.address?.state].filter(Boolean).join(', ')}</span>
          </p>
        </div>
        <StatusBadge status={location.status}>{STATUS_LABELS[location.status] || undefined}</StatusBadge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-surface-sunken p-3">
          <dt className="flex items-center gap-1.5 text-text-muted"><Car aria-hidden="true" className="size-3.5" />Capacity</dt>
          <dd className="m-0 mt-1 font-mono text-lg font-semibold tabular-nums">{location.regularCapacity || 0}<span className="ml-1 font-sans text-sm font-normal text-text-muted">spaces</span></dd>
        </div>
        <div className="rounded-lg bg-surface-sunken p-3">
          <dt className="flex items-center gap-1.5 text-text-muted"><Zap aria-hidden="true" className="size-3.5" />EV bays</dt>
          <dd className="m-0 mt-1 font-mono text-lg font-semibold tabular-nums">{evBays}<span className="ml-1 font-sans text-sm font-normal text-text-muted">{evBays ? `${location.slotStats.available} available` : 'set up'}</span></dd>
        </div>
      </dl>

      {location.vehicleTypes?.length > 0 && (
        <ul aria-label="Hourly prices" className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm">
          {location.vehicleTypes.map((type) => (
            <li key={type}>
              <span className="text-text-muted">{VEHICLE_LABELS[type] || type}</span>{' '}
              <span className="font-mono font-semibold">₹{location.pricing?.[type] ?? 0}</span><span className="text-text-muted">/hr</span>
            </li>
          ))}
        </ul>
      )}

      {location.status === 'draft' && (
        <div className="mt-4 rounded-lg border border-dashed p-3 text-sm">
          <p className="font-medium text-foreground">Drivers can’t see this location yet.</p>
          <p className="mt-1 text-text-muted">
            Publishing needs your vendor verification (identity, business and bank) and an approved authorisation document for this location.
          </p>
          <Link to="/vendor/verification" className="mt-1 inline-block font-medium text-brand hover:underline">Open verification</Link>
          {publishError && <p role="alert" className="mt-2 text-danger">{publishError}</p>}
        </div>
      )}
      {location.status === 'inactive' && (
        <p className="mt-4 rounded-lg bg-surface-sunken p-3 text-sm text-text-muted">Deactivated. Drivers can’t book here and its EV bays are in maintenance.</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button asChild variant="outline" size="sm">
          <Link to={`/vendor/locations/${location._id}/edit`}><Pencil data-icon="inline-start" />Edit<span className="sr-only"> {location.name}</span></Link>
        </Button>
        {location.status === 'draft' && (
          <Button size="sm" onClick={() => onPublish(location)} disabled={publishing}>
            {publishing ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
            {publishing ? 'Publishing…' : 'Publish'}<span className="sr-only"> {location.name}</span>
          </Button>
        )}
        {location.evSupported && location.status === 'active' && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/vendor/slots?location=${location._id}`}><Zap data-icon="inline-start" />EV bays<span className="sr-only"> at {location.name}</span></Link>
          </Button>
        )}
      </div>
    </article>
  );
}

export default function ParkingLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [publishing, setPublishing] = useState('');
  const [publishErrors, setPublishErrors] = useState({});

  const load = useCallback(() => {
    setFailed(false);
    vendorsAPI.getLocations()
      .then(({ data }) => setLocations(data.locations))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const publish = async (location) => {
    const id = location._id;
    setPublishing(id);
    setPublishErrors((errors) => ({ ...errors, [id]: '' }));
    try {
      const { data } = await vendorsAPI.publishLocation(id);
      setLocations((items) => items.map((item) => (item._id === id ? { ...item, ...data.location } : item)));
      toast.success(`${location.name} is live`);
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to publish location';
      setPublishErrors((errors) => ({ ...errors, [id]: message }));
      toast.error(message);
    } finally {
      setPublishing('');
    }
  };

  const live = locations.filter((location) => location.status === 'active').length;

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Parking locations"
        description={loading ? 'Loading your locations…' : `${locations.length} location${locations.length === 1 ? '' : 's'}, ${live} live. Each one has its own address, prices, hours and capacity.`}
        actions={<Button asChild><Link to="/vendor/locations/new"><Plus data-icon="inline-start" />Add location</Link></Button>}
      />
      {loading ? <CardGridSkeleton count={3} /> : failed ? (
        <ErrorState description="Your parking locations didn’t load. Check your connection and try again." onRetry={load} />
      ) : locations.length === 0 ? (
        <EmptyState title="No locations yet" description="Add your first car park: where it is, what it charges, and how many vehicles it holds.">
          <Button asChild><Link to="/vendor/locations/new"><Plus data-icon="inline-start" />Add location</Link></Button>
        </EmptyState>
      ) : (
        <ul aria-label="Parking locations" className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
          {locations.map((location) => (
            <li key={location._id} className="min-w-0">
              <LocationCard location={location} publishing={publishing === location._id} publishError={publishErrors[location._id]} onPublish={publish} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
