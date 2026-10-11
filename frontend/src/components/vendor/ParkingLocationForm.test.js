import { createInitialState, locationPayload } from './ParkingLocationForm';

const saved = {
  name: 'FC Road', description: '', address: { formattedAddress: 'FC Road, Pune', city: 'Pune', state: 'Maharashtra', pincode: '411004' },
  location: { coordinates: [73.84, 18.52] }, vehicleTypes: ['suv', 'bike', 'ev'], pricing: { suv: 40, bike: 10, ev: 60 },
  capacity: { car: 10, suv: 5, bike: 8 }, evSupported: true, amenities: ['cctv'],
};

test('legacy suv/bike buckets fold into car/motorcycle', () => {
  const state = createInitialState(saved);
  expect(state.vehicleTypes).toEqual(['car', 'motorcycle', 'ev']);
  expect(state.pricing).toEqual({ car: 40, motorcycle: 10, ev: 60 });
  expect(state.capacity).toEqual({ car: 15, motorcycle: 8 });
  expect(state.address.verified).toBe(true);
});

test('payload keeps the same shape as the single-page form', () => {
  const payload = locationPayload(createInitialState(saved));
  expect(Object.keys(payload)).toEqual(['name', 'description', 'address', 'latitude', 'longitude', 'selectionToken', 'vehicleTypes', 'pricing', 'capacity', 'evSupported', 'evDetails', 'amenities', 'operatingHours']);
  expect(payload.latitude).toBe(18.52);
  expect(payload.longitude).toBe(73.84);
});
