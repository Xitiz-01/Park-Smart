import { bookingTypeForVehicle, parkingDetailsPath } from './hybridParking';

test('EV vehicles use exact-slot booking while regular vehicles use capacity', () => {
  expect(bookingTypeForVehicle('ev')).toBe('ev');
  expect(bookingTypeForVehicle('car')).toBe('regular');
  expect(bookingTypeForVehicle('motorcycle')).toBe('regular');
  expect(bookingTypeForVehicle('suv')).toBe('regular');
});

test('parking details path preserves the selected discovery window', () => {
  const path = parkingDetailsPath('location-1', {
    startTime: '2026-09-28T10:00:00.000Z',
    endTime: '2026-09-28T12:00:00.000Z',
    vehicleType: 'ev',
    distanceKm: 1.4,
  });
  expect(path).toContain('/dashboard/parking/location-1?');
  expect(decodeURIComponent(path)).toContain('vehicleType=ev');
  expect(decodeURIComponent(path)).toContain('2026-09-28T10:00:00.000Z');
  expect(decodeURIComponent(path)).toContain('distanceKm=1.4');
});
