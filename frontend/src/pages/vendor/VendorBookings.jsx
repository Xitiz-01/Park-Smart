import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { vendorsAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DataTable from '@/components/kit/DataTable';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';
import { bookingAssignment, bookingLocationName, bookingWindow } from '@/lib/bookings';

const FILTERS = [['all', 'All'], ['upcoming', 'Upcoming'], ['active', 'Checked in'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

// Operators think in "capacity space" vs "EV bay", not the driver's wording.
const assignment = (booking) => (booking.bookingType === 'regular' ? 'Capacity space' : bookingAssignment(booking));

export default function VendorBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [acting, setActing] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    vendorsAPI.getBookings()
      .then(({ data }) => setBookings(data.bookings))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const act = useCallback(async (booking, action) => {
    setActing(`${booking._id}:${action}`);
    try {
      if (action === 'in') await vendorsAPI.checkInBooking(booking._id);
      else await vendorsAPI.checkOutBooking(booking._id);
      toast.success(action === 'in' ? `${booking.vehicle?.licensePlate || 'Driver'} checked in` : `${booking.vehicle?.licensePlate || 'Driver'} checked out`);
      load();
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update booking'); }
    finally { setActing(''); }
  }, [load]);

  const columns = useMemo(() => [
    {
      id: 'vehicle', accessorFn: (b) => b.vehicle?.licensePlate || '', header: 'Vehicle', meta: { mobile: 'title' },
      cell: ({ row }) => (
        <span>
          <span className="block font-mono font-semibold uppercase">{row.original.vehicle?.licensePlate || '—'}</span>
          <span className="block text-xs text-text-muted capitalize">{row.original.vehicleType}</span>
        </span>
      ),
    },
    {
      id: 'customer', accessorFn: (b) => `${b.user?.name || ''} ${b.user?.email || ''}`, header: 'Driver', meta: { mobile: 'subtitle' },
      cell: ({ row }) => (
        <span className="min-w-0">
          <span className="block">{row.original.user?.name || 'Unknown driver'}</span>
          <span className="block truncate text-xs text-text-muted">{row.original.user?.email}</span>
        </span>
      ),
    },
    { id: 'location', accessorFn: bookingLocationName, header: 'Location' },
    { id: 'assignment', accessorFn: assignment, header: 'Space', meta: { label: 'Space' } },
    { id: 'when', accessorFn: (b) => new Date(b.startTime).getTime(), header: 'When', cell: ({ row }) => <span className="whitespace-nowrap">{bookingWindow(row.original)}</span> },
    { id: 'code', accessorKey: 'bookingCode', header: 'Code', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span> },
    { id: 'status', accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue()}>{getValue() === 'active' ? 'Checked in' : undefined}</StatusBadge> },
    {
      id: 'actions', header: <span className="sr-only">Actions</span>, enableSorting: false, meta: { mobile: 'actions' },
      cell: ({ row }) => {
        const b = row.original;
        const plate = b.vehicle?.licensePlate || '';
        if (b.status === 'upcoming') {
          const busy = acting === `${b._id}:in`;
          return <Button size="sm" disabled={busy} onClick={() => act(b, 'in')}>{busy ? <Spinner data-icon="inline-start" /> : <LogIn data-icon="inline-start" />}Check in<span className="sr-only"> {plate}</span></Button>;
        }
        if (b.status === 'active') {
          const busy = acting === `${b._id}:out`;
          return <Button size="sm" variant="outline" disabled={busy} onClick={() => act(b, 'out')}>{busy ? <Spinner data-icon="inline-start" /> : <LogOut data-icon="inline-start" />}Check out<span className="sr-only"> {plate}</span></Button>;
        }
        return null;
      },
    },
  ], [acting, act]);

  const counts = Object.fromEntries(FILTERS.map(([value]) => [value, value === 'all' ? bookings.length : bookings.filter((b) => b.status === value).length]));
  const rows = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <>
      <PageHeader
        eyebrow="Operator"
        title="Bookings"
        description="Capacity and EV bookings at your locations. Check drivers in when they arrive and out when they leave."
        actions={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw data-icon="inline-start" />Refresh</Button>}
      />
      {failed ? (
        <ErrorState description="Bookings didn’t load. Check your connection and try again." onRetry={load} />
      ) : (
        <>
          <Tabs value={filter} onValueChange={setFilter} className="mb-4">
            <TabsList aria-label="Filter bookings by status" className="h-auto w-full justify-start overflow-x-auto sm:w-fit">
              {FILTERS.map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="gap-1.5 px-3">
                  {label}<span className="font-mono text-xs text-text-muted">{counts[value]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(b) => b._id}
            loading={loading && !bookings.length}
            searchLabel="Search bookings"
            searchPlaceholder="Plate, driver, location…"
            // Only when the tab itself is empty; a search miss keeps the table's own message.
            empty={rows.length ? undefined : (
              <EmptyState
                title={filter === 'all' ? 'No bookings yet' : 'Nothing with this status'}
                description={filter === 'all' ? 'Bookings at your live locations show up here as drivers make them.' : 'Try another status.'}
              />
            )}
          />
        </>
      )}
    </>
  );
}
