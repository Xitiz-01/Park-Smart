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

export const shouldShowEVSlotBoard = (vehicle, legacy = false) => !legacy && isElectricVehicle(vehicle);

export const bookingPayloadForVehicle = ({ legacy = false, legacySlotId, locationId, vehicle, vehicleId, evSlotId, startTime, endTime }) => ({
  ...(legacy
    ? { slotId: legacySlotId }
    : {
      parkingLocationId: locationId,
      bookingType: bookingTypeForVehicle(vehicle),
      ...(isElectricVehicle(vehicle) ? { slotId: evSlotId } : {}),
    }),
  vehicleId,
  startTime: new Date(startTime).toISOString(),
  expectedEndTime: new Date(endTime).toISOString(),
});

export const vehicleClassificationLabel = (vehicle) => [
  physicalVehicleType(vehicle),
  vehicle?.fuelType || (String(vehicle?.vehicleType).toLowerCase() === 'ev' ? 'electric' : null),
].filter(Boolean).map((value) => value[0].toUpperCase() + value.slice(1)).join(' • ');

export const vehicleFormPayload = (form) => ({
  ...form,
  vehicleType: String(form.vehicleType).toLowerCase(),
  fuelType: String(form.fuelType).toLowerCase(),
});

export const applyCatalogDetails = (form, details) => ({
  ...form,
  brand: details.brand,
  model: details.model,
  vehicleType: details.vehicleType || form.vehicleType,
  fuelType: details.fuelTypes?.length === 1
    ? details.fuelTypes[0]
    : details.fuelTypes?.includes(form.fuelType) ? form.fuelType : '',
});

export const isAvailabilityEventForLocation = (event, locationId) => (
  !event?.locationId || String(event.locationId) === String(locationId)
);

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
