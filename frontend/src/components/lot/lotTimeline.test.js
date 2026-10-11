import { BEATS, LOOP_MS, initialLotState, lotReducer, lotStateAt } from './lotTimeline';
import { bayIds, bayRect, driveKeyframes, initialBays, lotLayout, routePath } from './lotModel';

test('the story loops in about 12 seconds', () => {
  expect(LOOP_MS).toBe(12000);
  expect(BEATS.map((beat) => beat.id)).toEqual(['intro', 'locate', 'route', 'reserve', 'park', 'release']);
});

test('the free counter tells the story: 14, reserve −1, park, release +1', () => {
  expect(lotStateAt('intro').free).toBe(14);
  expect(lotStateAt('intro').total).toBe(24);
  expect(lotStateAt('route').free).toBe(14); // selected is still free
  expect(lotStateAt('reserve').free).toBe(13);
  expect(lotStateAt('park').free).toBe(13);
  expect(lotStateAt('release').free).toBe(14);
});

test('the chosen bay goes selected → reserved → occupied', () => {
  expect(lotStateAt('locate').bays.B4).toBe('available');
  expect(lotStateAt('route').bays.B4).toBe('selected');
  expect(lotStateAt('reserve').bays.B4).toBe('reserved');
  expect(lotStateAt('park').bays.B4).toBe('occupied');
  expect(lotStateAt('park').bays.C2).toBe('occupied');
  expect(lotStateAt('release').bays.C2).toBe('available');
});

test('overlays follow the beats', () => {
  expect(lotStateAt('intro').show.pin).toBe(false);
  expect(lotStateAt('locate').show.highlightFree).toBe(true);
  expect(lotStateAt('route').show.route).toBe(true);
  expect(lotStateAt('reserve').show.card).toBe(true);
  expect(lotStateAt('park').show.route).toBe(false);
  expect(lotStateAt('release').show.liveChip).toBe(true);
});

test('the mobile lot (5 columns) tells the same story', () => {
  const intro = lotStateAt('intro', { columns: 5 });
  expect(intro.total).toBe(15);
  expect(intro.free).toBe(9);
  expect(lotStateAt('reserve', { columns: 5 }).free).toBe(8);
  expect(lotStateAt('release', { columns: 5 }).free).toBe(9);
});

test('reducer ticks through the beats and wraps, resetting the target', () => {
  let state = initialLotState;
  const seen = [];
  for (let i = 0; i < BEATS.length; i += 1) { seen.push(state.beat); state = lotReducer(state, { type: 'tick' }); }
  expect(seen).toEqual(BEATS.map((beat) => beat.id));
  expect(state).toEqual(initialLotState);

  state = lotReducer(state, { type: 'choose', bay: 'A2' });
  expect(state).toEqual({ beat: 'route', target: 'A2' });
  expect(lotStateAt('reserve', { target: state.target }).bays.A2).toBe('reserved');
  for (let i = 0; i < 4; i += 1) state = lotReducer(state, { type: 'tick' });
  expect(state).toEqual(initialLotState);
});

test('choosing a taken bay is refused', () => {
  expect(() => lotStateAt('route', { target: 'A1' })).toThrow();
});

test('routes and drives end inside their bay for every row', () => {
  const layout = lotLayout(8);
  for (const id of ['A2', 'B4', 'C6']) {
    const bay = bayRect(layout, id);
    const last = driveKeyframes(layout, id).at(-1);
    expect(last.x).toBe(bay.cx);
    expect(last.y).toBeGreaterThan(bay.y);
    expect(last.y).toBeLessThan(bay.y + bay.h);
    expect(routePath(layout, id)).toMatch(/^M/);
  }
  expect(bayIds(8)).toHaveLength(24);
  expect(Object.keys(initialBays(5))).toHaveLength(15);
});
