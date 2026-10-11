import { format, isSameDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Free spaces over the next few hours, one bar per start time. Picking a bar
// moves the booking window there (same duration). Bars show their count as
// text; colour is never the only signal.
export default function CapacityTimeline({ windows = [], loading = false, selectedStart, onPick, className }) {
  if (loading && !windows.length) {
    return (
      <div role="status" className={cn('flex gap-2', className)}>
        <span className="sr-only">Loading availability for the next few hours…</span>
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24 flex-1 rounded-lg" />)}
      </div>
    );
  }
  if (!windows.length) return null;

  const known = windows.filter((w) => !w.unknown && w.isOpen && w.total > 0);
  const best = known.reduce((top, w) => (!top || w.available > top.available ? w : top), null);
  const selected = selectedStart ? new Date(selectedStart).getTime() : null;

  return (
    <div className={className}>
      <ul aria-label="Free spaces over the next few hours" className="grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-8">
        {windows.map((w) => {
          const share = !w.unknown && w.total ? w.available / w.total : 0;
          const isSelected = selected !== null && Math.abs(w.start.getTime() - selected) < 60000;
          const disabled = w.unknown || !w.isOpen || w.available <= 0;
          const time = format(w.start, 'HH:mm');
          const day = isSameDay(w.start, new Date()) ? '' : ' tomorrow';
          const status = w.unknown ? 'couldn’t load' : !w.isOpen ? 'closed' : `${w.available} of ${w.total} free`;
          return (
            <li key={w.start.toISOString()}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                aria-label={`${time}${day} to ${format(w.end, 'HH:mm')}, ${status}${w === best ? ', most free' : ''}`}
                onClick={() => onPick?.(w.start, w.end)}
                className={cn(
                  'flex h-28 w-full flex-col items-center justify-end gap-1 rounded-lg border bg-card px-1 pt-2 pb-1.5 text-xs transition-colors',
                  'enabled:hover:border-brand/60 disabled:cursor-not-allowed disabled:opacity-60',
                  isSelected && 'border-brand bg-brand-soft',
                )}
              >
                {w === best && <span className="text-[0.6875rem] font-medium text-slot-available">Most free</span>}
                <span aria-hidden="true" className="relative flex w-3 flex-1 items-end overflow-hidden rounded-full bg-surface-sunken">
                  <span className={cn('w-full rounded-full', share > 0.15 ? 'bg-slot-available' : 'bg-slot-reserved-solid')} style={{ height: `${Math.max(share * 100, w.available > 0 ? 6 : 0)}%` }} />
                </span>
                <span className="font-mono font-semibold text-foreground">{time}</span>
                <span className="text-[0.6875rem] text-text-muted">{w.unknown ? '—' : !w.isOpen ? 'Closed' : `${w.available} free`}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
