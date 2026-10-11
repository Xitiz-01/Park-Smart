// Geometry and starting state of the illustrative Live Lot.
//
// Three rows of bays on a one-way U-shaped lane: cars enter top-left, aisle 1
// serves rows A (above) and B (below), the lane turns at the right edge, and
// aisle 2 serves row C before exiting bottom-left. Coordinates are SVG user
// units; everything is derived from the column count so the mobile lot (5
// columns) and the desktop lot (8) share one model.

export const BAY_W = 64;
export const BAY_L = 92;
const LEFT = 104; // entrance apron width
const TURN = 88; // width of the U-turn at the right
const AISLE = 76;

export const ROWS = ['A', 'B', 'C'];

export function lotLayout(columns = 8) {
  const rowAy = 20;
  const aisle1 = rowAy + BAY_L; // top edge of aisle 1
  const rowBy = aisle1 + AISLE;
  const rowCy = rowBy + BAY_L; // B and C are back to back
  const aisle2 = rowCy + BAY_L;
  const right = LEFT + columns * BAY_W;
  const width = right + TURN;
  const height = aisle2 + AISLE + 20;
  return {
    columns, width, height, left: LEFT, right,
    aisle1: { y: aisle1, mid: aisle1 + AISLE / 2 },
    aisle2: { y: aisle2, mid: aisle2 + AISLE / 2 },
    turnMidX: right + TURN / 2,
    rows: {
      A: { y: rowAy, opens: 'down' },
      B: { y: rowBy, opens: 'up' },
      C: { y: rowCy, opens: 'down' },
    },
  };
}

export function bayRect(layout, id) {
  const row = id[0];
  const col = Number(id.slice(1)) - 1;
  const { y } = layout.rows[row];
  const x = layout.left + col * BAY_W;
  return { x, y, w: BAY_W, h: BAY_L, cx: x + BAY_W / 2, cy: y + BAY_L / 2 };
}

export function bayIds(columns) {
  return ROWS.flatMap((row) => Array.from({ length: columns }, (_, i) => `${row}${i + 1}`));
}

// EV bays carry a charger; A5 starts out charging an EV.
export const EV_BAYS = { A4: 22, A5: 60 };

// Starting picture (desktop): 8 occupied + 2 reserved → 14 of 24 free.
// Every bay the story touches sits in the first five columns, so the mobile
// lot tells the same story.
const INITIAL = {
  A1: 'occupied', A3: 'occupied', A5: 'occupied', A7: 'occupied',
  B1: 'occupied', B6: 'occupied', C2: 'occupied', C5: 'occupied',
  B7: 'reserved', C7: 'reserved',
};

export function initialBays(columns = 8) {
  return Object.fromEntries(bayIds(columns).map((id) => [id, INITIAL[id] || 'available']));
}

export const RATE_PER_HOUR = 60; // illustrative

// The route a driver takes from the entrance to a bay: along aisle 1, or round
// the U-turn into aisle 2 for row C. Returned as SVG path data.
export function routePath(layout, id) {
  const bay = bayRect(layout, id);
  const startX = 44; // the "You" pin, just outside the barrier
  const a1 = layout.aisle1.mid;
  if (id[0] === 'A') return `M${startX} ${a1} H${bay.cx} V${bay.y + BAY_L * 0.55}`;
  if (id[0] === 'B') return `M${startX} ${a1} H${bay.cx} V${bay.y + BAY_L * 0.45}`;
  const a2 = layout.aisle2.mid;
  return `M${startX} ${a1} H${layout.turnMidX} V${a2} H${bay.cx} V${bay.y + BAY_L * 0.45}`;
}

// The same journey as transform keyframes for the car (heading in degrees:
// 0 = facing right). Corners are explicit so the car turns, not slides.
export function driveKeyframes(layout, id) {
  const bay = bayRect(layout, id);
  const a1 = layout.aisle1.mid;
  const entry = { x: -40, y: a1, rotate: 0 };
  if (id[0] === 'C') {
    const a2 = layout.aisle2.mid;
    return [
      entry,
      { x: layout.turnMidX, y: a1, rotate: 0 },
      { x: layout.turnMidX, y: a1, rotate: 90 },
      { x: layout.turnMidX, y: a2, rotate: 90 },
      { x: layout.turnMidX, y: a2, rotate: 180 },
      { x: bay.cx, y: a2, rotate: 180 },
      { x: bay.cx, y: a2, rotate: 270 },
      { x: bay.cx, y: bay.cy, rotate: 270 },
    ];
  }
  const into = id[0] === 'A' ? -90 : 90;
  return [
    entry,
    { x: bay.cx, y: a1, rotate: 0 },
    { x: bay.cx, y: a1, rotate: into },
    { x: bay.cx, y: bay.cy, rotate: into },
  ];
}

// A parked car reversing out of row C and leaving through the bottom exit.
export function leaveKeyframes(layout, id) {
  const bay = bayRect(layout, id);
  const a2 = layout.aisle2.mid;
  return [
    { x: bay.cx, y: bay.cy, rotate: 270 },
    { x: bay.cx, y: a2, rotate: 270 },
    { x: bay.cx, y: a2, rotate: 180 },
    { x: -60, y: a2, rotate: 180 },
  ];
}
