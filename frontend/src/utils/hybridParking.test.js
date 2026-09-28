import { bookingTypeForVehicle, isElectricVehicle, parkingDetailsPath, physicalVehicleType, vehicleFormPayload } from './hybridParking';

test('EV vehicles use exact-slot booking while regular vehicles use capacity', () => {
  expect(bookingTypeForVehicle({ vehicleType: 'suv', fuelType: 'electric' })).toBe('ev');
  expect(bookingTypeForVehicle({ vehicleType: 'car', fuelType: 'petrol' })).toBe('regular');
  expect(bookingTypeForVehicle({ vehicleType: 'motorcycle' })).toBe('regular');
  expect(bookingTypeForVehicle({ vehicleType: 'suv', fuelType: 'diesel' })).toBe('regular');
});

test('legacy EV vehicles remain electric and map to a physical car', () => {
  expect(isElectricVehicle({ vehicleType: 'ev' })).toBe(true);
  expect(physicalVehicleType({ vehicleType: 'ev' })).toBe('car');
  expect(isElectricVehicle({ vehicleType: 'car' })).toBe(false);
});

test('parking details path preserves the selected discovery window', () => {
  const path = parkingDetailsPath('location-1', {
    startTime: '2026-09-28T10:00:00.000Z',
    endTime: '2026-09-28T12:00:00.000Z',
    vehicleType: 'ev',
    fuelType: 'electric',
    vehicleId: 'vehicle-1',
    distanceKm: 1.4,
  });
  expect(path).toContain('/dashboard/parking/location-1?');
  expect(decodeURIComponent(path)).toContain('vehicleType=ev');
  expect(decodeURIComponent(path)).toContain('fuelType=electric');
  expect(decodeURIComponent(path)).toContain('vehicleId=vehicle-1');
  expect(decodeURIComponent(path)).toContain('2026-09-28T10:00:00.000Z');
  expect(decodeURIComponent(path)).toContain('distanceKm=1.4');
});

test('vehicle form payload submits fuel type separately from vehicle class', () => {
  expect(vehicleFormPayload({ licensePlate: 'MH14EV1234', vehicleType: 'SUV', fuelType: 'Electric' })).toEqual({
    licensePlate: 'MH14EV1234', vehicleType: 'suv', fuelType: 'electric',
  });
});
