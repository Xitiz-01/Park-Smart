// One status vocabulary for every badge in the app: bookings, payments, slots,
// vendors, verification cases, locations and roles. Tones are semantic, never
// the brand colour, and every badge also shows its text label.

export const STATUS_TONES = {
  // bookings
  upcoming: 'info', active: 'success', completed: 'neutral', cancelled: 'danger',
  // payments
  paid: 'success', pending: 'warning', refunded: 'neutral', failed: 'danger',
  // slots
  available: 'success', reserved: 'warning', occupied: 'danger', maintenance: 'neutral', unavailable: 'neutral',
  // vendors, locations, accounts
  approved: 'success', rejected: 'danger', suspended: 'danger', draft: 'neutral', inactive: 'neutral',
  // verification
  not_started: 'neutral', under_review: 'warning', verified: 'success', resubmission_required: 'danger',
  // roles
  customer: 'neutral', vendor: 'info', admin: 'info', super_admin: 'info',
};

// Labels the generic rule ("UNDER_REVIEW" → "Under review") would get wrong.
const LABELS = {
  super_admin: 'Super admin',
  resubmission_required: 'Resubmission required',
  not_started: 'Not started',
};

export function normalizeStatus(status) {
  return String(status || 'unknown').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function statusTone(status) {
  return STATUS_TONES[normalizeStatus(status)] || 'info';
}

export function statusLabel(status) {
  const key = normalizeStatus(status);
  if (LABELS[key]) return LABELS[key];
  const words = key.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
