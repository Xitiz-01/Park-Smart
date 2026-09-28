const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const ReservationLedger = require('../models/ReservationLedger');
const { overlappingReservations, resourceKeyFor } = require('./parkingReservationService');

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const parseWindow = (startValue, endValue, { allowPast = false } = {}) => {
  const startTime = new Date(startValue);
  const endTime = new Date(endValue);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
    return { error: 'Start and end times must form a valid time range' };
  }
  if (!allowPast && startTime.getTime() < Date.now() - 5 * 60 * 1000) {
    return { error: 'Start time cannot be in the past' };
  }
  if (endTime - startTime > 7 * 24 * 60 * 60 * 1000) {
    return { error: 'Bookings may not exceed 7 days' };
  }
  return { startTime, endTime };
};

const localDateParts = (instant) => {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
};

const localMidnightUtc = ({ year, month, day }) => Date.UTC(year, month, day) - IST_OFFSET_MS;
const minuteValue = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
};

const isOpenForWindow = (location, startTime, endTime) => {
  if (!location?.operatingHours) return true;
  const startParts = localDateParts(new Date(startTime.getTime() - 24 * 60 * 60 * 1000));
  const endParts = localDateParts(endTime);
  const intervals = [];
  for (let cursor = localMidnightUtc(startParts); cursor <= localMidnightUtc(endParts) + 24 * 60 * 60 * 1000; cursor += 24 * 60 * 60 * 1000) {
    const shifted = new Date(cursor + IST_OFFSET_MS);
    const schedule = location.operatingHours[DAY_NAMES[shifted.getUTCDay()]];
    if (!schedule?.open) continue;
    if (schedule.allDay) {
      intervals.push([cursor, cursor + 24 * 60 * 60 * 1000]);
      continue;
    }
    const open = cursor + minuteValue(schedule.openTime) * 60 * 1000;
    let close = cursor + minuteValue(schedule.closeTime) * 60 * 1000;
    if (close <= open) close += 24 * 60 * 60 * 1000;
    intervals.push([open, close]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let coveredUntil = startTime.getTime();
  for (const [open, close] of intervals) {
    if (open > coveredUntil) break;
    if (close > coveredUntil) coveredUntil = close;
    if (coveredUntil >= endTime.getTime()) return true;
  }
  return false;
};

const regularCapacityFor = (location, vehicleType) => {
  if (vehicleType === 'motorcycle') return location.capacity?.motorcycle ?? location.capacity?.bike ?? 0;
  return location.capacity?.[vehicleType] ?? 0;
};

const getAvailability = async (location, vehicleType, startTime, endTime) => {
  if (vehicleType === 'ev') {
    const slots = await ParkingSlot.find({
      parkingLocation: location._id,
      vehicleType: 'ev',
      evCompatible: true,
    }).lean();
    const isOpen = isOpenForWindow(location, startTime, endTime);
    const ledgers = await ReservationLedger.find({ resourceKey: { $in: slots.map((slot) => `ev:${slot._id}`) } }).lean();
    const ledgerMap = new Map(ledgers.map((ledger) => [ledger.resourceKey, ledger]));
    const legacyConflicts = await Booking.find({
      slot: { $in: slots.map((slot) => slot._id) },
      status: { $in: ['upcoming', 'active'] },
      startTime: { $lt: endTime },
      expectedEndTime: { $gt: startTime },
    }).distinct('slot');
    const unavailable = new Set(legacyConflicts.map(String));
    const evSlots = slots.map((slot) => {
      const held = overlappingReservations(ledgerMap.get(`ev:${slot._id}`), startTime, endTime).length > 0;
      let availabilityStatus = 'available';
      if (slot.status === 'maintenance') availabilityStatus = 'maintenance';
      else if (slot.status === 'occupied') availabilityStatus = 'occupied';
      else if (slot.status === 'reserved' || held || unavailable.has(String(slot._id))) availabilityStatus = 'reserved';
      else if (!isOpen) availabilityStatus = 'unavailable';
      return { ...slot, availabilityStatus, available: availabilityStatus === 'available' };
    });
    const available = evSlots.filter((slot) => slot.available).length;
    return { isOpen, total: slots.length, reserved: slots.length - available, available, evSlots };
  }

  if (!isOpenForWindow(location, startTime, endTime)) {
    return { isOpen: false, total: 0, reserved: 0, available: 0, evSlots: [] };
  }

  const total = regularCapacityFor(location, vehicleType);
  const resourceKey = resourceKeyFor({ bookingType: 'regular', parkingLocationId: location._id, vehicleType });
  const ledger = await ReservationLedger.findOne({ resourceKey }).lean();
  const held = overlappingReservations(ledger, startTime, endTime).length;
  const legacyCount = await Booking.countDocuments({
    parkingLocation: location._id,
    vehicleType,
    bookingType: { $ne: 'regular' },
    reservationToken: null,
    status: { $in: ['upcoming', 'active'] },
    startTime: { $lt: endTime },
    expectedEndTime: { $gt: startTime },
  });
  const reserved = Math.min(total, held + legacyCount);
  return { isOpen: true, total, reserved, available: Math.max(0, total - reserved), evSlots: [] };
};

module.exports = { parseWindow, isOpenForWindow, regularCapacityFor, getAvailability };
