import { createContext, useCallback, useContext, useEffect, useId, useRef } from 'react';
import { m } from 'motion/react';
import { PlugZap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SLOT_STATES, slotAccessibleName, slotStateLabel } from '@/lib/slotStates';

// Bays drawn top-down: two painted side lines and a kerb line, the bay ID in
// mono, and the state as text. Shared by the booking EV board, vendor slot
// operations and the landing page.

const stateStyles = {
  available: 'bg-slot-available-soft text-slot-available',
  selected: 'bg-brand-soft text-brand-strong',
  reserved: 'bg-slot-reserved-soft text-slot-reserved',
  occupied: 'bg-slot-occupied-soft text-slot-occupied',
  maintenance: 'bg-slot-maintenance-soft text-slot-maintenance bg-hatch',
  unavailable: 'bg-slot-unavailable-soft text-slot-unavailable',
};

const BoardContext = createContext(null);

function SlotTileBody({ id, state, detail, meta, ev }) {
  return (
    <>
      {/* painted bay lines */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full bg-current opacity-35" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-2 right-0 w-0.5 rounded-full bg-current opacity-35" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-current opacity-35" />
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-base font-semibold tracking-tight text-foreground">{id}</span>
        {ev && <PlugZap aria-hidden="true" className="size-4" />}
      </span>
      {detail && <span className="mt-1 text-sm text-foreground/80">{detail}</span>}
      {meta && <span className="truncate text-xs text-text-muted">{meta}</span>}
      <span className="mt-auto pt-3 text-xs font-semibold">{slotStateLabel(state)}</span>
    </>
  );
}

const tileClass = 'relative flex min-h-32 min-w-0 flex-col rounded-lg px-3.5 pt-3 pb-2.5 text-left transition-[background-color,color] duration-150';

// One bay. Inside an interactive SlotBoard it becomes an option the driver can
// pick; available bays only. `id` is the visible bay ID, `value` the record id.
export function SlotTile({ value, id, state, detail, meta, ev = false, powerKw, className }) {
  const board = useContext(BoardContext);
  const label = slotAccessibleName({ id, powerKw, state });

  if (!board?.interactive) {
    return (
      <div role="listitem" aria-label={label} data-state={state} className={cn(tileClass, stateStyles[state], className)}>
        <SlotTileBody id={id} state={state} detail={detail} meta={meta} ev={ev} />
      </div>
    );
  }

  const selected = state === 'selected';
  const selectable = state === 'available' || selected;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={label}
      data-state={state}
      data-slot-value={value}
      disabled={!selectable}
      tabIndex={selected ? 0 : -1}
      onClick={() => board.onValueChange(value)}
      onKeyDown={board.onKeyDown}
      className={cn(
        tileClass, stateStyles[state],
        'outline-offset-2 enabled:hover:brightness-[0.97] disabled:cursor-not-allowed dark:enabled:hover:brightness-110',
        className,
      )}
    >
      <SlotTileBody id={id} state={state} detail={detail} meta={meta} ev={ev} />
      {selected && (
        <m.span
          layoutId={`${board.groupId}-selected`}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-0.5 rounded-[calc(var(--radius-lg)+2px)] ring-2 ring-slot-selected"
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        />
      )}
    </button>
  );
}

// A grid of bays. With onValueChange it is a single-select listbox (roving
// tabindex: arrow keys move, Enter/Space select); without it, a plain list.
export function SlotBoard({ label, onValueChange, children, className }) {
  const groupId = useId();
  const ref = useRef(null);
  const interactive = typeof onValueChange === 'function';

  const options = () => Array.from(ref.current?.querySelectorAll('[role="option"]:not(:disabled)') || []);

  // Roving tabindex: the selected bay is the tab stop; with nothing selected,
  // the first selectable bay is.
  useEffect(() => {
    if (!interactive) return;
    const list = options();
    if (list.length && !list.some((option) => option.tabIndex === 0)) list[0].tabIndex = 0;
  });

  const onKeyDown = useCallback((event) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const list = options();
    const index = list.indexOf(event.currentTarget);
    let next = index + (keys[event.key] || 0);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = list.length - 1;
    const target = list[(next + list.length) % list.length];
    if (target) { target.tabIndex = 0; event.currentTarget.tabIndex = -1; target.focus(); }
  }, []);

  return (
    <BoardContext.Provider value={{ interactive, onValueChange, onKeyDown, groupId }}>
      <div
        ref={ref}
        role={interactive ? 'listbox' : 'list'}
        aria-label={label}
        className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]', className)}
      >
        {children}
      </div>
    </BoardContext.Provider>
  );
}

const legendSwatch = {
  available: 'bg-slot-available',
  selected: 'bg-transparent ring-2 ring-slot-selected ring-inset',
  reserved: 'bg-slot-reserved-solid',
  occupied: 'bg-slot-occupied',
  maintenance: 'bg-slot-maintenance-soft text-slot-maintenance bg-hatch ring-1 ring-inset ring-slot-maintenance',
  unavailable: 'bg-slot-unavailable-soft ring-1 ring-inset ring-slot-unavailable',
};

export function SlotLegend({ states = SLOT_STATES, className }) {
  return (
    <ul aria-label="Bay status legend" className={cn('flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-muted', className)}>
      {states.map((state) => (
        <li key={state} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-3 rounded-[3px]', legendSwatch[state])} />
          {slotStateLabel(state)}
        </li>
      ))}
    </ul>
  );
}
