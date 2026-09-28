export const bookingTypeForVehicle = (vehicleType) => vehicleType === 'ev' ? 'ev' : 'regular';

export const parkingDetailsPath = (locationId, { startTime, endTime, vehicleType }) => {
  const query = new URLSearchParams({
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    vehicleType,
  });
  return `/dashboard/parking/${locationId}?${query}`;
};
