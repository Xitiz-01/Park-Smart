const Vehicle = require('../models/Vehicle');
const {
  BODY_STYLES,
  VEHICLE_TYPES,
  FUEL_TYPES,
  normalizeBodyStyle,
  normalizeVehicleType,
  normalizeFuelType,
} = require('../utils/vehicleClassification');
const { normalizeYear } = require('../services/vehicleCatalogProviders');
const { vehicleCatalogService } = require('../services/vehicleCatalogService');

const writableFields = [
  'licensePlate', 'vehicleType', 'fuelType', 'make', 'brand', 'model',
  'modelYear', 'bodyStyle', 'color', 'isDefault',
];
const normalizeCatalogText = (value) => String(value || '').trim().toLocaleLowerCase('en-IN');

const normalizedVehicleInput = (body) => {
  const input = Object.fromEntries(writableFields
    .filter((field) => body[field] !== undefined)
    .map((field) => [field, body[field]]));
  if (input.make === undefined && input.brand !== undefined) input.make = input.brand;
  if (input.brand === undefined && input.make !== undefined) input.brand = input.make;
  if (input.vehicleType !== undefined) input.vehicleType = normalizeVehicleType(input.vehicleType);
  if (input.fuelType !== undefined && input.fuelType !== null && input.fuelType !== '') {
    input.fuelType = normalizeFuelType(input.fuelType);
  } else if (input.fuelType === '') input.fuelType = null;
  if (input.bodyStyle !== undefined && input.bodyStyle !== null && input.bodyStyle !== '') {
    input.bodyStyle = normalizeBodyStyle(input.bodyStyle);
  } else if (input.bodyStyle === '') input.bodyStyle = null;
  if (input.modelYear !== undefined && input.modelYear !== null && input.modelYear !== '') {
    input.modelYear = Number(input.modelYear);
  } else if (input.modelYear === '') input.modelYear = null;
  return input;
};

const validateVehicleInput = (input) => {
  if (input.vehicleType !== undefined && !VEHICLE_TYPES.includes(input.vehicleType)) {
    return `Vehicle type must be one of: ${VEHICLE_TYPES.join(', ')}`;
  }
  if (input.fuelType !== undefined && input.fuelType !== null && !FUEL_TYPES.includes(input.fuelType)) {
    return `Fuel type must be one of: ${FUEL_TYPES.join(', ')}`;
  }
  if (input.bodyStyle !== undefined && input.bodyStyle !== null && !BODY_STYLES.includes(input.bodyStyle)) {
    return `Body style must be one of: ${BODY_STYLES.join(', ')}`;
  }
  if (input.modelYear !== undefined && input.modelYear !== null && normalizeYear(input.modelYear) !== input.modelYear) {
    return `Model year must be between 1886 and ${new Date().getFullYear() + 2}`;
  }
  return null;
};

const validateCatalogSelection = async (input, existing = null) => {
  const current = existing?.toObject?.() || existing || {};
  const currentMake = current.make || current.brand;
  const make = String(input.make ?? input.brand ?? currentMake ?? '').trim();
  const model = String(input.model ?? current.model ?? '').trim();
  const modelYear = input.modelYear !== undefined ? input.modelYear : current.modelYear;
  if (!existing && (!make || !model)) return 'Select a make and model from the vehicle catalog';

  const pairChanged = !existing
    || ((input.make !== undefined || input.brand !== undefined) && normalizeCatalogText(make) !== normalizeCatalogText(currentMake))
    || (input.model !== undefined && normalizeCatalogText(input.model) !== normalizeCatalogText(current.model));
  const yearChanged = input.modelYear !== undefined && input.modelYear !== current.modelYear;
  const metadataChanged = input.vehicleType !== undefined || input.fuelType !== undefined || input.bodyStyle !== undefined;
  if (!pairChanged && !yearChanged && !metadataChanged) return null;

  const details = make && model ? await vehicleCatalogService.getModelDetails(make, model, modelYear) : null;
  if (!details) {
    return pairChanged || yearChanged ? 'Select a valid make, model, and model-year combination from the vehicle catalog' : null;
  }
  const vehicleType = input.vehicleType ?? current.vehicleType;
  const fuelType = input.fuelType ?? current.fuelType;
  const bodyStyle = input.bodyStyle ?? current.bodyStyle;
  if (details.vehicleType && vehicleType && vehicleType !== details.vehicleType) {
    return `${details.make} ${details.model} must use vehicle type ${details.vehicleType}`;
  }
  if (fuelType && details.fuelTypes.length && !details.fuelTypes.includes(fuelType)) {
    return `${details.make} ${details.model} does not support fuel type ${fuelType}`;
  }
  if (bodyStyle && details.bodyStyles.length && !details.bodyStyles.includes(bodyStyle)) {
    return `${details.make} ${details.model} does not support body style ${bodyStyle}`;
  }
  if (modelYear && details.modelYears.length && !details.modelYears.includes(modelYear)) {
    return `${details.make} ${details.model} is not available for model year ${modelYear}`;
  }
  input.make = details.make;
  input.brand = details.make;
  input.model = details.model;
  if (!input.vehicleType && details.vehicleType) input.vehicleType = details.vehicleType;
  if (!input.bodyStyle && details.bodyStyle) input.bodyStyle = details.bodyStyle;
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
    if (!input.vehicleType) return res.status(400).json({ success: false, message: 'Vehicle type is required' });
    if (!input.fuelType) return res.status(400).json({ success: false, message: 'Fuel type is required' });
    const catalogError = await validateCatalogSelection(input);
    if (catalogError) return res.status(400).json({ success: false, message: catalogError });
    if (input.isDefault) await Vehicle.updateMany({ user: req.user._id }, { isDefault: false });
    const vehicle = await Vehicle.create({ user: req.user._id, ...input, isDefault: input.isDefault || false });
    res.status(201).json({ success: true, vehicle });
  } catch (error) {
    res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: error.message });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const input = normalizedVehicleInput(req.body);
    const validationError = validateVehicleInput(input);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const vehicle = await Vehicle.findOne({ _id: req.params.id, user: req.user._id });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const catalogError = await validateCatalogSelection(input, vehicle);
    if (catalogError) return res.status(400).json({ success: false, message: catalogError });
    if (input.isDefault) await Vehicle.updateMany({ user: req.user._id, _id: { $ne: req.params.id } }, { isDefault: false });
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
