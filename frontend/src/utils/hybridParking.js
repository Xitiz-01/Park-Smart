export const isElectricVehicle = (vehicle) => (
  String(vehicle?.fuelType || '').toLowerCase() === 'electric'
  || String(vehicle?.vehicleType || '').toLowerCase() === 'ev'
);

export const physicalVehicleType = (vehicle) => (
  String(vehicle?.vehicleType || '').toLowerCase() === 'ev'
    ? 'car'
    : String(vehicle?.vehicleType || 'car').toLowerCase()
);

export const bookingTypeForVehicle = (vehicle) => {
  const normalized = typeof vehicle === 'string' ? { vehicleType: vehicle } : vehicle;
  return isElectricVehicle(normalized) ? 'ev' : 'regular';
};

export const vehicleClassificationLabel = (vehicle) => [
  physicalVehicleType(vehicle),
  vehicle?.fuelType || (String(vehicle?.vehicleType).toLowerCase() === 'ev' ? 'electric' : null),
].filter(Boolean).map((value) => value[0].toUpperCase() + value.slice(1)).join(' • ');

export const vehicleFormPayload = (form) => ({
  ...form,
  vehicleType: String(form.vehicleType).toLowerCase(),
  fuelType: String(form.fuelType).toLowerCase(),
});

export const parkingDetailsPath = (locationId, { startTime, endTime, vehicleType, fuelType, vehicleId, distanceKm }) => {
  const params = {
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    vehicleType,
  };
  if (fuelType) params.fuelType = fuelType;
  if (vehicleId) params.vehicleId = vehicleId;
  if (distanceKm !== undefined) params.distanceKm = String(distanceKm);
  const query = new URLSearchParams(params);
  return `/dashboard/parking/${locationId}?${query}`;
};
