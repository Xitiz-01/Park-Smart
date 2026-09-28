export const bookingTypeForVehicle = (vehicleType) => vehicleType === 'ev' ? 'ev' : 'regular';

export const parkingDetailsPath = (locationId, { startTime, endTime, vehicleType, distanceKm }) => {
  const params = {
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    vehicleType,
  };
  if (distanceKm !== undefined) params.distanceKm = String(distanceKm);
  const query = new URLSearchParams(params);
  return `/dashboard/parking/${locationId}?${query}`;
};
