import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  SLOT_STATES, isSlotSelectable, slotAccessibleName, slotDisplayStatus, slotStateLabel,
} from '@/lib/slotStates';
import { ArrivingCar, LotFrame, LotLegend, TopDownCar, bayFrameClass, useLotColumns } from './LotFrame';

// EV mode: every bay is a real charging bay from the backend, picked exactly.
// With onSelect it is a single-select listbox (roving tabindex; arrow keys
// move by row and column; Enter or Space selects); without it a read-only
// list (the operator's view of the same lot).

const stateClass = {
  available: 'bg-lot-available/12 text-lot-available',
  selected: 'bg-lot-selected/20 text-lot-selected',
  reserved: 'text-lot-reserved',
  occupied: 'text-lot-text-muted',
  maintenance: 'bg-hatch text-lot-text-muted',
  unavailable: 'text-lot-text-muted opacity-60',
};

const lampClass = {
  available: 'bg-lot-available', selected: 'bg-lot-selected', reserved: 'bg-lot-reserved',
  occupied: 'bg-lot-text-muted', maintenance: 'bg-lot-text-muted', unavailable: 'bg-lot-text-muted/50',
};

export const EV_LEGEND = [
  { label: 'Available', swatch: 'bg-lot-available' },
  { label: 'Selected', swatch: 'ring-2 ring-inset ring-lot-selected' },
  { label: 'Reserved', swatch: 'outline-2 -outline-offset-2 outline-dashed outline-lot-reserved bg-lot-reserved/20' },
  { label: 'Occupied', swatch: 'bg-lot-car-1' },
  { label: 'Maintenance', swatch: 'bg-hatch text-lot-text-muted ring-1 ring-inset ring-lot-text-muted' },
  { label: 'Unavailable', swatch: 'bg-lot-text-muted/30' },
];

// Bays whose state just changed get a short highlight, so a live update is
// visible as it happens (transform and opacity only).
function useChangedBays(slots) {
  const previous = useRef(new Map());
  const changed = new Set();
  for (const slot of slots) {
    const state = slotDisplayStatus(slot);
    const before = previous.current.get(slot._id);
    if (before && before !== state) changed.add(slot._id);
  }
  useEffect(() => {
    previous.current = new Map(slots.map((slot) => [slot._id, slotDisplayStatus(slot)]));
  });
  return changed;
}

function BayBody({ slot, status }) {
  return (
    <>
      <span className="flex items-start justify-between gap-1">
        <span className="font-mono text-sm font-semibold text-lot-text">{slot.slotNumber}</span>
        <Zap aria-hidden="true" className="size-3.5 shrink-0 text-lot-ev" />
      </span>
      {status === 'occupied' && <span className="absolute inset-0 grid place-items-center"><TopDownCar /></span>}
      <span className="relative grid gap-0.5 text-left">
        <span className="text-[0.6875rem] leading-tight text-lot-text-muted">{slot.chargerPowerKw ? `${slot.chargerPowerKw} kW` : 'EV charger'}</span>
        <span className="text-[0.6875rem] leading-tight font-semibold">{slotStateLabel(status)}</span>
      </span>
      <span aria-hidden="true" className={cn('absolute top-1.5 right-6 size-2 rounded-full', lampClass[status])} />
    </>
  );
}

export default function EvLotMap({
  slots = [], selectedId = '', onSelect, label = 'EV charging bays', heading, aside, rate,
  notice, arrivingId, onArrived, className,
}) {
  const reduce = useReducedMotion();
  const gridRef = useRef(null);
  const containerRef = useRef(null);
  const laneRef = useRef(null);
  const bayRefs = useRef({});
  const columns = useLotColumns(gridRef);
  const interactive = typeof onSelect === 'function';
  const changed = useChangedBays(slots);
  const statuses = slots.map((slot) => slotDisplayStatus(slot, selectedId));
  const enabled = slots.map((slot, i) => statuses[i] === 'selected' || isSlotSelectable(slot));
  const firstEnabled = enabled.indexOf(true);
  const tabStop = statuses.indexOf('selected') >= 0 ? statuses.indexOf('selected') : firstEnabled;
  const [focusIndex, setFocusIndex] = useState(null);
  const current = focusIndex !== null && enabled[focusIndex] ? focusIndex : tabStop;

  // Arrow keys move to the nearest selectable bay in that direction.
  const onKeyDown = useCallback((event, index) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
    let next;
    if (step) {
      for (let i = index + step; i >= 0 && i < slots.length; i += step) if (enabled[i]) { next = i; break; }
      if (next === undefined && Math.abs(step) === 1) next = index;
    } else if (event.key === 'Home') next = firstEnabled;
    else if (event.key === 'End') next = enabled.lastIndexOf(true);
    else return;
    event.preventDefault();
    if (next === undefined) return;
    setFocusIndex(next);
    gridRef.current?.querySelectorAll('[data-bay-index]')[next]?.focus();
  }, [columns, enabled, firstEnabled, slots.length]);

  const available = statuses.filter((status) => status === 'available' || status === 'selected').length;
  // Stable per arrival, so a live refresh mid-drive doesn't restart the car.
  const targetRef = useMemo(() => (arrivingId ? { get current() { return bayRefs.current[arrivingId]; } } : null), [arrivingId]);

  return (
    <LotFrame
      className={className}
      containerRef={containerRef}
      laneRef={laneRef}
      gridRef={gridRef}
      heading={heading ?? (
        <p className="font-display text-lg font-semibold">
          <span className="font-mono tabular-nums">{available}</span> of <span className="font-mono tabular-nums">{slots.length}</span> charging bays free
        </p>
      )}
      aside={aside}
      legend={<LotLegend items={interactive ? EV_LEGEND : EV_LEGEND.filter((item) => item.label !== 'Selected')} />}
      overlay={arrivingId && bayRefs.current[arrivingId] && (
        <ArrivingCar containerRef={containerRef} laneRef={laneRef} targetRef={targetRef} onArrived={onArrived} />
      )}
    >
      <div aria-live="polite" className="sr-only">{notice}</div>
      {notice && <p role="status" className="mt-3 rounded-lg bg-lot-reserved/15 px-3 py-2 text-sm text-lot-reserved">{notice}</p>}
      <TooltipProvider delayDuration={200}>
      {!slots.length ? (
        <p className="py-10 text-center text-sm text-lot-text-muted">No EV charging bays are set up at this location yet.</p>
      ) : (
        <div
          role={interactive ? 'listbox' : 'list'}
          aria-label={label}
          className="grid"
          style={{ gridTemplateColumns: `repeat(${Math.min(columns, Math.max(slots.length, 1))}, minmax(0, 8rem))` }}
        >
          {slots.map((slot, index) => {
            const status = statuses[index];
            const rowEnd = (index + 1) % columns === 0 || index === slots.length - 1;
            const name = slotAccessibleName({ id: slot.slotNumber, powerKw: slot.chargerPowerKw || 0, state: status });
            const tip = [slot.slotNumber, slotStateLabel(status), rate !== undefined ? `₹${rate}/hr` : null, slot.connectorType || slot.chargerType || null].filter(Boolean).join(' · ');
            const flash = changed.has(slot._id) && !reduce && (
              <AnimatePresence>
                <m.span
                  key={status}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-lot-reserved"
                  initial={{ opacity: 1, scale: 1.08 }}
                  animate={{ opacity: 0, scale: 1 }}
                  transition={{ duration: 1.2 }}
                />
              </AnimatePresence>
            );
            const common = cn(
              bayFrameClass(rowEnd), stateClass[status], `state-${status}`,
              status === 'reserved' && 'outline-2 -outline-offset-4 outline-lot-reserved outline-dashed',
            );
            if (!interactive) {
              return (
                <div key={slot._id} role="listitem" aria-label={name} className={common} ref={(node) => { bayRefs.current[slot._id] = node; }}>
                  <BayBody slot={slot} status={status} />{flash}
                </div>
              );
            }
            const selectable = enabled[index];
            return (
              <Tooltip key={slot._id}>
                <TooltipTrigger asChild>
                  <button
                    ref={(node) => { bayRefs.current[slot._id] = node; }}
                    type="button"
                    role="option"
                    data-bay-index={index}
                    aria-selected={status === 'selected'}
                    aria-label={name}
                    disabled={!selectable}
                    tabIndex={index === current ? 0 : -1}
                    onFocus={() => setFocusIndex(index)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    onClick={() => onSelect(slot._id)}
                    className={cn(
                      common,
                      'cursor-pointer text-left transition-[background-color,color] duration-150 outline-offset-2 enabled:hover:bg-lot-available/20 focus-visible:outline-2 focus-visible:outline-lot-selected disabled:cursor-not-allowed',
                      status === 'selected' && 'enabled:hover:bg-lot-selected/25',
                    )}
                  >
                    <BayBody slot={slot} status={status} />
                    {status === 'selected' && (
                      <m.span
                        layoutId="ev-lot-selected"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-1 rounded-md ring-2 ring-lot-selected"
                        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                      />
                    )}
                    {flash}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{tip}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}
      </TooltipProvider>
    </LotFrame>
  );
}

export { SLOT_STATES };
