import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CircleParking, IndianRupee, MapPin, Plus, Zap } from 'lucide-react';
import { vendorsAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import { MetricGridSkeleton } from '@/components/kit/Loaders';
import MetricCard from '@/components/kit/MetricCard';
import OccupancyRing from '@/components/kit/OccupancyRing';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';
import { formatRupees } from '@/lib/bookings';

const EMPTY_STATS = { parkingLocations: 0, totalSlots: 0, availableSlots: 0, occupiedSlots: 0, activeBookings: 0, totalEarnings: 0 };

const shortcuts = [
  { to: '/vendor/locations', icon: MapPin, title: 'Parking locations', body: 'Addresses, prices, hours and capacity.' },
  { to: '/vendor/bookings', icon: CalendarDays, title: 'Bookings', body: 'Check drivers in and out.' },
  { to: '/vendor/slots', icon: Zap, title: 'EV bays', body: 'Charging bays and maintenance.' },
];

export default function VendorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    vendorsAPI.getDashboard()
      .then((response) => setData(response.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const header = (
    <PageHeader
      eyebrow="Operator"
      title="Operations overview"
      description="Space across your published locations for the next hour, and the bookings in progress."
      actions={<Button asChild><Link to="/vendor/locations/new"><Plus data-icon="inline-start" />Add location</Link></Button>}
    />
  );

  if (loading) return <>{header}<MetricGridSkeleton /></>;
  if (failed) return <>{header}<ErrorState description="Your operations overview didn’t load. Check your connection and try again." onRetry={load} /></>;

  const stats = { ...EMPTY_STATS, ...data?.stats };

  return (
    <>
      {header}
      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Parking locations" value={stats.parkingLocations} detail="Drafts and inactive included" icon={<MapPin />} />
        <MetricCard label="Free in the next hour" value={stats.availableSlots} detail={`Of ${stats.totalSlots} spaces and EV bays`} icon={<CircleParking />} tone="available" />
        <MetricCard label="Open bookings" value={stats.activeBookings} detail="Upcoming or checked in" icon={<CalendarDays />} tone="reserved" />
        {/* The API sums completed bookings; it is not a payout figure. */}
        <MetricCard label="Completed booking value" value={stats.totalEarnings} format={formatRupees} detail="Total of completed bookings, not payouts" icon={<IndianRupee />} tone="neutral" />
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-labelledby="occupancy-title" className="min-w-0 rounded-2xl border bg-card p-5 shadow-hairline sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="occupancy-title" className="font-display text-lg font-semibold">Next hour</h2>
              <p className="mt-0.5 text-sm text-text-muted">Capacity spaces and EV bays at published locations</p>
            </div>
            <Link to="/vendor/locations" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              Manage capacity<ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {stats.totalSlots > 0 ? (
            <OccupancyRing free={stats.availableSlots} total={stats.totalSlots} freeLabel="Free" takenLabel="Booked or unavailable" />
          ) : (
            <EmptyState
              title="Nothing published yet"
              description="Once a location is published, its spaces and EV bays show up here."
            >
              <Button asChild variant="outline"><Link to="/vendor/locations">Go to locations</Link></Button>
            </EmptyState>
          )}
        </section>

        <section aria-labelledby="account-title" className="min-w-0 rounded-2xl border bg-card p-5 shadow-hairline sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="account-title" className="font-display text-lg font-semibold">Your account</h2>
            <StatusBadge status={data?.vendorStatus || 'active'} />
          </div>
          <ul className="m-0 grid list-none gap-1 p-0">
            {shortcuts.map(({ to, icon: Icon, title, body }) => (
              <li key={to}>
                <Link to={to} className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus">
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-strong"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{title}</span>
                    <span className="block text-sm text-text-muted">{body}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
