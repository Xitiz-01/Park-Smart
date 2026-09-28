const Booking = require('../models/Booking');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const Vehicle = require('../models/Vehicle');
const { hasPermission } = require('../auth/permissions');
const { parseWindow, isOpenForWindow, regularCapacityFor } = require('../services/parkingAvailabilityService');
const { acquireReservation, attachBooking, releaseReservation } = require('../services/parkingReservationService');
const {
  isElectricVehicle,
  physicalVehicleType,
  inventoryVehicleType,
} = require('../utils/vehicleClassification');

const populateBooking = (query) => query
  .populate('parkingLocation', 'name address location pricing capacity operatingHours amenities evSupported')
  .populate({ path: 'slot', populate: { path: 'parkingLocation', select: 'name address' } })
  .populate('vehicle')
  .populate('user', 'name email phone');

const emitAvailabilityChanged = async (req, booking) => {
  const io = req.app.get('io');
  if (!io) return;
  const locationId = booking.parkingLocation || booking.slot?.parkingLocation;
  io.emit('booking:changed', { bookingId: booking._id, locationId, status: booking.status });
  if (locationId) io.emit('availability:changed', { locationId, vehicleType: booking.vehicleType });
  if (booking.slot) {
    const slotId = booking.slot._id || booking.slot;
    const slot = await ParkingSlot.findById(slotId).populate('currentBooking');
    if (slot) io.emit('slot:updated', slot);
  }
};

const createLegacyBooking = async ({ req, slot, vehicle, startTime, endTime }) => {
  if (slot.status !== 'available') throw Object.assign(new Error('Slot is not available'), { statusCode: 409 });
  const conflict = await Booking.exists({
    slot: slot._id, status: { $in: ['upcoming', 'active'] },
    startTime: { $lt: endTime }, expectedEndTime: { $gt: startTime },
  });
  if (conflict) throw Object.assign(new Error('Slot is not available for the selected time'), { statusCode: 409 });
  const hours = Math.ceil((endTime - startTime) / 3600000);
  const booking = await Booking.create({
    user: req.user._id, slot: slot._id, parkingLocation: slot.parkingLocation || null,
    bookingType: 'legacy', vehicleType: physicalVehicleType(vehicle), vehicle: vehicle._id,
    startTime, expectedEndTime: endTime, hourlyRate: slot.pricePerHour,
    totalAmount: hours * slot.pricePerHour, status: 'upcoming', paymentStatus: 'pending',
  });
  slot.status = 'reserved';
  slot.currentBooking = booking._id;
  await slot.save();
  return booking;
};

const createBooking = async (req, res) => {
  let reservation;
  let createdBooking;
  try {
    const { parkingLocationId, slotId, vehicleId, startTime, expectedEndTime } = req.body;
    const window = parseWindow(startTime, expectedEndTime);
    if (window.error) return res.status(400).json({ success: false, message: window.error });
    const vehicle = await Vehicle.findOne({ _id: vehicleId, user: req.user._id });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    if (!parkingLocationId) {
      const legacySlot = await ParkingSlot.findById(slotId);
      if (!legacySlot) return res.status(404).json({ success: false, message: 'Slot not found' });
      const booking = await createLegacyBooking({ req, slot: legacySlot, vehicle, startTime: window.startTime, endTime: window.endTime });
      await emitAvailabilityChanged(req, booking);
      return res.status(201).json({ success: true, booking: await populateBooking(Booking.findById(booking._id)) });
    }

    const location = await ParkingLocation.findOne({ _id: parkingLocationId, status: 'active' });
    if (!location) return res.status(404).json({ success: false, message: 'Active parking location not found' });
    const vehicleType = physicalVehicleType(vehicle);
    const inventoryType = inventoryVehicleType(vehicle);
    if (!location.vehicleTypes.includes(inventoryType)) {
      return res.status(400).json({ success: false, message: 'This location does not support the selected vehicle' });
    }
    if (!isOpenForWindow(location, window.startTime, window.endTime)) {
      return res.status(409).json({ success: false, message: 'This location is closed during the selected time' });
    }

    const bookingType = isElectricVehicle(vehicle) ? 'ev' : 'regular';
    if (req.body.bookingType && req.body.bookingType !== bookingType) {
      return res.status(400).json({ success: false, message: 'Booking type must match the selected vehicle' });
    }
    let slot = null;
    let capacity = regularCapacityFor(location, vehicleType);
    if (bookingType === 'ev') {
      slot = await ParkingSlot.findOne({
        _id: slotId, parkingLocation: location._id, vehicleType: 'ev', evCompatible: true,
        status: { $ne: 'maintenance' },
      });
      if (!slot) return res.status(400).json({ success: false, message: 'Select an available EV charging slot at this location' });
      const existingConflict = await Booking.exists({
        slot: slot._id, status: { $in: ['upcoming', 'active'] },
        startTime: { $lt: window.endTime }, expectedEndTime: { $gt: window.startTime },
      });
      if (existingConflict) return res.status(409).json({ success: false, message: 'This EV slot is already reserved for the selected time' });
      capacity = 1;
    } else if (slotId) {
      return res.status(400).json({ success: false, message: 'Regular bookings use location capacity and do not accept a slot' });
    }
    if (bookingType === 'regular') {
      const unmigratedReservations = await Booking.countDocuments({
        parkingLocation: location._id, vehicleType, bookingType: { $ne: 'regular' }, reservationToken: null,
        status: { $in: ['upcoming', 'active'] }, startTime: { $lt: window.endTime }, expectedEndTime: { $gt: window.startTime },
      });
      capacity = Math.max(0, capacity - unmigratedReservations);
    }
    if (capacity < 1) return res.status(409).json({ success: false, message: 'No capacity is available for this vehicle type and time' });

    reservation = await acquireReservation({
      bookingType, parkingLocationId: location._id, vehicleType, slotId: slot?._id,
      userId: req.user._id, startTime: window.startTime, endTime: window.endTime, capacity,
    });
    if (!reservation) return res.status(409).json({ success: false, message: 'Parking is sold out for the selected time' });

    const hourlyRate = Number(location.pricing?.[inventoryType] || slot?.pricePerHour || 0);
    const hours = Math.ceil((window.endTime - window.startTime) / 3600000);
    const booking = await Booking.create({
      user: req.user._id, parkingLocation: location._id, slot: slot?._id || null,
      vehicle: vehicle._id, vehicleType, bookingType, startTime: window.startTime,
      expectedEndTime: window.endTime, hourlyRate, totalAmount: hours * hourlyRate,
      status: 'upcoming', paymentStatus: 'pending', reservationToken: reservation.token,
    });
    createdBooking = booking;
    await attachBooking(reservation.token, booking._id);
    await emitAvailabilityChanged(req, booking);
    res.status(201).json({ success: true, booking: await populateBooking(Booking.findById(booking._id)) });
  } catch (error) {
    if (createdBooking) await Booking.updateOne({ _id: createdBooking._id }, { $set: { status: 'cancelled' } });
    if (reservation?.token) await releaseReservation(reservation.token);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Unable to create booking' });
  }
};

const getMyBookings = async (req, res) => {
  try {
    const bookings = await populateBooking(Booking.find({ user: req.user._id }).sort({ createdAt: -1 }));
    res.json({ success: true, bookings });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getBookingById = async (req, res) => {
  try {
    const booking = await populateBooking(Booking.findById(req.params.id));
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (String(booking.user._id) !== String(req.user._id) && !hasPermission(req.user, 'booking:read-all')) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, booking });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const cancelBookingRecord = async (req, booking) => {
  if (['completed', 'cancelled'].includes(booking.status)) {
    throw Object.assign(new Error(`Booking is already ${booking.status}`), { statusCode: 400 });
  }
  booking.status = 'cancelled';
  await booking.save();
  await releaseReservation(booking.reservationToken);
  if (booking.slot && booking.bookingType === 'legacy') {
    await ParkingSlot.findByIdAndUpdate(booking.slot, { status: 'available', currentBooking: null });
  }
  await emitAvailabilityChanged(req, booking);
  return booking;
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (String(booking.user) !== String(req.user._id) && !hasPermission(req.user, 'booking:manage-all')) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await cancelBookingRecord(req, booking);
    res.json({ success: true, message: 'Booking cancelled successfully', booking });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

const checkInRecord = async (req, booking) => {
  if (booking.status !== 'upcoming') throw Object.assign(new Error('Only upcoming bookings can be checked in'), { statusCode: 400 });
  booking.status = 'active';
  booking.checkInTime = new Date();
  await booking.save();
  if (booking.slot) await ParkingSlot.findByIdAndUpdate(booking.slot, { status: 'occupied', currentBooking: booking._id });
  await emitAvailabilityChanged(req, booking);
  return booking;
};

const checkOutRecord = async (req, booking) => {
  if (booking.status !== 'active') throw Object.assign(new Error('Only active bookings can be checked out'), { statusCode: 400 });
  const checkOutTime = new Date();
  const billableStart = booking.checkInTime || booking.startTime;
  const hours = Math.max(1, Math.ceil((checkOutTime - billableStart) / 3600000));
  booking.status = 'completed';
  booking.endTime = checkOutTime;
  booking.checkOutTime = checkOutTime;
  booking.totalAmount = hours * booking.hourlyRate;
  await booking.save();
  await releaseReservation(booking.reservationToken);
  if (booking.slot) await ParkingSlot.findByIdAndUpdate(booking.slot, { status: 'available', currentBooking: null });
  await emitAvailabilityChanged(req, booking);
  return booking;
};

const checkIn = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    await checkInRecord(req, booking);
    res.json({ success: true, message: 'Check-in successful', booking });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

const checkOut = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    await checkOutRecord(req, booking);
    res.json({ success: true, message: 'Check-out successful', booking });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

const getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const bookings = await populateBooking(Booking.find(filter).sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit)).limit(Math.min(100, Number(limit))));
    const total = await Booking.countDocuments(filter);
    res.json({ success: true, bookings, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = {
  createBooking, getMyBookings, getBookingById, cancelBooking, checkIn, checkOut, getAllBookings,
  cancelBookingRecord, checkInRecord, checkOutRecord, populateBooking,
};
