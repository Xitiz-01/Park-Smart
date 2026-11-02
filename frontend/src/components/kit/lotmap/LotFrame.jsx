import { useEffect, useLayoutEffect, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

// Shared look of every Lot Map: an asphalt lot (the same surface in both
// themes, like the landing page's Live Lot) with an entry lane, a parking
// sign and painted bays. The data and the interaction live in EvLotMap and
// CapacityLotMap.

// Generic top-down car, facing up, sized by its parent.
export function TopDownCar({ className }) {
  return (
    <svg viewBox="0 0 32 60" aria-hidden="true" className={cn('h-[70%] max-h-16 w-auto', className)}>
      <rect x="1" y="1" width="30" height="58" rx="9" className="fill-lot-car-1" />
      <rect x="4" y="12" width="24" height="11" rx="3.5" className="fill-lot-glass" />
      <rect x="5" y="44" width="22" height="7" rx="3" className="fill-lot-glass" />
      <rect x="5" y="25" width="22" height="17" rx="3" className="fill-lot-car-2" />
    </svg>
  );
}

// Columns that fit the container (bays stay at least ~5rem wide). Before
// layout (and in static rendering) a sensible default is used.
export function useLotColumns(ref, { min = 3, max = 10, bay = 84, fallback = 6 } = {}) {
  const [columns, setColumns] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => setColumns(Math.max(min, Math.min(max, Math.floor(node.clientWidth / bay) || min)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, min, max, bay]);
  return columns;
}

function ParkingSign() {
  return (
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md bg-logo-tile font-display text-lg leading-none font-bold text-logo-glyph">P</span>
  );
}

// The lane along the top: entry on the left, exit on the right.
function Lane({ laneRef }) {
  return (
    <div ref={laneRef} className="relative flex h-12 items-center gap-3 rounded-t-lg bg-lot-aisle px-3">
      <ParkingSign />
      <span className="font-mono text-xs text-lot-text-muted">IN ›</span>
      <span aria-hidden="true" className="h-0.5 flex-1 bg-[repeating-linear-gradient(90deg,var(--lot-dash)_0_14px,transparent_14px_26px)] opacity-60" />
      <span className="font-mono text-xs text-lot-text-muted">› OUT</span>
    </div>
  );
}

export function LotFrame({ heading, aside, legend, footer, children, className, containerRef, laneRef, gridRef, overlay }) {
  return (
    <figure className={cn('relative overflow-hidden rounded-2xl bg-lot-asphalt text-lot-text shadow-raised ring-1 ring-black/5 dark:ring-white/10', className)}>
      {(heading || aside) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5">
          <div className="min-w-0">{heading}</div>
          {aside && <div className="flex items-center gap-2">{aside}</div>}
        </div>
      )}
      <div ref={containerRef} className="relative px-3 pt-4 pb-4 sm:px-5">
        <Lane laneRef={laneRef} />
        <div ref={gridRef}>{children}</div>
        {overlay}
      </div>
      {legend && <div className="border-t border-white/10 px-4 py-3 sm:px-5">{legend}</div>}
      {footer}
    </figure>
  );
}

// Painted bay cell: side lines and a kerb line at the back. `rowEnd` closes
// the row with a right-hand line.
export const bayFrameClass = (rowEnd) => cn(
  'relative flex min-h-[5.75rem] min-w-0 flex-col justify-between border-b-2 border-l-2 border-lot-line/45 p-1.5 sm:p-2',
  rowEnd && 'border-r-2',
);

// A car that drives in from the entry along the lane and, when a bay is
// given, turns into it. Animates transform only; with reduced motion it just
// appears at its destination. Positions are measured from the DOM after
// layout, never during render.
export function ArrivingCar({ containerRef, laneRef, targetRef, onArrived }) {
  const reduce = useReducedMotion();
  const [path, setPath] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    const lane = laneRef.current;
    if (!container || !lane) return;
    const box = container.getBoundingClientRect();
    const laneBox = lane.getBoundingClientRect();
    const laneY = laneBox.top - box.top + laneBox.height / 2;
    // Enter from just outside the lane, past the parking sign.
    const startX = laneBox.left - box.left - 12;
    const target = targetRef?.current?.getBoundingClientRect();
    if (target) {
      const x = target.left - box.left + target.width / 2;
      const y = target.top - box.top + target.height / 2;
      setPath({ x: [startX, x, x, x], y: [laneY, laneY, laneY, y], rotate: [90, 90, 180, 180], times: [0, 0.6, 0.7, 1] });
    } else {
      const x = laneBox.left - box.left + laneBox.width / 2;
      setPath({ x: [startX, x], y: [laneY, laneY], rotate: [90, 90], times: [0, 1] });
    }
  }, [containerRef, laneRef, targetRef]);

  if (!path) return null;
  const end = { x: path.x.at(-1), y: path.y.at(-1), rotate: path.rotate.at(-1) };
  return (
    <m.div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-10 -mt-7 -ml-3.5 h-14 w-7"
      initial={reduce ? end : { x: path.x[0], y: path.y[0], rotate: path.rotate[0] }}
      animate={reduce ? end : { x: path.x, y: path.y, rotate: path.rotate }}
      transition={reduce ? { duration: 0 } : { duration: 1.6, times: path.times, ease: 'easeInOut' }}
      onAnimationComplete={onArrived}
    >
      <svg viewBox="0 0 32 60" className="size-full drop-shadow-lg">
        <rect x="1" y="1" width="30" height="58" rx="9" className="fill-lot-selected" />
        <rect x="4" y="12" width="24" height="11" rx="3.5" className="fill-lot-glass" />
        <rect x="5" y="44" width="22" height="7" rx="3" className="fill-lot-glass" />
      </svg>
    </m.div>
  );
}

export function LotLegend({ items, className }) {
  return (
    <ul aria-label="Bay status legend" className={cn('flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-xs text-lot-text-muted', className)}>
      {items.map(({ label, swatch }) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-3 rounded-[3px]', swatch)} />{label}
        </li>
      ))}
    </ul>
  );
}
