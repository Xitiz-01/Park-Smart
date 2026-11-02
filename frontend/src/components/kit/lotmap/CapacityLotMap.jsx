import { useRef } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ArrivingCar, LotFrame, LotLegend, TopDownCar, bayFrameClass, useLotColumns } from './LotFrame';

// Capacity mode: cars and motorcycles reserve one of the location's spaces,
// not a numbered bay. The pool is drawn from the real totals for the chosen
// window and is not interactive. Large lots are drawn to scale: each bay on
// screen stands for `perCell` spaces, and the map says so.

export const MAX_CELLS = 40;

export function capacityCells(total, reserved, max = MAX_CELLS) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeReserved = Math.min(safeTotal, Math.max(0, Number(reserved) || 0));
  if (!safeTotal) return { cells: 0, perCell: 1, taken: 0 };
  const perCell = Math.max(1, Math.ceil(safeTotal / max));
  const cells = Math.ceil(safeTotal / perCell);
  let taken = Math.round(safeReserved / perCell);
  // Never show a full lot as having room, or a lot with room as full.
  if (safeReserved >= safeTotal) taken = cells;
  else taken = Math.min(taken, cells - 1);
  if (safeReserved > 0) taken = Math.max(taken, 1);
  return { cells, perCell, taken };
}

const CAPACITY_LEGEND = [
  { label: 'Free', swatch: 'bg-lot-available' },
  { label: 'Taken', swatch: 'bg-lot-car-1' },
];

export default function CapacityLotMap({
  total = 0, reserved = 0, available = 0, isOpen = true, windowLabel, vehicleLabel = 'spaces',
  arriving = false, onArrived, aside, className,
}) {
  const gridRef = useRef(null);
  const containerRef = useRef(null);
  const laneRef = useRef(null);
  const columns = useLotColumns(gridRef, { bay: 64, max: 12 });
  const { cells, perCell, taken } = capacityCells(total, reserved);
  const full = isOpen && total > 0 && available <= 0;
  const summary = !isOpen
    ? `Closed${windowLabel ? ` for ${windowLabel}` : ''}`
    : `${available} of ${total} ${vehicleLabel} free${windowLabel ? ` for ${windowLabel}` : ''}`;

  return (
    <LotFrame
      className={className}
      containerRef={containerRef}
      laneRef={laneRef}
      gridRef={gridRef}
      heading={(
        <>
          <p className="font-display text-lg font-semibold">
            {isOpen
              ? <><span className="font-mono tabular-nums">{available}</span> of <span className="font-mono tabular-nums">{total}</span> {vehicleLabel} free</>
              : 'Closed for this time'}
          </p>
          {windowLabel && <p className="mt-0.5 text-sm text-lot-text-muted">{windowLabel}</p>}
        </>
      )}
      aside={aside}
      legend={cells > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LotLegend items={CAPACITY_LEGEND} />
          {perCell > 1 && <p className="text-xs text-lot-text-muted">Each bay shown = {perCell} spaces</p>}
        </div>
      )}
      overlay={arriving && <ArrivingCar containerRef={containerRef} laneRef={laneRef} onArrived={onArrived} />}
    >
      {full && <p role="status" className="mt-3 rounded-lg bg-lot-reserved/15 px-3 py-2 text-sm text-lot-reserved">Full for this time. Try a different time below.</p>}
      {!isOpen && <p role="status" className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-lot-text-muted">This location is closed for the selected time.</p>}
      {cells > 0 && isOpen && (
        <div role="img" aria-label={summary} className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(columns, cells)}, minmax(0, 1fr))` }}>
          {Array.from({ length: cells }, (_, index) => {
            const isTaken = index < taken;
            const rowEnd = (index + 1) % columns === 0 || index === cells - 1;
            return (
              <div key={index} aria-hidden="true" className={cn(bayFrameClass(rowEnd), 'min-h-[4.5rem] items-center justify-center', isTaken ? '' : 'bg-lot-available/12')}>
                {isTaken ? <TopDownCar className="max-h-12" /> : <span className="size-2 rounded-full bg-lot-available shadow-[0_0_10px_var(--lot-available)]" />}
              </div>
            );
          })}
        </div>
      )}
    </LotFrame>
  );
}

// Map popups: a strip of bays sized to the real free/total ratio.
export function CapacityMini({ available = 0, total = 0, className }) {
  const cells = Math.min(10, Math.max(0, total));
  const free = total ? Math.round((available / total) * cells) : 0;
  const shownFree = available > 0 ? Math.max(1, Math.min(free, cells)) : 0;
  return (
    <div className={cn('rounded-lg bg-lot-asphalt p-2 text-lot-text', className)}>
      {cells > 0 && (
        <div aria-hidden="true" className="flex gap-0.5">
          {Array.from({ length: cells }, (_, i) => (
            <span key={i} className={cn('h-5 flex-1 border-l border-lot-line/40 first:border-l-0', i < cells - shownFree ? 'bg-lot-car-1/80' : 'bg-lot-available/30')} />
          ))}
        </div>
      )}
      <p className="mt-1.5 text-xs"><span className="font-mono font-semibold">{available}</span> of <span className="font-mono">{total}</span> free</p>
    </div>
  );
}

// Booking tickets: the one exact EV bay that was booked.
export function EvBayMini({ bayId, className }) {
  return (
    <div className={cn('flex h-full flex-col items-center justify-center gap-1 rounded-lg bg-lot-asphalt px-3 py-2 text-lot-text', className)}>
      <span className="relative grid h-12 w-10 place-items-center border-x-2 border-b-2 border-lot-line/60 bg-lot-selected/20 ring-2 ring-lot-selected ring-inset">
        <Zap aria-hidden="true" className="size-4 text-lot-ev" />
      </span>
      <span className="font-mono text-sm font-semibold">{bayId}</span>
    </div>
  );
}

// Booking tickets for capacity bookings: one space in a pool, never a bay.
export function CapacityStub({ capacity, className }) {
  return (
    <div className={cn('flex h-full flex-col items-center justify-center gap-1 rounded-lg bg-lot-asphalt px-2 py-2 text-center text-lot-text', className)}>
      <span className="grid h-12 w-12 place-items-center rounded-md border-2 border-dashed border-lot-line/40"><TopDownCar className="h-9 max-h-9" /></span>
      <span className="text-xs leading-tight">{capacity ? <>1 of <span className="font-mono">{capacity}</span> spaces</> : '1 space'}</span>
    </div>
  );
}
