import { initialBays } from './lotModel';

// The Live Lot story as data. Deterministic: the same beat always produces the
// same picture, so the hero, the how-it-works scroll story and the tests agree.
//
//   intro    lot settles in; some bays taken, a couple reserved, the rest free
//   locate   a "You" pin at the entrance; free bays light up
//   route    a bay is chosen and the route draws itself to it
//   reserve  the booking card slides in; the bay turns Reserved (free − 1)
//   park     the car drives in and parks; the bay turns Occupied
//   release  a car leaves elsewhere; that bay frees up (free + 1)

export const BEATS = [
  { id: 'intro', duration: 1200 },
  { id: 'locate', duration: 1800 },
  { id: 'route', duration: 2000 },
  { id: 'reserve', duration: 2000 },
  { id: 'park', duration: 2500 },
  { id: 'release', duration: 2500 },
];

export const LOOP_MS = BEATS.reduce((sum, beat) => sum + beat.duration, 0);
export const DEFAULT_TARGET = 'B4';
export const LEAVING_BAY = 'C2';

// Which how-it-works step each beat belongs to (Find → Reserve → Park).
export const STEP_FOR_BEAT = { intro: 'find', locate: 'find', route: 'find', reserve: 'reserve', park: 'park', release: 'park' };
// The beat each step shows when the scroll story selects it.
export const BEAT_FOR_STEP = { find: 'route', reserve: 'reserve', park: 'park' };

export function beatIndex(id) {
  return BEATS.findIndex((beat) => beat.id === id);
}

// Picture at a beat: bay states plus which overlays are visible.
export function lotStateAt(beatId, { columns = 8, target = DEFAULT_TARGET } = {}) {
  const index = beatIndex(beatId);
  const bays = initialBays(columns);
  const at = (id) => index >= beatIndex(id);
  if (bays[target] !== 'available') throw new Error(`Target bay ${target} must start available`);

  if (at('route')) bays[target] = 'selected';
  if (at('reserve')) bays[target] = 'reserved';
  if (at('park')) bays[target] = 'occupied';
  if (at('release') && bays[LEAVING_BAY] === 'occupied') bays[LEAVING_BAY] = 'available';

  const total = Object.keys(bays).length;
  const free = Object.values(bays).filter((state) => state === 'available' || state === 'selected').length;
  return {
    beat: beatId,
    step: STEP_FOR_BEAT[beatId],
    target,
    bays,
    free,
    total,
    show: {
      pin: at('locate'),
      highlightFree: beatId === 'locate',
      route: at('route') && !at('park'),
      card: at('reserve') && !at('release'),
      parkedCar: at('park'),
      leaving: beatId === 'release',
      liveChip: beatId === 'release',
    },
  };
}

// Reducer behind useLotTimeline. Pure, so it is unit tested directly.
//   tick      advance to the next beat (wraps to intro, resetting the target)
//   goTo      jump to a beat (scroll story, reduced motion)
//   choose    a person picked a free bay: replay the story from `route` there
//             (or jump to `action.beat`, e.g. the reserve still under reduced motion)
export function lotReducer(state, action) {
  switch (action.type) {
    case 'tick': {
      const next = (beatIndex(state.beat) + 1) % BEATS.length;
      return next === 0 ? { beat: 'intro', target: DEFAULT_TARGET } : { ...state, beat: BEATS[next].id };
    }
    case 'goTo':
      return { ...state, beat: action.beat };
    case 'choose':
      return { beat: action.beat || 'route', target: action.bay };
    default:
      return state;
  }
}

export const initialLotState = { beat: 'intro', target: DEFAULT_TARGET };
