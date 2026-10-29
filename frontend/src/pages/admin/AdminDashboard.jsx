import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, CalendarDays, CircleParking, IndianRupee, ShieldCheck, Store, Users } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import { ListSkeleton, MetricGridSkeleton } from '@/components/kit/Loaders';
import MetricCard from '@/components/kit/MetricCard';
import PageHeader from '@/components/kit/PageHeader';
import StackedBar from '@/components/kit/StackedBar';
import StatusBadge from '@/components/kit/StatusBadge';
import { bookingAssignment, formatRupees } from '@/lib/bookings';

const shortcuts = [
  { to: '/admin/vendors?status=pending', icon: Store, title: 'Vendor applications', body: 'Approve, reject or suspend operators.' },
  { to: '/admin/verifications', icon: ShieldCheck, title: 'Verification review', body: 'Evidence waiting for a decision.' },
  { to: '/admin/users', icon: Users, title: 'Users', body: 'Accounts, roles and access.' },
];

function Panel({ id, title, action, children, className }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 rounded-2xl border bg-card p-5 shadow-hairline sm:p-6 ${className || ''}`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 id={id} className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const PanelLink = ({ to, children }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{children}<ArrowRight aria-hidden="true" className="size-4" /></Link>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    adminAPI.getDashboard()
      .then((response) => setData(response.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const header = (
    <PageHeader
      eyebrow="Admin"
      title="Platform overview"
      description="Accounts, bookings and tracked bays across ParkSmart."
      actions={<Button asChild variant="outline"><Link to="/admin/vendors?status=pending"><Store data-icon="inline-start" />Review vendors</Link></Button>}
    />
  );

  if (loading) return <>{header}<MetricGridSkeleton /><ListSkeleton className="mt-6" /></>;
  if (failed || !data) return <>{header}<ErrorState description="The overview didn’t load. Check your connection and try again." onRetry={load} /></>;

  const { stats, recentBookings = [] } = data;
  const slots = stats.slots || {};
  const other = Math.max(0, (slots.total || 0) - (slots.available || 0) - (slots.reserved || 0) - (slots.occupied || 0));

  return (
    <>
      {header}
      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Customers" value={stats.users.total} detail="Driver accounts" icon={<Users />} />
        <MetricCard label="Bookings" value={stats.bookings.total} detail={`${stats.bookings.today} made today, ${stats.bookings.active} checked in`} icon={<CalendarDays />} tone="reserved" />
        {/* Payments aren't collected in the app; this sums bookings marked paid. */}
        <MetricCard label="Bookings marked paid" value={stats.revenue.total} format={formatRupees} detail={`${formatRupees(stats.revenue.today)} marked paid today`} icon={<IndianRupee />} tone="neutral" />
        <MetricCard label="Tracked bays free" value={slots.available || 0} detail={`Of ${slots.total || 0} tracked bays`} icon={<CircleParking />} tone="available" />
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel id="bays-title" title="Tracked bays right now" action={<PanelLink to="/admin/slots">All bays</PanelLink>}>
          {/* Individually tracked bays (EV and legacy), not lot capacity. */}
          {slots.total ? (
            <StackedBar
              label="Tracked bays"
              total={slots.total}
              segments={[
                { label: 'Free', value: slots.available || 0, className: 'bg-chart-1' },
                { label: 'Reserved', value: slots.reserved || 0, className: 'bg-chart-2' },
                { label: 'Occupied', value: slots.occupied || 0, className: 'bg-chart-4' },
                { label: 'Other', value: other, className: 'bg-chart-5' },
              ]}
            />
          ) : <p className="text-sm text-text-muted">No individually tracked bays yet.</p>}
          <p className="mt-4 text-sm text-text-muted">Counts individually tracked bays (EV and legacy). Capacity parking at operators’ locations isn’t included.</p>
        </Panel>

        <Panel id="shortcuts-title" title="Needs attention">
          <ul className="m-0 grid list-none gap-1 p-0">
            {shortcuts.map(({ to, icon: Icon, title, body }) => (
              <li key={to}>
                <Link to={to} className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus">
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-foreground"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-sm text-text-muted">{body}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel id="recent-title" title="Latest bookings" className="mt-6" action={<PanelLink to="/admin/bookings">All bookings</PanelLink>}>
        {recentBookings.length === 0 ? (
          <EmptyState title="No bookings yet" description="New bookings show up here as drivers make them." />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Code', 'Driver', 'Space', 'Vehicle', 'Booked', 'Status'].map((h) => <TableHead key={h} className="text-xs font-semibold text-text-muted">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBookings.map((b) => (
                    <TableRow key={b._id}>
                      <TableCell className="font-mono text-xs">{b.bookingCode}</TableCell>
                      <TableCell><span className="block">{b.user?.name}</span><span className="block text-xs text-text-muted">{b.user?.email}</span></TableCell>
                      <TableCell>{bookingAssignment(b)}</TableCell>
                      <TableCell className="font-mono">{b.vehicle?.licensePlate}</TableCell>
                      <TableCell className="whitespace-nowrap">{format(new Date(b.createdAt), 'd MMM yyyy')}</TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="m-0 grid list-none gap-2 p-0 md:hidden">
              {recentBookings.map((b) => (
                <li key={b._id} className="flex items-start justify-between gap-3 rounded-lg bg-surface-sunken p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-mono font-semibold">{b.vehicle?.licensePlate}</span>
                    <span className="block text-text-muted">{b.user?.name} · {bookingAssignment(b)}</span>
                    <span className="block text-xs text-text-muted">{format(new Date(b.createdAt), 'd MMM yyyy')}</span>
                  </span>
                  <StatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </>
  );
}
