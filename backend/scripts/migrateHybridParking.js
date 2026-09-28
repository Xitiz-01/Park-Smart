const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Booking = require('../models/Booking');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const Vehicle = require('../models/Vehicle');
const ReservationLedger = require('../models/ReservationLedger');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = new Set(process.argv.slice(2));
const getArg = (prefix) => process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const apply = args.has('--apply');
  const expectedDb = getArg('--confirm-db=');
  const parsedDb = new URL(process.env.MONGODB_URI).pathname.replace(/^\//, '').split('?')[0];
  if (apply && (!expectedDb || expectedDb !== parsedDb)) {
    throw new Error(`Refusing writes. Re-run with --apply --confirm-db=${parsedDb}`);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const locations = await ParkingLocation.find();
  const bookings = await Booking.collection.find({}).toArray();
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${locations.length} locations and ${bookings.length} bookings inspected in ${parsedDb}`);
  let locationUpdates = 0;
  let bookingUpdates = 0;
  let ledgerEntries = 0;

  for (const location of locations) {
    const counts = await ParkingSlot.aggregate([
      { $match: { parkingLocation: location._id, vehicleType: { $ne: 'ev' } } },
      { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
    ]);
    const capacity = { ...(location.capacity?.toObject?.() || {}) };
    for (const row of counts) {
      if (!capacity[row._id]) capacity[row._id] = row.count;
    }
    const changed = counts.some((row) => Number(location.capacity?.[row._id] || 0) !== capacity[row._id]);
    if (changed) {
      locationUpdates += 1;
      if (apply) await ParkingLocation.updateOne({ _id: location._id }, { $set: { capacity } });
    }
  }

  for (const booking of bookings) {
    const slot = booking.slot ? await ParkingSlot.findById(booking.slot) : null;
    const vehicle = booking.vehicle ? await Vehicle.findById(booking.vehicle) : null;
    const vehicleType = booking.vehicleType || vehicle?.vehicleType || slot?.vehicleType || 'car';
    const parkingLocation = booking.parkingLocation || slot?.parkingLocation || null;
    const bookingType = booking.bookingType || (slot?.vehicleType === 'ev' ? 'ev' : slot ? 'legacy' : 'regular');
    const hourlyRate = booking.hourlyRate || slot?.pricePerHour || 0;
    const reservationToken = booking.reservationToken || String(booking._id);
    const updates = { vehicleType, parkingLocation, bookingType, hourlyRate, reservationToken };
    bookingUpdates += 1;
    if (apply) await Booking.updateOne({ _id: booking._id }, { $set: updates });

    if (apply && ['upcoming', 'active'].includes(booking.status) && parkingLocation) {
      const ledgerType = bookingType === 'ev' || (vehicleType === 'ev' && slot) ? 'ev' : 'regular';
      const resourceKey = ledgerType === 'ev' ? `ev:${slot?._id}` : `regular:${parkingLocation}:${vehicleType}`;
      await ReservationLedger.updateOne(
        { resourceKey },
        { $setOnInsert: {
          resourceKey, resourceType: ledgerType, parkingLocation, vehicleType,
          slot: ledgerType === 'ev' ? slot?._id : null,
        } },
        { upsert: true }
      );
      const exists = await ReservationLedger.exists({ resourceKey, 'reservations.token': reservationToken });
      if (!exists) {
        await ReservationLedger.updateOne({ resourceKey }, { $push: { reservations: {
          token: reservationToken, booking: booking._id, user: booking.user,
          startTime: booking.startTime, endTime: booking.expectedEndTime, createdAt: booking.createdAt || new Date(),
        } } });
        ledgerEntries += 1;
      }
    }
  }

  if (apply) {
    await Promise.all([ParkingLocation.syncIndexes(), ParkingSlot.syncIndexes(), Booking.syncIndexes(), ReservationLedger.syncIndexes()]);
  }
  console.log(JSON.stringify({ locationUpdates, bookingUpdates, ledgerEntries, applied: apply }, null, 2));
  if (!apply) console.log(`No data changed. To apply: npm run migrate:hybrid-parking -- --apply --confirm-db=${parsedDb}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`Hybrid parking migration failed: ${error.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
