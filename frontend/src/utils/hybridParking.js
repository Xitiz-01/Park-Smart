export const isElectricVehicle = (vehicle) => (
  String(vehicle?.fuelType || '').toLowerCase() === 'electric'
  || String(vehicle?.vehicleType || '').toLowerCase() === 'ev'
);

export const physicalVehicleType = (vehicle) => {
  const type = String(vehicle?.vehicleType || 'car').toLowerCase();
  if (['car', 'suv', 'ev'].includes(type)) return 'car';
  if (['bike', 'motorcycle'].includes(type)) return 'motorcycle';
  return type;
};

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
  vehicle?.bodyStyle,
  vehicle?.fuelType || (String(vehicle?.vehicleType).toLowerCase() === 'ev' ? 'electric' : null),
].filter(Boolean).map((value) => value[0].toUpperCase() + value.slice(1)).join(' • ');

export const vehicleFormPayload = (form) => ({
  ...form,
  make: form.make || form.brand,
  brand: form.make || form.brand,
  modelYear: form.modelYear ? Number(form.modelYear) : null,
  vehicleType: String(form.vehicleType).toLowerCase(),
  fuelType: String(form.fuelType).toLowerCase(),
  bodyStyle: form.bodyStyle ? String(form.bodyStyle).toLowerCase() : null,
});

export const applyCatalogDetails = (form, details) => ({
  ...form,
  make: details.make || details.brand || form.make,
  brand: details.make || details.brand || form.brand,
  model: details.model || form.model,
  modelYear: details.modelYear || form.modelYear,
  vehicleType: details.vehicleType || form.vehicleType,
  bodyStyle: details.bodyStyle || (details.bodyStyles?.length === 1 ? details.bodyStyles[0] : form.bodyStyle),
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
