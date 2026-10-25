import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Car, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfirm } from '@/components/kit/ConfirmDialog';
import EmptyState, { ErrorState } from '@/components/kit/EmptyState';
import { ListSkeleton } from '@/components/kit/Loaders';
import PageHeader from '@/components/kit/PageHeader';
import StatusBadge from '@/components/kit/StatusBadge';
import TicketStub from '@/components/kit/TicketStub';
import { CapacityStub, EvBayMini } from '@/components/kit/lotmap';
import {
  bookingAssignment, bookingLocationName, bookingTimeline, bookingWindow, capacityForBooking, formatRupees, isEvBooking,
} from '@/lib/bookings';
import { cn } from '@/lib/utils';

const PAYMENT_METHOD_LABELS = {
  card: 'Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  wallet: 'Wallet',
};

const FILTERS = [['all', 'All'], ['upcoming', 'Upcoming'], ['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

function Timeline({ booking }) {
  const steps = bookingTimeline(booking);
  return (
    <ol aria-label="Booking progress" className="mt-4 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-xs">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5',
            step.done ? (step.tone === 'danger' ? 'bg-slot-occupied-soft text-slot-occupied' : 'bg-slot-available-soft text-slot-available') : 'bg-surface-sunken text-text-muted',
          )}>
            <span aria-hidden="true" className="size-1.5 rounded-[1px] bg-current" />
            {step.label}
            {step.at && <span className="font-mono">{format(new Date(step.at), 'd MMM HH:mm')}</span>}
            <span className="sr-only">{step.done ? '(done)' : '(not yet)'}</span>
          </span>
          {index < steps.length - 1 && <span aria-hidden="true" className="h-px w-3 bg-border-strong" />}
        </li>
      ))}
    </ol>
  );
}

export default function MyBookings() {
  const confirm = useConfirm();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState('all');
  const [cancelling, setCancelling] = useState(null);

  const fetchBookings = useCallback(() => {
    setFailed(false);
    return bookingsAPI.getMyBookings()
      .then((res) => setBookings(res.data.bookings || []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleCancel = async (booking) => {
    if (!(await confirm({
      title: 'Cancel this booking?',
      description: `${bookingLocationName(booking)}, ${bookingWindow(booking)}. The space is released straight away.`,
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep booking',
      tone: 'danger',
    }))) return;
    setCancelling(booking._id);
    try {
      await bookingsAPI.cancel(booking._id);
      toast.success('Booking cancelled');
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setCancelling(null);
    }
  };

  const counts = Object.fromEntries(FILTERS.map(([value]) => [value, value !== 'all' ? bookings.filter((b) => b.status === value).length : bookings.length]));
  const filtered = filter !== 'all' ? bookings.filter((b) => b.status === filter) : bookings;

  return (
    <>
      <PageHeader
        eyebrow="Driver"
        title="My bookings"
        description={loading ? 'Loading your bookings…' : `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`}
        actions={<Button asChild><Link to="/dashboard/nearby">Find parking</Link></Button>}
      />

      {loading ? <ListSkeleton rows={3} /> : failed ? (
        <ErrorState description="Your bookings didn’t load. Check your connection and try again." onRetry={fetchBookings} />
      ) : (
        <>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList aria-label="Filter bookings by status" className="h-auto w-full justify-start overflow-x-auto sm:w-fit">
              {FILTERS.map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="gap-1.5 px-3">
                  {label}<span className="font-mono text-xs text-text-muted">{counts[value]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {filtered.length === 0 ? (
            <EmptyState
              className="mt-6"
              title={filter !== 'all' ? `No ${filter} bookings` : 'No bookings yet'}
              description={filter !== 'all' ? 'Bookings with this status will show up here.' : 'Find a space near you and reserve it before you set off.'}
            >
              {filter === 'all' && <Button asChild><Link to="/dashboard/nearby">Find parking</Link></Button>}
            </EmptyState>
          ) : (
            <ul className="mt-6 grid list-none grid-cols-1 gap-4 p-0" aria-label="Bookings">
              {filtered.map((b) => {
                const ev = isEvBooking(b);
                const canCancel = b.status === 'upcoming' || b.status === 'active';
                return (
                  <li key={b._id}>
                    <TicketStub stub={ev ? <EvBayMini bayId={b.slot.slotNumber} /> : <CapacityStub capacity={capacityForBooking(b)} />}>
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <div className="min-w-0">
                          <h2 className="font-display text-lg font-semibold">{bookingLocationName(b)}</h2>
                          <p className="mt-0.5 text-sm text-text-muted">{bookingAssignment(b)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={b.status} />
                          <StatusBadge status={b.paymentStatus || 'pending'}>{`Payment ${(b.paymentStatus || 'pending').replaceAll('_', ' ')}`}</StatusBadge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="size-4 text-text-muted" />{bookingWindow(b)}</span>
                        <span className="inline-flex items-center gap-1.5"><Car aria-hidden="true" className="size-4 text-text-muted" /><span className="font-mono">{b.vehicle?.licensePlate}</span></span>
                      </div>
                      <Timeline booking={b} />
                      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-3">
                        <div className="text-sm">
                          <p className="font-mono text-lg font-semibold">{formatRupees(b.totalAmount)}</p>
                          <p className="text-text-muted">{PAYMENT_METHOD_LABELS[b.paymentMethod] || 'Payment not collected'} · <span className="font-mono">{b.bookingCode}</span></p>
                        </div>
                        {canCancel && (
                          <Button variant="destructive" size="sm" onClick={() => handleCancel(b)} disabled={cancelling === b._id}>
                            <XCircle data-icon="inline-start" />{cancelling === b._id ? 'Cancelling…' : 'Cancel booking'}
                          </Button>
                        )}
                      </div>
                    </TicketStub>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}
