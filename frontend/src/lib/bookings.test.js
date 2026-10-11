import { bookingAssignment, bookingLocationName, bookingTimeline, formatRupees, isEvBooking } from './bookings';

const capacity = { bookingType: 'regular', parkingLocation: { name: 'FC Road Multilevel' }, status: 'upcoming', createdAt: '2026-10-11T08:00:00Z' };
const ev = { bookingType: 'ev', slot: { slotNumber: 'EV02' }, parkingLocation: { name: 'FC Road Multilevel' }, status: 'active', createdAt: '2026-10-11T08:00:00Z', checkInTime: '2026-10-11T10:02:00Z' };

test('capacity bookings never claim a numbered bay', () => {
  expect(isEvBooking(capacity)).toBe(false);
  expect(bookingAssignment(capacity)).toBe('Space guaranteed, bay assigned on arrival');
  expect(bookingAssignment(ev)).toBe('EV bay EV02');
  expect(bookingLocationName({ slot: { slotNumber: 'A3' } })).toBe('Bay A3');
});

test('timeline uses only recorded milestones', () => {
  expect(bookingTimeline(ev).map((s) => [s.id, s.done])).toEqual([['booked', true], ['in', true], ['out', false]]);
  const cancelled = bookingTimeline({ ...capacity, status: 'cancelled' });
  expect(cancelled.map((s) => s.id)).toEqual(['booked', 'cancelled']);
  expect(cancelled[1].at).toBeUndefined();
});

test('rupees are formatted with Intl', () => {
  expect(formatRupees(1200)).toBe('₹1,200');
});
