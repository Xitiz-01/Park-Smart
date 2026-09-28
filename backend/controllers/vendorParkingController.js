const mongoose = require('mongoose');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const { checkInRecord, checkOutRecord } = require('./bookingController');
const { validateParkingLocation, VEHICLE_TYPES } = require('../validators/parkingLocationValidator');
const { getAvailability, parseWindow } = require('../services/parkingAvailabilityService');

const isId = (value) => mongoose.isValidObjectId(value);

const findOwnedLocation = (id, vendorId) => {
  if (!isId(id)) return null;
  return ParkingLocation.findOne({ _id: id, vendorId });
};

const emitSlotChanged = (req, locationId, slot = null) => {
  const io = req.app.get('io');
  if (!io) return;
  io.emit('availability:changed', { locationId, vehicleType: 'ev' });
  if (slot) io.emit('slot:updated', slot);
};

const addSlotStats = async (locations) => {
  const ids = locations.map((location) => location._id);
  const rows = await ParkingSlot.aggregate([
    { $match: { parkingLocation: { $in: ids }, vehicleType: 'ev', evCompatible: true } },
    { $group: {
      _id: '$parkingLocation',
      total: { $sum: 1 },
      available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
    } },
  ]);
  const stats = new Map(rows.map((row) => [String(row._id), row]));
  return locations.map((location) => ({
    ...location.toObject(),
    slotStats: stats.get(String(location._id)) || { total: 0, available: 0 },
    regularCapacity: Object.values(location.capacity?.toObject?.() || location.capacity || {}).reduce((sum, value) => sum + Number(value || 0), 0),
  }));
};

const getParkingLocations = async (req, res) => {
  try {
    const locations = await ParkingLocation.find({ vendorId: req.vendorProfile._id }).sort({ createdAt: -1 });
    res.json({ success: true, locations: await addSlotStats(locations) });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to load parking locations' });
  }
};

const getParkingLocation = async (req, res) => {
  try {
    const location = await findOwnedLocation(req.params.id, req.vendorProfile._id);
    if (!location) return res.status(404).json({ success: false, message: 'Parking location not found' });
    const [result] = await addSlotStats([location]);
    res.json({ success: true, location: result });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to load parking location' });
  }
};

const createParkingLocation = async (req, res) => {
  try {
    const validated = validateParkingLocation(req.body);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    const location = await ParkingLocation.create({ ...validated.value, vendorId: req.vendorProfile._id });
    res.status(201).json({ success: true, message: 'Parking location created', location });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to create parking location' });
  }
};

const updateParkingLocation = async (req, res) => {
  try {
    const location = await findOwnedLocation(req.params.id, req.vendorProfile._id);
    if (!location) return res.status(404).json({ success: false, message: 'Parking location not found' });
    const validated = validateParkingLocation(req.body, location);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    Object.assign(location, validated.value);
    await location.save();
    await Promise.all(location.vehicleTypes.map((vehicleType) => ParkingSlot.updateMany(
      { parkingLocation: location._id, vehicleType },
      { $set: { pricePerHour: location.pricing?.[vehicleType] ?? 0 } }
    )));
    res.json({ success: true, message: 'Parking location updated', location });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to update parking location' });
  }
};

const deactivateParkingLocation = async (req, res) => {
  try {
    const location = await findOwnedLocation(req.params.id, req.vendorProfile._id);
    if (!location) return res.status(404).json({ success: false, message: 'Parking location not found' });
    location.status = 'inactive';
    await location.save();
    await ParkingSlot.updateMany(
      { parkingLocation: location._id, status: 'available' },
      { $set: { status: 'maintenance' } }
    );
    res.json({ success: true, message: 'Parking location deactivated', location });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to deactivate parking location' });
  }
};

const getLocationSlots = async (req, res) => {
  try {
    const location = await findOwnedLocation(req.params.id, req.vendorProfile._id);
    if (!location) return res.status(404).json({ success: false, message: 'Parking location not found' });
    const defaultStart = new Date();
    const window = parseWindow(
      req.query.startTime || defaultStart,
      req.query.endTime || new Date(defaultStart.getTime() + 60 * 60 * 1000),
      { allowPast: true }
    );
    if (window.error) return res.status(400).json({ success: false, message: window.error });
    const availability = await getAvailability(location, 'ev', window.startTime, window.endTime);
    res.json({
      success: true,
      location,
      slots: availability.evSlots,
      requestedWindow: { startTime: window.startTime, endTime: window.endTime },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to load parking slots' });
  }
};

const validateSlotInput = (body, location) => {
  const slotNumber = String(body.slotNumber || '').trim().toUpperCase();
  const requestedVehicleType = String(body.vehicleType || 'ev').toLowerCase();
  const vehicleType = 'ev';
  if (!/^[A-Z0-9_-]{1,20}$/.test(slotNumber)) return { error: 'Slot number may contain only letters, numbers, underscores, and hyphens' };
  if (requestedVehicleType !== 'ev') return { error: 'Only EV charging bays use physical slots; configure regular vehicles with location capacity' };
  if (!location.evSupported || !location.vehicleTypes.includes('ev')) return { error: 'Enable EV support for this location before adding physical slots' };
  return { slotNumber, vehicleType };
};

const slotDocument = (input, location) => ({
  slotNumber: input.slotNumber,
  parkingLocation: location._id,
  vehicleType: input.vehicleType,
  type: input.slotType || (input.vehicleType === 'ev' ? 'ev' : 'standard'),
  status: input.status || 'available',
  evCompatible: input.vehicleType === 'ev' || Boolean(input.evCompatible),
  chargerType: String(input.chargerType || location.evDetails?.chargerType || '').trim().slice(0, 80),
  connectorType: String(input.connectorType || '').trim().slice(0, 80),
  chargerPowerKw: Math.max(0, Number(input.chargerPowerKw) || 0),
  pricePerHour: location.pricing?.[input.vehicleType] ?? 0,
  features: {
    hasCCTV: location.amenities.includes('cctv'),
    hasCover: location.amenities.includes('covered'),
    hasEVCharger: location.evSupported && (input.vehicleType === 'ev' || Boolean(input.evCompatible)),
  },
  location: {
    lng: location.location.coordinates[0],
    lat: location.location.coordinates[1],
    label: location.name,
  },
});

const createSlot = async (req, res) => {
  try {
    const location = await findOwnedLocation(req.params.id, req.vendorProfile._id);
    if (!location) return res.status(404).json({ success: false, message: 'Parking location not found' });
    if (location.status !== 'active') return res.status(409).json({ success: false, message: 'Activate this location before adding slots' });
    const input = validateSlotInput(req.body, location);
    if (input.error) return res.status(400).json({ success: false, message: input.error });
    const exists = await ParkingSlot.exists({ parkingLocation: location._id, slotNumber: input.slotNumber });
    if (exists) return res.status(409).json({ success: false, message: 'Slot number already exists at this location' });
    const slot = await ParkingSlot.create(slotDocument({ ...req.body, ...input }, location));
    emitSlotChanged(req, location._id, slot);
    res.status(201).json({ success: true, message: 'Parking slot created', slot });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Slot number already exists at this location' });
    res.status(500).json({ success: false, message: 'Unable to create parking slot' });
  }
};

const bulkCreateSlots = async (req, res) => {
  try {
    const location = await findOwnedLocation(req.params.id, req.vendorProfile._id);
    if (!location) return res.status(404).json({ success: false, message: 'Parking location not found' });
    if (location.status !== 'active') return res.status(409).json({ success: false, message: 'Activate this location before adding slots' });
    const prefix = String(req.body.prefix || '').trim().toUpperCase();
    const count = Number(req.body.count);
    if (!/^[A-Z][A-Z0-9_-]{0,9}$/.test(prefix)) return res.status(400).json({ success: false, message: 'Enter a valid slot prefix' });
    if (!Number.isInteger(count) || count < 1 || count > 200) return res.status(400).json({ success: false, message: 'Slot count must be between 1 and 200' });
    const base = validateSlotInput({ ...req.body, slotNumber: `${prefix}01` }, location);
    if (base.error) return res.status(400).json({ success: false, message: base.error });
    const width = Math.max(2, String(count).length);
    const numbers = Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(width, '0')}`);
    const duplicate = await ParkingSlot.findOne({ parkingLocation: location._id, slotNumber: { $in: numbers } });
    if (duplicate) return res.status(409).json({ success: false, message: `Slot ${duplicate.slotNumber} already exists at this location` });
    const slots = await ParkingSlot.insertMany(numbers.map((slotNumber) => slotDocument({ ...req.body, ...base, slotNumber }, location)), { ordered: true });
    emitSlotChanged(req, location._id);
    res.status(201).json({ success: true, message: `${slots.length} parking slots created`, slots });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'One or more slot numbers already exist at this location' });
    res.status(500).json({ success: false, message: 'Unable to create parking slots' });
  }
};

const updateSlot = async (req, res) => {
  try {
    if (!isId(req.params.slotId)) return res.status(400).json({ success: false, message: 'Invalid slot ID' });
    const slot = await ParkingSlot.findById(req.params.slotId).populate('parkingLocation');
    if (!slot || !slot.parkingLocation || String(slot.parkingLocation.vendorId) !== String(req.vendorProfile._id)) {
      return res.status(404).json({ success: false, message: 'Parking slot not found' });
    }
    const location = slot.parkingLocation;
    const input = validateSlotInput({
      slotNumber: req.body.slotNumber ?? slot.slotNumber,
      vehicleType: req.body.vehicleType ?? slot.vehicleType,
    }, location);
    if (input.error) return res.status(400).json({ success: false, message: input.error });
    if (input.slotNumber !== slot.slotNumber && await ParkingSlot.exists({ parkingLocation: location._id, slotNumber: input.slotNumber, _id: { $ne: slot._id } })) {
      return res.status(409).json({ success: false, message: 'Slot number already exists at this location' });
    }
    const allowedStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
    if (req.body.status && !allowedStatuses.includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid slot status' });
    Object.assign(slot, slotDocument({
      ...req.body, ...input, status: req.body.status || slot.status,
      chargerType: req.body.chargerType ?? slot.chargerType,
      connectorType: req.body.connectorType ?? slot.connectorType,
      chargerPowerKw: req.body.chargerPowerKw ?? slot.chargerPowerKw,
    }, location));
    await slot.save();
    emitSlotChanged(req, location._id, slot);
    res.json({ success: true, message: 'Parking slot updated', slot });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Slot number already exists at this location' });
    res.status(500).json({ success: false, message: 'Unable to update parking slot' });
  }
};

const getVendorBookings = async (req, res) => {
  try {
    const locationIds = await ParkingLocation.find({ vendorId: req.vendorProfile._id }).distinct('_id');
    const slotIds = await ParkingSlot.find({ parkingLocation: { $in: locationIds } }).distinct('_id');
    const bookings = await Booking.find({ $or: [{ parkingLocation: { $in: locationIds } }, { slot: { $in: slotIds } }] })
      .populate('user', 'name email phone')
      .populate({ path: 'slot', populate: { path: 'parkingLocation', select: 'name' } })
      .populate('parkingLocation', 'name')
      .populate('vehicle', 'licensePlate vehicleType fuelType brand model')
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to load vendor bookings' });
  }
};

const findOwnedBooking = async (bookingId, vendorId) => {
  if (!isId(bookingId)) return null;
  const locationIds = await ParkingLocation.find({ vendorId }).distinct('_id');
  const slotIds = await ParkingSlot.find({ parkingLocation: { $in: locationIds } }).distinct('_id');
  return Booking.findOne({ _id: bookingId, $or: [{ parkingLocation: { $in: locationIds } }, { slot: { $in: slotIds } }] });
};

const checkInVendorBooking = async (req, res) => {
  try {
    const booking = await findOwnedBooking(req.params.bookingId, req.vendorProfile._id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    await checkInRecord(req, booking);
    res.json({ success: true, message: 'Check-in successful', booking });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const checkOutVendorBooking = async (req, res) => {
  try {
    const booking = await findOwnedBooking(req.params.bookingId, req.vendorProfile._id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    await checkOutRecord(req, booking);
    res.json({ success: true, message: 'Check-out successful', booking });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getParkingLocations, getParkingLocation, createParkingLocation, updateParkingLocation,
  deactivateParkingLocation, getLocationSlots, createSlot, bulkCreateSlots, updateSlot, getVendorBookings,
  checkInVendorBooking, checkOutVendorBooking,
};
