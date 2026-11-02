import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Car, CarFront, CircleParking, Gauge, MapPin, Navigation, ParkingSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { bookingsAPI, slotsAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import { ListSkeleton, MetricGridSkeleton } from '@/components/kit/Loaders';
import MetricCard from '@/components/kit/MetricCard';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';
import TicketStub from '@/components/kit/TicketStub';
import { bookingAssignment, bookingLocationName, bookingWindow, isEvBooking } from '@/lib/bookings';

const quickActions = [
  { to: '/dashboard/nearby', icon: Navigation, title: 'Open the nearby map', body: 'See live spaces around you or your destination.' },
  { to: '/dashboard/vehicles', icon: CarFront, title: 'Manage vehicles', body: 'Your vehicle decides how you book.' },
  { to: '/dashboard/bookings', icon: CalendarDays, title: 'Booking history', body: 'Upcoming, active and past bookings.' },
];

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [slotStats, setSlotStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Same two calls as before. Load failures used to leave a blank screen.
  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([slotsAPI.getAll(), bookingsAPI.getMyBookings()])
      .then(([slotsRes, bookingsRes]) => {
        setSlotStats(slotsRes.data.stats);
        setBookings(bookingsRes.data.bookings || []);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const header = (
    <PageHeader
      eyebrow="Driver"
      title={`Good to see you, ${firstName}`}
      description="Your next booking, and a quick way to find the next space."
      actions={<Button asChild><Link to="/dashboard/nearby"><MapPin data-icon="inline-start" />Find parking</Link></Button>}
    />
  );

  if (loading) return <>{header}<MetricGridSkeleton /><ListSkeleton className="mt-6" /></>;
  if (failed) return <>{header}<ErrorState description="Your bookings and parking stats didn’t load. Check your connection and try again." onRetry={load} /></>;

  const upcoming = bookings.filter((b) => b.status === 'upcoming').sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const next = upcoming[0];
  const recent = bookings.slice(0, 3);
  const total = slotStats?.total || 0;
  const occupancy = total ? Math.round(((slotStats?.occupied || 0) / total) * 100) : 0;

  return (
    <>
      {header}
      {/* These counts come from individually tracked bays (EV and legacy), not
          from lot capacity; the labels say so. See PROGRESS.md. */}
      <section aria-label="Your activity and tracked bays" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Upcoming bookings" value={upcoming.length} icon={<CalendarDays />} />
        <MetricCard label="Tracked bays free" value={slotStats?.available ?? 0} detail="EV and legacy bays" icon={<CircleParking />} tone="available" />
        <MetricCard label="Tracked bays taken" value={slotStats?.occupied ?? 0} detail="EV and legacy bays" icon={<ParkingSquare />} tone="occupied" />
        <MetricCard label="Tracked bay occupancy" value={occupancy} format={(v) => `${Math.round(v)}%`} detail={`${total} tracked bays`} icon={<Gauge />} tone="neutral" />
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="next-title" className="grid min-w-0 grid-cols-1 content-start gap-4">
          <div className="flex items-end justify-between gap-3">
            <h2 id="next-title" className="font-display text-xl font-semibold">{next ? 'Your next booking' : 'Recent bookings'}</h2>
            <Link to="/dashboard/bookings" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">All bookings<ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>
          {next && (
            <TicketStub
              stubLabel={isEvBooking(next) ? 'EV bay' : 'Any bay'}
              stubValue={isEvBooking(next) ? next.slot.slotNumber : <Car aria-label="Capacity booking" className="mx-auto size-6" />}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{bookingLocationName(next)}</p>
                <StatusBadge status={next.status} />
              </div>
              <p className="mt-1 text-sm text-text-muted">{bookingWindow(next)}</p>
              <p className="mt-1 text-sm text-text-muted">{bookingAssignment(next)}</p>
              <p className="mt-2 font-mono text-xs text-text-muted">{next.bookingCode}</p>
            </TicketStub>
          )}
          {recent.length === 0 ? (
            <EmptyState title="No bookings yet" description="Find a space near you and reserve it before you set off.">
              <Button asChild><Link to="/dashboard/nearby">Find parking</Link></Button>
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-1 gap-2" aria-label="Recent bookings">
              {recent.filter((b) => b !== next).map((booking) => (
                <li key={booking._id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{bookingLocationName(booking)}</p>
                    <p className="truncate text-sm text-text-muted">{bookingWindow(booking)} · {bookingAssignment(booking)}</p>
                  </div>
                  <StatusBadge status={booking.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="actions-title" className="grid min-w-0 grid-cols-1 content-start gap-3">
          <h2 id="actions-title" className="font-display text-xl font-semibold">Quick actions</h2>
          {quickActions.map(({ to, icon: Icon, title, body }) => (
            <Link key={to} to={to} className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-brand/50">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-strong"><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-text-muted">{body}</span>
              </span>
              <ArrowRight aria-hidden="true" className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
