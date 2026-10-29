import { format } from 'date-fns';

// Display helpers shared by the driver dashboard, My bookings and the
// operator's bookings table. Pure, so they're easy to test.

export const isEvBooking = (booking) => booking?.bookingType !== 'regular' && Boolean(booking?.slot?.slotNumber);

export const bookingLocationName = (booking) => booking?.parkingLocation?.name
  || booking?.slot?.parkingLocation?.name
  || (booking?.slot?.slotNumber ? `Bay ${booking.slot.slotNumber}` : 'Parking reservation');

// What the driver holds: an exact bay, or a space from the capacity pool.
// (The old dashboard printed "Slot · Zone" with blanks for capacity bookings.)
export const bookingAssignment = (booking) => {
  if (booking?.bookingType === 'regular') return 'Space guaranteed, bay assigned on arrival';
  if (booking?.slot?.slotNumber) return `${booking.bookingType === 'ev' ? 'EV bay' : 'Bay'} ${booking.slot.slotNumber}`;
  return 'Legacy reservation';
};

export const bookingWindow = (booking) => {
  const start = new Date(booking.startTime);
  const end = new Date(booking.expectedEndTime || booking.endTime || booking.startTime);
  const sameDay = start.toDateString() === end.toDateString();
  return `${format(start, 'EEE d MMM, HH:mm')}–${format(end, sameDay ? 'HH:mm' : 'EEE d MMM, HH:mm')}`;
};

export const formatRupees = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);

// Real milestones only: booked (createdAt), checked in, checked out, or
// cancelled (no time is shown for a cancellation; the API doesn't record one).
export const bookingTimeline = (booking) => {
  const steps = [{ id: 'booked', label: 'Booked', at: booking.createdAt, done: true }];
  if (booking.status === 'cancelled') {
    steps.push({ id: 'cancelled', label: 'Cancelled', done: true, tone: 'danger' });
    return steps;
  }
  steps.push({ id: 'in', label: 'Checked in', at: booking.checkInTime, done: Boolean(booking.checkInTime) || ['active', 'completed'].includes(booking.status) });
  steps.push({ id: 'out', label: 'Checked out', at: booking.checkOutTime, done: Boolean(booking.checkOutTime) || booking.status === 'completed' });
  return steps;
};

// Real capacity of the booked vehicle type at the location (legacy suv/bike
// buckets count towards car/motorcycle, as the backend does).
const CAPACITY_ALIASES = { car: ['car', 'suv'], motorcycle: ['motorcycle', 'bike'], suv: ['car', 'suv'], bike: ['motorcycle', 'bike'] };
export const capacityForBooking = (booking) => {
  const capacity = booking?.parkingLocation?.capacity;
  if (!capacity) return null;
  const types = CAPACITY_ALIASES[booking.vehicleType] || [booking.vehicleType];
  const total = types.reduce((sum, type) => sum + Number(capacity[type] || 0), 0);
  return total || null;
};
