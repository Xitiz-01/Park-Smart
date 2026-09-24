const mongoose = require('mongoose');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const { validateParkingLocation, VEHICLE_TYPES } = require('../validators/parkingLocationValidator');

const isId = (value) => mongoose.isValidObjectId(value);

const findOwnedLocation = (id, vendorId) => {
  if (!isId(id)) return null;
  return ParkingLocation.findOne({ _id: id, vendorId });
};

const addSlotStats = async (locations) => {
  const ids = locations.map((location) => location._id);
  const rows = await ParkingSlot.aggregate([
    { $match: { parkingLocation: { $in: ids } } },
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
    const slots = await ParkingSlot.find({ parkingLocation: location._id }).sort({ slotNumber: 1 });
    res.json({ success: true, location, slots });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to load parking slots' });
  }
};

const validateSlotInput = (body, location) => {
  const slotNumber = String(body.slotNumber || '').trim().toUpperCase();
  const vehicleType = String(body.vehicleType || '').toLowerCase();
  if (!/^[A-Z0-9_-]{1,20}$/.test(slotNumber)) return { error: 'Slot number may contain only letters, numbers, underscores, and hyphens' };
  if (!VEHICLE_TYPES.includes(vehicleType) || !location.vehicleTypes.includes(vehicleType)) return { error: 'Vehicle type is not supported by this location' };
  return { slotNumber, vehicleType };
};

const slotDocument = (input, location) => ({
  slotNumber: input.slotNumber,
  parkingLocation: location._id,
  vehicleType: input.vehicleType,
  type: input.slotType || (input.vehicleType === 'ev' ? 'ev' : 'standard'),
  status: input.status || 'available',
  evCompatible: input.vehicleType === 'ev' || Boolean(input.evCompatible),
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
    Object.assign(slot, slotDocument({ ...req.body, ...input, status: req.body.status || slot.status }, location));
    await slot.save();
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
    const bookings = await Booking.find({ slot: { $in: slotIds } })
      .populate('user', 'name email phone')
      .populate({ path: 'slot', populate: { path: 'parkingLocation', select: 'name' } })
      .populate('vehicle', 'licensePlate vehicleType brand model')
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch {
    res.status(500).json({ success: false, message: 'Unable to load vendor bookings' });
  }
};

module.exports = {
  getParkingLocations, getParkingLocation, createParkingLocation, updateParkingLocation,
  deactivateParkingLocation, getLocationSlots, createSlot, bulkCreateSlots, updateSlot, getVendorBookings,
};
