const { z, objectId, dateTime, text, positiveIntString } = require('./common');

const bookingId = z.object({ id: objectId });

const createBooking = z.looseObject({
  parkingLocationId: objectId.optional(),
  // EV bookings (and legacy slot bookings) name a slot; capacity bookings don't.
  slotId: objectId.nullish(),
  vehicleId: objectId,
  startTime: dateTime.optional(),
  expectedEndTime: dateTime.optional(),
  bookingType: z.enum(['ev', 'regular']).optional(),
});

const listBookings = z.looseObject({
  status: text(30).optional(),
  page: positiveIntString.optional(),
  limit: positiveIntString.optional(),
});

module.exports = { bookingId, createBooking, listBookings };
