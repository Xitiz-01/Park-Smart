import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LogIn, LogOut, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfirm } from '@/components/kit/ConfirmDialog';
import DataTable from '@/components/kit/DataTable';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';
import { bookingAssignment, bookingLocationName, bookingWindow, formatRupees } from '@/lib/bookings';

const PAYMENT_METHOD_LABELS = { card: 'Card', upi: 'UPI', netbanking: 'Net banking', wallet: 'Wallet' };
const FILTERS = [['all', 'All'], ['upcoming', 'Upcoming'], ['active', 'Checked in'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

export default function AdminBookings() {
  const confirm = useConfirm();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [acting, setActing] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = FILTERS.some(([value]) => value === searchParams.get('status')) ? searchParams.get('status') : 'all';
  const setFilter = (value) => setSearchParams((params) => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('status'); else next.set('status', value);
    return next;
  }, { replace: true });

  // The status filter is applied by the API, as before.
  const fetchBookings = useCallback(() => {
    setLoading(true);
    setFailed(false);
    bookingsAPI.getAll(filter !== 'all' ? { status: filter } : {})
      .then((res) => setBookings(res.data.bookings))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [filter]);
  useEffect(fetchBookings, [fetchBookings]);

  const run = useCallback(async (booking, kind) => {
    const plate = booking.vehicle?.licensePlate || 'this booking';
    if (kind === 'cancel' && !(await confirm({
      title: `Cancel ${booking.bookingCode}?`,
      description: `${plate}, ${bookingWindow(booking)}. The driver’s space is released.`,
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep booking',
      tone: 'danger',
    }))) return;
    setActing(`${booking._id}:${kind}`);
    try {
      if (kind === 'in') await bookingsAPI.checkIn(booking._id);
      else if (kind === 'out') await bookingsAPI.checkOut(booking._id);
      else await bookingsAPI.cancel(booking._id);
      toast.success({ in: `${plate} checked in`, out: `${plate} checked out`, cancel: 'Booking cancelled' }[kind]);
      fetchBookings();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setActing(''); }
  }, [confirm, fetchBookings]);

  const columns = useMemo(() => [
    {
      id: 'vehicle', accessorFn: (b) => `${b.vehicle?.licensePlate || ''} ${b.bookingCode}`, header: 'Vehicle', meta: { mobile: 'title' },
      cell: ({ row }) => <span><span className="block font-mono font-semibold">{row.original.vehicle?.licensePlate || '—'}</span><span className="block font-mono text-xs text-text-muted">{row.original.bookingCode}</span></span>,
    },
    {
      id: 'driver', accessorFn: (b) => `${b.user?.name || ''} ${b.user?.phone || ''}`, header: 'Driver', meta: { mobile: 'subtitle' },
      cell: ({ row }) => <span><span className="block">{row.original.user?.name || 'Unknown driver'}</span><span className="block font-mono text-xs text-text-muted">{row.original.user?.phone}</span></span>,
    },
    {
      id: 'space', accessorFn: (b) => `${bookingLocationName(b)} ${bookingAssignment(b)}`, header: 'Where',
      cell: ({ row }) => <span><span className="block">{bookingLocationName(row.original)}</span><span className="block text-xs text-text-muted">{row.original.bookingType === 'regular' ? 'Capacity space' : bookingAssignment(row.original)}</span></span>,
    },
    { id: 'when', accessorFn: (b) => new Date(b.startTime).getTime(), header: 'When', cell: ({ row }) => <span className="whitespace-nowrap">{bookingWindow(row.original)}</span> },
    { id: 'amount', accessorFn: (b) => Number(b.totalAmount) || 0, header: 'Amount', cell: ({ getValue }) => <span className="font-mono">{formatRupees(getValue())}</span> },
    {
      id: 'payment', accessorFn: (b) => b.paymentStatus || 'pending', header: 'Payment',
      cell: ({ row }) => <span className="grid justify-items-start gap-1"><StatusBadge status={row.original.paymentStatus || 'pending'} /><span className="text-xs text-text-muted">{PAYMENT_METHOD_LABELS[row.original.paymentMethod] || 'No method'}</span></span>,
    },
    { id: 'status', accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue()}>{getValue() === 'active' ? 'Checked in' : undefined}</StatusBadge> },
    {
      id: 'actions', header: <span className="sr-only">Actions</span>, enableSorting: false, meta: { mobile: 'actions' },
      cell: ({ row }) => {
        const b = row.original;
        if (!['upcoming', 'active'].includes(b.status)) return null;
        const plate = b.vehicle?.licensePlate || b.bookingCode;
        const busy = (kind) => acting === `${b._id}:${kind}`;
        return (
          <div className="flex flex-wrap gap-2">
            {b.status === 'upcoming' && (
              <Button size="sm" disabled={Boolean(acting)} onClick={() => run(b, 'in')}>{busy('in') ? <Spinner data-icon="inline-start" /> : <LogIn data-icon="inline-start" />}Check in<span className="sr-only"> {plate}</span></Button>
            )}
            {b.status === 'active' && (
              <Button size="sm" variant="outline" disabled={Boolean(acting)} onClick={() => run(b, 'out')}>{busy('out') ? <Spinner data-icon="inline-start" /> : <LogOut data-icon="inline-start" />}Check out<span className="sr-only"> {plate}</span></Button>
            )}
            {/* Was a bare "✕" read aloud as "multiplication x" (audit F). */}
            <Button size="sm" variant="ghost" className="text-danger hover:text-danger" disabled={Boolean(acting)} onClick={() => run(b, 'cancel')}>
              {busy('cancel') ? <Spinner data-icon="inline-start" /> : <XCircle data-icon="inline-start" />}Cancel<span className="sr-only"> booking {plate}</span>
            </Button>
          </div>
        );
      },
    },
  ], [acting, run]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Bookings"
        description="Every booking on ParkSmart. Check drivers in and out, or cancel on their behalf."
        actions={<Button variant="outline" onClick={fetchBookings} disabled={loading}><RefreshCw data-icon="inline-start" />Refresh</Button>}
      />
      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList aria-label="Filter bookings by status" className="h-auto w-full justify-start overflow-x-auto sm:w-fit">
          {FILTERS.map(([value, label]) => <TabsTrigger key={value} value={value} className="px-3">{label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {failed ? (
        <ErrorState description="Bookings didn’t load. Check your connection and try again." onRetry={fetchBookings} />
      ) : (
        <DataTable
          columns={columns}
          data={bookings}
          getRowId={(b) => b._id}
          loading={loading}
          searchLabel="Search bookings"
          searchPlaceholder="Plate, code or driver…"
          empty={bookings.length ? undefined : <EmptyState title={filter === 'all' ? 'No bookings yet' : 'Nothing with this status'} description={filter === 'all' ? 'Bookings appear here as drivers make them.' : 'Try another status.'} />}
        />
      )}
    </>
  );
}
