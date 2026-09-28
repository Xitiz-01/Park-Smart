const Vehicle = require('../models/Vehicle');
const {
  VEHICLE_TYPES,
  FUEL_TYPES,
  normalizeVehicleType,
  normalizeFuelType,
} = require('../utils/vehicleClassification');

const writableFields = ['licensePlate', 'vehicleType', 'fuelType', 'brand', 'model', 'color', 'isDefault'];

const normalizedVehicleInput = (body, { partial = false } = {}) => {
  const input = Object.fromEntries(writableFields
    .filter((field) => body[field] !== undefined)
    .map((field) => [field, body[field]]));
  if (!partial && input.vehicleType === undefined) input.vehicleType = 'car';
  if (input.vehicleType !== undefined) input.vehicleType = normalizeVehicleType(input.vehicleType);
  if (input.fuelType !== undefined && input.fuelType !== null && input.fuelType !== '') {
    input.fuelType = normalizeFuelType(input.fuelType);
  } else if (input.fuelType === '') {
    input.fuelType = null;
  }
  return input;
};

const validateVehicleInput = (input) => {
  if (input.vehicleType !== undefined && !VEHICLE_TYPES.includes(input.vehicleType)) {
    return `Vehicle type must be one of: ${VEHICLE_TYPES.join(', ')}`;
  }
  if (input.fuelType !== undefined && input.fuelType !== null && !FUEL_TYPES.includes(input.fuelType)) {
    return `Fuel type must be one of: ${FUEL_TYPES.join(', ')}`;
  }
  return null;
};

const getMyVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ user: req.user._id });
    res.json({ success: true, vehicles });
  } catch (error) {
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: error.message });
  }
};

const addVehicle = async (req, res) => {
  try {
    const input = normalizedVehicleInput(req.body);
    const validationError = validateVehicleInput(input);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    if (!input.fuelType) return res.status(400).json({ success: false, message: 'Fuel type is required' });

    if (input.isDefault) {
      await Vehicle.updateMany({ user: req.user._id }, { isDefault: false });
    }

    const vehicle = await Vehicle.create({
      user: req.user._id,
      ...input,
      isDefault: input.isDefault || false,
    });

    res.status(201).json({ success: true, vehicle });
  } catch (error) {
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: error.message });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const input = normalizedVehicleInput(req.body, { partial: true });
    const validationError = validateVehicleInput(input);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const vehicle = await Vehicle.findOne({ _id: req.params.id, user: req.user._id });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (input.isDefault) {
      await Vehicle.updateMany({ user: req.user._id, _id: { $ne: req.params.id } }, { isDefault: false });
    }
    Object.assign(vehicle, input);
    await vehicle.save();
    res.json({ success: true, vehicle });
  } catch (error) {
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: error.message });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.json({ success: true, message: 'Vehicle removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyVehicles, addVehicle, updateVehicle, deleteVehicle };
