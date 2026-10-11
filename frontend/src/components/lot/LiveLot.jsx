import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, m, useInView, useReducedMotion } from 'motion/react';
import { MapPin, Pause, Play, Radio } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { slotStateLabel } from '@/lib/slotStates';
import {
  BAY_L, BAY_W, EV_BAYS, RATE_PER_HOUR, bayIds, bayRect, driveKeyframes, leaveKeyframes, lotLayout, routePath,
} from './lotModel';
import { LEAVING_BAY, lotStateAt } from './lotTimeline';
import useLotTimeline from './useLotTimeline';

// The Live Lot: an illustrative, top-down parking lot that explains ParkSmart
// in one loop (find → route → reserve → park → a bay frees up). The SVG is the
// picture; a layer of real buttons over the bays carries the accessible names,
// tooltips and the "pick a bay" interaction.
//
// variant
//   hero   autoplays, interactive, pause control
//   story  beat is controlled by the how-it-works scroll story
//   mini   compact, autoplays, decorative (auth screens)

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

// Car drawn facing right (0°), centred on the origin.
function CarShape({ tone = 1 }) {
  const body = ['fill-lot-car-1', 'fill-lot-car-2', 'fill-lot-car-3'][tone % 3];
  return (
    <g>
      <rect x="-30" y="-16" width="60" height="32" rx="9" className={body} />
      <rect x="7" y="-13" width="12" height="26" rx="4" className="fill-lot-glass" />
      <rect x="-24" y="-12" width="9" height="24" rx="3" className="fill-lot-glass" />
      <rect x="-12" y="-12" width="17" height="24" rx="3" className={body} opacity="0.7" />
    </g>
  );
}

const PARKED_HEADING = { A: -90, B: 90, C: -90 };
const GATE_X = 82;
const PIN_X = 44;

function poseAt(keyframes, progress) {
  // Distance-weighted interpolation; pure turns count as a short distance.
  const lengths = keyframes.slice(1).map((k, i) => Math.hypot(k.x - keyframes[i].x, k.y - keyframes[i].y) || 18);
  const total = lengths.reduce((a, b) => a + b, 0);
  let d = progress * total;
  for (let i = 0; i < lengths.length; i += 1) {
    if (d <= lengths[i] || i === lengths.length - 1) {
      const t = Math.min(1, d / lengths[i]);
      const a = keyframes[i]; const b = keyframes[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, rotate: a.rotate + (b.rotate - a.rotate) * t };
    }
    d -= lengths[i];
  }
  return keyframes.at(-1);
}

// Stable easing curves: a fresh array each render would restart the drive.
const EASE_ARRIVE = [0.45, 0, 0.25, 1];
const EASE_LEAVE = [0.4, 0, 0.6, 1];

function MovingCar({ keyframes, duration, tone, ease = EASE_ARRIVE }) {
  const [pose, setPose] = useState(keyframes[0]);
  useEffect(() => {
    const controls = animate(0, 1, { duration, ease, onUpdate: (p) => setPose(poseAt(keyframes, p)) });
    return () => controls.stop();
  }, [keyframes, duration, ease]);
  return (
    <g transform={`translate(${pose.x} ${pose.y}) rotate(${pose.rotate})`}>
      <CarShape tone={tone} />
    </g>
  );
}

function Bolt({ x, y }) {
  return <path d={`M${x + 2} ${y - 11} L${x - 6} ${y + 2} H${x} L${x - 2} ${y + 11} L${x + 6} ${y - 2} H${x} Z`} className="fill-lot-ev" />;
}

function Bay({ id, state, layout, highlight, parked, charging, playing }) {
  const r = bayRect(layout, id);
  const row = layout.rows[id[0]];
  const backY = row.opens === 'down' ? r.y + 12 : r.y + r.h - 6;
  const lampY = row.opens === 'down' ? r.y + 10 : r.y + r.h - 10;
  const inset = { x: r.x + 7, y: r.y + 7, w: r.w - 14, h: r.h - 14 };
  const ev = id in EV_BAYS;
  const lamp = { available: 'fill-lot-available', selected: 'fill-lot-selected', reserved: 'fill-lot-reserved', occupied: 'fill-lot-text-muted' }[state];

  return (
    <g>
      {(state === 'available' || state === 'selected') && (
        <rect {...{ x: inset.x, y: inset.y, width: inset.w, height: inset.h }} rx="6"
          className="fill-lot-available transition-opacity duration-300" opacity={highlight ? 0.3 : 0.12} />
      )}
      {state === 'reserved' && (
        <rect {...{ x: inset.x, y: inset.y, width: inset.w, height: inset.h }} rx="6"
          className="fill-lot-reserved stroke-lot-reserved" fillOpacity="0.1" strokeWidth="2.5" strokeDasharray="7 5" />
      )}
      {state === 'selected' && (
        <rect x={inset.x - 3} y={inset.y - 3} width={inset.w + 6} height={inset.h + 6} rx="8"
          fill="none" className="stroke-lot-selected" strokeWidth="3" />
      )}
      {ev && !parked && <Bolt x={r.cx} y={r.cy} />}
      {parked && (
        <g transform={`translate(${r.cx} ${r.cy}) rotate(${PARKED_HEADING[id[0]]})`}>
          <CarShape tone={id.charCodeAt(0) + Number(id.slice(1))} />
        </g>
      )}
      {charging && (
        <g>
          <rect x={r.x + 12} y={backY + 8} width={r.w - 24} height="4" rx="2" className="fill-lot-aisle" />
          <m.rect
            x={r.x + 12} y={backY + 8} width={r.w - 24} height="4" rx="2" className="fill-lot-ev"
            style={{ transformBox: 'fill-box', originX: 0 }}
            initial={{ scaleX: 0.35 }}
            animate={playing ? { scaleX: [0.35, 0.9] } : { scaleX: 0.6 }}
            transition={playing ? { duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'linear' } : { duration: 0 }}
          />
        </g>
      )}
      <circle cx={r.x + r.w - 12} cy={lampY} r="3.5" className={cn(lamp, 'transition-[fill] duration-300')} />
      <text x={r.x + 9} y={row.opens === 'down' ? r.y + 15 : r.y + r.h - 7} className="fill-lot-text-muted font-mono" fontSize="11">{id}</text>
    </g>
  );
}

const STEPS = [
  { id: 'find', label: 'Find' },
  { id: 'reserve', label: 'Reserve' },
  { id: 'park', label: 'Park' },
];

export default function LiveLot({ variant = 'hero', beat: controlledBeat, className }) {
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const wide = useMediaQuery('(min-width: 640px)');
  const columns = variant === 'mini' || !wide ? 5 : 8;
  const layout = useMemo(() => lotLayout(columns), [columns]);
  const inView = useInView(rootRef, { amount: 0.25 });
  const pageVisible = usePageVisible();
  const [paused, setPaused] = useState(false);
  const playing = inView && pageVisible && !paused;
  const timeline = useLotTimeline({ playing, reducedMotion: Boolean(reduceMotion), beat: variant === 'story' ? controlledBeat : undefined });
  const lot = lotStateAt(timeline.beat, { columns, target: timeline.target });
  const interactive = variant === 'hero';
  const animated = !reduceMotion && playing;
  const pct = (value, of) => `${(value / of) * 100}%`;

  // One tab stop for the whole lot; arrow keys move bay to bay like a grid.
  const ids = bayIds(columns);
  const [focusBay, setFocusBay] = useState('A2');
  const onBayKeyDown = (event) => {
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    let next;
    if (event.key in moves) next = ids.indexOf(event.currentTarget.dataset.bay) + moves[event.key];
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ids.length - 1;
    else return;
    event.preventDefault();
    const id = ids[Math.max(0, Math.min(ids.length - 1, next))];
    setFocusBay(id);
    event.currentTarget.parentElement.querySelector(`[data-bay="${id}"]`)?.focus();
  };

  const target = bayRect(layout, lot.target);
  const route = routePath(layout, lot.target);
  const drive = useMemo(() => driveKeyframes(layout, lot.target), [layout, lot.target]);
  const leave = useMemo(() => leaveKeyframes(layout, LEAVING_BAY), [layout]);
  const description = `Illustration of a parking lot with ${lot.total} bays. A driver finds a free bay, follows the route to bay ${lot.target} and reserves it, then parks; elsewhere bay ${LEAVING_BAY} frees up. ${lot.free} of ${lot.total} bays are free.`;

  return (
    <figure ref={rootRef} className={cn('relative isolate overflow-hidden rounded-2xl bg-lot-asphalt text-lot-text shadow-overlay ring-1 ring-black/5 dark:ring-white/10', className)}>
      {variant !== 'mini' && (
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          <p className="font-display text-lg font-semibold sm:text-xl">
            <span className="relative inline-flex overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={lot.free}
                  className="inline-block font-mono tabular-nums"
                  initial={animated ? { y: -10, opacity: 0 } : false}
                  animate={{ y: 0, opacity: 1 }}
                  exit={animated ? { y: 10, opacity: 0 } : undefined}
                  transition={{ duration: 0.25 }}
                >
                  {lot.free}
                </m.span>
              </AnimatePresence>
            </span>
            {' '}of {lot.total} free
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-lot-text-muted">Illustrative</span>
            {interactive && !reduceMotion && (
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                aria-label={paused ? 'Play animation' : 'Pause animation'}
                className="grid size-9 place-items-center rounded-lg text-lot-text-muted hover:bg-white/10 hover:text-lot-text focus-visible:outline-2 focus-visible:outline-lot-selected pointer-coarse:size-11"
              >
                {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative" style={{ aspectRatio: `${layout.width} / ${layout.height}` }}>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-labelledby={`${uid}-title ${uid}-desc`} className="absolute inset-0 size-full">
          <title id={`${uid}-title`}>Live Lot</title>
          <desc id={`${uid}-desc`}>{description}</desc>
          <defs>
            <mask id={`${uid}-route`} maskUnits="userSpaceOnUse">
              <m.path
                d={route}
                fill="none"
                stroke="white"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: animated ? 0 : 1 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: animated ? 1.2 : 0, ease: [0.2, 0.8, 0.2, 1] }}
                key={`${lot.target}-${lot.show.route}`}
              />
            </mask>
          </defs>

          {/* lane: aisle 1, the U-turn, aisle 2 */}
          <rect x="0" y={layout.aisle1.y} width={layout.width} height={layout.aisle1.mid * 2 - layout.aisle1.y * 2} className="fill-lot-aisle" />
          <rect x={layout.right} y={layout.aisle1.y} width={layout.width - layout.right} height={layout.aisle2.y + (layout.aisle2.mid - layout.aisle2.y) * 2 - layout.aisle1.y} className="fill-lot-aisle" />
          <rect x="0" y={layout.aisle2.y} width={layout.width} height={(layout.aisle2.mid - layout.aisle2.y) * 2} className="fill-lot-aisle" />
          <path
            d={`M0 ${layout.aisle1.mid} H${layout.turnMidX} V${layout.aisle2.mid} H0`}
            fill="none" className="stroke-lot-dash" strokeWidth="2.5" strokeDasharray="16 14" opacity="0.6"
          />
          {/* one-way arrows */}
          {[
            [layout.left + 24, layout.aisle1.mid + 18, 0],
            [layout.turnMidX + 20, (layout.aisle1.mid + layout.aisle2.mid) / 2, 90],
            [layout.left - 52, layout.aisle2.mid + 18, 180],
          ].map(([x, y, r]) => (
            <path key={`${x}-${y}`} d="M-9 -7 L5 0 L-9 7" fill="none" className="stroke-lot-line" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" transform={`translate(${x} ${y}) rotate(${r})`} />
          ))}
          {/* entrance: a parking sign, a kerb island and the barrier arm */}
          <g transform={`translate(26 ${layout.rows.A.y + 18})`}>
            <rect width="44" height="44" rx="9" className="fill-logo-tile" />
            <path d="M15 35V10h7.5a7.5 7.5 0 0 1 0 15H15" fill="none" className="stroke-logo-glyph" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="20" y="44" width="4" height="22" rx="1" className="fill-lot-text-muted" />
          </g>
          <rect x="18" y={layout.rows.B.y + 18} width={layout.left - 40} height={layout.aisle2.y - layout.rows.B.y - 36} rx="14" className="fill-lot-aisle stroke-lot-line" strokeOpacity="0.25" strokeWidth="2" />
          <g>
            <circle cx={GATE_X} cy={layout.aisle1.y + 6} r="5" className="fill-lot-text-muted" />
            <m.rect
              x={GATE_X - 2.5}
              y={layout.aisle1.y + 6}
              width="5"
              height={layout.aisle1.mid * 2 - layout.aisle1.y * 2 - 12}
              rx="2.5"
              className="fill-lot-reserved"
              style={{ transformBox: 'view-box', transformOrigin: `${GATE_X}px ${layout.aisle1.y + 6}px` }}
              animate={{ rotate: animated && lot.beat === 'park' ? -84 : 0 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1], delay: animated && lot.beat === 'park' ? 0 : 0.2 }}
            />
          </g>
          <text x="14" y={layout.aisle1.y + 16} className="fill-lot-text-muted font-mono" fontSize="11">IN</text>
          <text x="14" y={layout.aisle2.y + (layout.aisle2.mid - layout.aisle2.y) * 2 - 8} className="fill-lot-text-muted font-mono" fontSize="11">OUT</text>

          {/* painted bay lines */}
          <g className="stroke-lot-line" strokeWidth="2.5" opacity="0.75">
            {['A', 'B', 'C'].map((row) => {
              const { y } = layout.rows[row];
              return Array.from({ length: columns + 1 }, (_, i) => {
                const x = layout.left + i * BAY_W;
                return <line key={`${row}${i}`} x1={x} x2={x} y1={y} y2={y + BAY_L} />;
              });
            })}
            <line x1={layout.left} x2={layout.right} y1={layout.rows.A.y} y2={layout.rows.A.y} />
            <line x1={layout.left} x2={layout.right} y1={layout.rows.C.y} y2={layout.rows.C.y} />
          </g>

          {bayIds(columns).map((id) => {
            const state = lot.bays[id];
            const drivingIn = lot.beat === 'park' && id === lot.target;
            const leaving = lot.beat === 'release' && id === LEAVING_BAY;
            return (
              <Bay
                key={id}
                id={id}
                layout={layout}
                state={drivingIn ? 'reserved' : state}
                highlight={lot.show.highlightFree && state === 'available'}
                parked={state === 'occupied' && !drivingIn && !leaving}
                charging={id === 'A5' && state === 'occupied'}
                playing={animated}
              />
            );
          })}

          {lot.show.route && (
            <path d={route} mask={`url(#${uid}-route)`} fill="none" className="stroke-lot-dash" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 11" />
          )}

          {lot.show.pin && (
            <g transform={`translate(${PIN_X} ${layout.aisle1.mid})`}>
              {animated && lot.beat === 'locate' && (
                <m.circle r="16" className="fill-lot-selected" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: 3, opacity: 0 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} />
              )}
              <circle r="13" className="fill-lot-selected" />
              <circle r="5" className="fill-lot-asphalt" />
            </g>
          )}

          {lot.beat === 'park' && (animated
            ? <MovingCar keyframes={drive} duration={2.1} tone={2} />
            : <g transform={`translate(${target.cx} ${target.cy}) rotate(${PARKED_HEADING[lot.target[0]]})`}><CarShape tone={2} /></g>)}
          {lot.beat === 'release' && animated && <MovingCar keyframes={leave} duration={2} tone={1} ease={EASE_LEAVE} />}
        </svg>

        {/* Bays as buttons: names, tooltips and "pick a bay" */}
        {interactive && (
          <div className="absolute inset-0" role="group" aria-label="Bays in the illustrative lot. Use the arrow keys to move between bays.">
            {bayIds(columns).map((id) => {
              const r = bayRect(layout, id);
              const state = lot.bays[id];
              const power = EV_BAYS[id];
              const label = `${id}${power ? `, EV ${power} kW` : ''}, ${slotStateLabel(state)}, ₹${RATE_PER_HOUR} per hour`;
              const selectable = state === 'available';
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-bay={id}
                      tabIndex={id === focusBay ? 0 : -1}
                      onFocus={() => setFocusBay(id)}
                      onKeyDown={onBayKeyDown}
                      aria-label={selectable ? `${label}. Reserve this bay` : label}
                      aria-disabled={!selectable || undefined}
                      onClick={() => { if (selectable) timeline.choose(id); }}
                      className="absolute rounded-md outline-offset-0 focus-visible:outline-2 focus-visible:outline-lot-selected aria-disabled:cursor-default"
                      style={{ left: pct(r.x + 3, layout.width), top: pct(r.y + 3, layout.height), width: pct(r.w - 6, layout.width), height: pct(r.h - 6, layout.height) }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="font-mono">{id}</span> · {power ? `EV ${power} kW · ` : ''}{slotStateLabel(state)} · <span className="font-mono">₹{RATE_PER_HOUR}/hr</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        {/* Story overlays */}
        <AnimatePresence>
          {lot.show.route && variant !== 'mini' && (
            <m.div
              key="eta"
              initial={animated ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute rounded-lg bg-lot-text px-2.5 py-1 text-xs font-medium text-lot-asphalt shadow-raised"
              style={{ left: pct(target.x, layout.width), top: pct(lot.target[0] === 'A' ? target.y + target.h + 8 : target.y - 30, layout.height) }}
            >
              Route to <span className="font-mono">{lot.target}</span>
            </m.div>
          )}
          {lot.show.card && variant !== 'mini' && (
            <m.div
              key="card"
              initial={animated ? { opacity: 0, y: 16 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="pointer-events-none absolute right-3 bottom-3 w-48 rounded-xl bg-surface-raised p-3 text-foreground shadow-overlay sm:right-4 sm:bottom-4 sm:w-56"
            >
              <p className="flex items-center justify-between text-xs text-text-muted">
                Reserved for you
                <span className="rounded-md bg-slot-reserved-soft px-1.5 py-0.5 font-medium text-slot-reserved">Reserved</span>
              </p>
              <p className="mt-1.5 font-display text-lg font-semibold">Bay <span className="font-mono">{lot.target}</span></p>
              <dl className="mt-1 grid grid-cols-2 gap-x-2 text-xs">
                <dt className="text-text-muted">Today</dt><dd className="text-right font-mono">10:00–12:00</dd>
                <dt className="text-text-muted">Rate</dt><dd className="text-right font-mono">₹{RATE_PER_HOUR}/hr</dd>
              </dl>
            </m.div>
          )}
          {lot.show.liveChip && variant !== 'mini' && (
            <m.div
              key="live"
              initial={animated ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inline-flex items-center gap-1.5 rounded-lg bg-lot-text px-2.5 py-1 text-xs font-medium text-lot-asphalt shadow-raised"
              style={{ left: pct(bayRect(layout, LEAVING_BAY).x, layout.width), top: pct(bayRect(layout, LEAVING_BAY).y - 30, layout.height) }}
            >
              <Radio className="size-3.5" aria-hidden="true" /><span className="font-mono">{LEAVING_BAY}</span> just freed up
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {variant === 'hero' && (
        <ol className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-sm sm:px-5" aria-label="Where the story is">
          {STEPS.map((step, i) => {
            const active = lot.step === step.id;
            return (
              <li key={step.id} aria-current={active ? 'step' : undefined} className={cn('flex items-center gap-2 transition-colors duration-200', active ? 'text-lot-text' : 'text-lot-text-muted')}>
                <span className={cn('grid size-6 place-items-center rounded-md font-mono text-xs transition-colors duration-200', active ? 'bg-lot-selected text-lot-asphalt' : 'bg-white/10')}>{i + 1}</span>
                {step.label}
              </li>
            );
          })}
          <li className="hidden items-center gap-1.5 text-xs text-lot-text-muted sm:flex"><MapPin className="size-3.5" aria-hidden="true" />Tap a free bay</li>
        </ol>
      )}

      {reduceMotion && variant !== 'mini' && (
        <figcaption className="border-t border-white/10 px-4 py-3 text-sm text-lot-text-muted sm:px-5">{description}</figcaption>
      )}
    </figure>
  );
}
