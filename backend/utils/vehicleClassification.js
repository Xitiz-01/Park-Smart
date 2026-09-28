const VEHICLE_TYPES = ['car', 'motorcycle', 'suv'];
const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'hybrid', 'electric'];

const normalizeValue = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : value
);

const normalizeVehicleType = (value) => normalizeValue(value);
const normalizeFuelType = (value) => normalizeValue(value);

const isElectricVehicle = (vehicle) => (
  normalizeFuelType(vehicle?.fuelType) === 'electric'
  || normalizeVehicleType(vehicle?.vehicleType) === 'ev'
);

const physicalVehicleType = (vehicle) => (
  normalizeVehicleType(vehicle?.vehicleType) === 'ev'
    ? 'car'
    : normalizeVehicleType(vehicle?.vehicleType)
);

const inventoryVehicleType = (vehicle) => (
  isElectricVehicle(vehicle) ? 'ev' : physicalVehicleType(vehicle)
);

module.exports = {
  VEHICLE_TYPES,
  FUEL_TYPES,
  normalizeVehicleType,
  normalizeFuelType,
  isElectricVehicle,
  physicalVehicleType,
  inventoryVehicleType,
};
