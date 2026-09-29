const VEHICLE_TYPES = ['car', 'motorcycle'];
const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'hybrid', 'electric'];
const BODY_STYLES = ['hatchback', 'sedan', 'suv', 'crossover', 'coupe', 'wagon', 'convertible', 'pickup', 'van', 'mpv', 'other'];

const normalizeValue = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : value
);

const normalizeVehicleType = (value) => normalizeValue(value);
const normalizeFuelType = (value) => normalizeValue(value);
const normalizeBodyStyle = (value) => normalizeValue(value);

const isElectricVehicle = (vehicle) => (
  normalizeFuelType(vehicle?.fuelType) === 'electric'
  || normalizeVehicleType(vehicle?.vehicleType) === 'ev'
);

const physicalVehicleType = (vehicle) => {
  const type = normalizeVehicleType(vehicle?.vehicleType);
  if (['ev', 'suv', 'car'].includes(type)) return 'car';
  if (['bike', 'motorcycle'].includes(type)) return 'motorcycle';
  return type;
};

const inventoryVehicleType = (vehicle) => (
  isElectricVehicle(vehicle) ? 'ev' : physicalVehicleType(vehicle)
);

const inventoryAliasesFor = (vehicleType) => {
  if (vehicleType === 'car') return ['car', 'suv'];
  if (vehicleType === 'motorcycle') return ['motorcycle', 'bike'];
  return [vehicleType];
};

module.exports = {
  VEHICLE_TYPES,
  FUEL_TYPES,
  BODY_STYLES,
  normalizeVehicleType,
  normalizeFuelType,
  normalizeBodyStyle,
  isElectricVehicle,
  physicalVehicleType,
  inventoryVehicleType,
  inventoryAliasesFor,
};
