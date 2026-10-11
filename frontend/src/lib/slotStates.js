// The six bay states, shared by the booking EV board, vendor slot operations
// and the landing page's Live Lot so all three speak the same language.
// Each state has a text label; colour is never the only signal.

export const SLOT_STATES = ['available', 'selected', 'reserved', 'occupied', 'maintenance', 'unavailable'];

export const SLOT_STATE_LABELS = {
  available: 'Available',
  selected: 'Selected',
  reserved: 'Reserved',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
  unavailable: 'Unavailable',
};

export function slotStateLabel(state) {
  return SLOT_STATE_LABELS[state] || SLOT_STATE_LABELS.unavailable;
}

// Accessible name used for every bay: "EV02, 60 kilowatt, Available".
export function slotAccessibleName({ id, powerKw, state }) {
  const parts = [id];
  if (powerKw !== undefined && powerKw !== null) parts.push(`${powerKw || 0} kilowatt`);
  parts.push(slotStateLabel(state));
  return parts.join(', ');
}
