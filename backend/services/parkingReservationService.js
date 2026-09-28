const crypto = require('crypto');
const ReservationLedger = require('../models/ReservationLedger');

const ACTIVE_STATUSES = ['upcoming', 'active'];
const HOLD_TTL_MS = 5 * 60 * 1000;

const resourceKeyFor = ({ bookingType, parkingLocationId, vehicleType, slotId }) => (
  bookingType === 'ev'
    ? `ev:${slotId}`
    : `regular:${parkingLocationId}:${vehicleType}`
);

const ensureLedger = async ({ bookingType, parkingLocationId, vehicleType, slotId }) => {
  const resourceKey = resourceKeyFor({ bookingType, parkingLocationId, vehicleType, slotId });
  try {
    await ReservationLedger.updateOne(
      { resourceKey },
      { $setOnInsert: {
        resourceKey,
        resourceType: bookingType,
        parkingLocation: parkingLocationId,
        vehicleType,
        slot: bookingType === 'ev' ? slotId : null,
        reservations: [],
      } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return resourceKey;
};

const acquireReservation = async ({ bookingType, parkingLocationId, vehicleType, slotId, userId, startTime, endTime, capacity }) => {
  const resourceKey = await ensureLedger({ bookingType, parkingLocationId, vehicleType, slotId });
  const cutoff = new Date(Date.now() - HOLD_TTL_MS);
  const historyCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await ReservationLedger.updateOne(
    { resourceKey },
    { $pull: { reservations: { $or: [
      { booking: null, createdAt: { $lt: cutoff } },
      { endTime: { $lt: historyCutoff } },
    ] } } }
  );

  const token = crypto.randomUUID();
  const ledger = await ReservationLedger.findOneAndUpdate(
    {
      resourceKey,
      $expr: {
        $lt: [
          {
            $size: {
              $filter: {
                input: { $ifNull: ['$reservations', []] },
                as: 'reservation',
                cond: {
                  $and: [
                    { $lt: ['$$reservation.startTime', endTime] },
                    { $gt: ['$$reservation.endTime', startTime] },
                  ],
                },
              },
            },
          },
          capacity,
        ],
      },
    },
    { $push: { reservations: { token, booking: null, user: userId, startTime, endTime, createdAt: new Date() } } },
    { new: true }
  );

  if (!ledger) return null;
  return { resourceKey, token };
};

const attachBooking = (token, bookingId) => ReservationLedger.updateOne(
  { 'reservations.token': token },
  { $set: { 'reservations.$.booking': bookingId } }
);

const releaseReservation = (token) => {
  if (!token) return Promise.resolve();
  return ReservationLedger.updateOne(
    { 'reservations.token': token },
    { $pull: { reservations: { token } } }
  );
};

const overlappingReservations = (ledger, startTime, endTime) => {
  const cutoff = Date.now() - HOLD_TTL_MS;
  return (ledger?.reservations || []).filter((reservation) => (
    reservation.startTime < endTime
    && reservation.endTime > startTime
    && (reservation.booking || new Date(reservation.createdAt).getTime() >= cutoff)
  ));
};

module.exports = {
  ACTIVE_STATUSES,
  acquireReservation,
  attachBooking,
  releaseReservation,
  overlappingReservations,
  resourceKeyFor,
};
