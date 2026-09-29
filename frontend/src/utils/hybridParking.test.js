import {
  applyCatalogDetails,
  bookingPayloadForVehicle,
  bookingTypeForVehicle,
  isElectricVehicle,
  isAvailabilityEventForLocation,
  parkingDetailsPath,
  physicalVehicleType,
  shouldShowEVSlotBoard,
  vehicleFormPayload,
} from './hybridParking';

test('EV vehicles use exact-slot booking while regular vehicles use capacity', () => {
  expect(bookingTypeForVehicle({ vehicleType: 'suv', fuelType: 'electric' })).toBe('ev');
  expect(bookingTypeForVehicle({ vehicleType: 'car', fuelType: 'petrol' })).toBe('regular');
  expect(bookingTypeForVehicle({ vehicleType: 'motorcycle' })).toBe('regular');
  expect(bookingTypeForVehicle({ vehicleType: 'suv', fuelType: 'diesel' })).toBe('regular');
});

test('catalog selection safely prefills reliable body and electric metadata', () => {
  const form = applyCatalogDetails(
    { make: '', brand: '', model: '', vehicleType: '', bodyStyle: '', fuelType: '' },
    { make: 'Mahindra', model: 'XEV 9e', vehicleType: 'car', bodyStyle: 'suv', bodyStyles: ['suv'], fuelTypes: ['electric'] }
  );
  expect(form).toMatchObject({ make: 'Mahindra', brand: 'Mahindra', model: 'XEV 9e', vehicleType: 'car', bodyStyle: 'suv', fuelType: 'electric' });
  const multiFuel = applyCatalogDetails(
    { vehicleType: 'car', fuelType: 'diesel' },
    { make: 'Hyundai', model: 'Creta', vehicleType: 'car', bodyStyle: 'suv', fuelTypes: ['petrol', 'diesel'] }
  );
  expect(multiFuel.fuelType).toBe('diesel');
});

test('live availability events refresh only the relevant board', () => {
  expect(isAvailabilityEventForLocation({ locationId: 'one' }, 'one')).toBe(true);
  expect(isAvailabilityEventForLocation({ locationId: 'two' }, 'one')).toBe(false);
});

test('legacy EV vehicles remain electric and map to a physical car', () => {
  expect(isElectricVehicle({ vehicleType: 'ev' })).toBe(true);
  expect(physicalVehicleType({ vehicleType: 'ev' })).toBe('car');
  expect(physicalVehicleType({ vehicleType: 'suv' })).toBe('car');
  expect(physicalVehicleType({ vehicleType: 'bike' })).toBe('motorcycle');
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
  expect(vehicleFormPayload({ licensePlate: 'MH14EV1234', make: 'Mahindra', modelYear: '2026', bodyStyle: 'SUV', vehicleType: 'CAR', fuelType: 'Electric' })).toEqual({
    licensePlate: 'MH14EV1234', make: 'Mahindra', brand: 'Mahindra', modelYear: 2026,
    bodyStyle: 'suv', vehicleType: 'car', fuelType: 'electric',
  });
});

test('only electric non-legacy bookings enter the visual slot flow', () => {
  expect(shouldShowEVSlotBoard({ vehicleType: 'suv', fuelType: 'electric' })).toBe(true);
  expect(shouldShowEVSlotBoard({ vehicleType: 'car', fuelType: 'petrol' })).toBe(false);
  expect(shouldShowEVSlotBoard({ vehicleType: 'suv', fuelType: 'electric' }, true)).toBe(false);
});

test('selected EV slot is included in the authoritative booking payload', () => {
  const payload = bookingPayloadForVehicle({
    locationId: 'location-1', vehicleId: 'vehicle-1', evSlotId: 'slot-2',
    vehicle: { vehicleType: 'suv', fuelType: 'electric' },
    startTime: '2026-09-28T12:30:00.000Z', endTime: '2026-09-28T14:30:00.000Z',
  });
  expect(payload.bookingType).toBe('ev');
  expect(payload.slotId).toBe('slot-2');
});
