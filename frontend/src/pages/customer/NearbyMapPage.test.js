import { availabilityTone } from './NearbyMapPage';

test('marker tone follows real availability', () => {
  expect(availabilityTone({ isOpen: false, available: 0, total: 0 })).toBe('closed');
  expect(availabilityTone({ isOpen: true, available: 0, total: 40 })).toBe('full');
  expect(availabilityTone({ isOpen: true, available: 3, total: 40 })).toBe('low');
  expect(availabilityTone({ isOpen: true, available: 30, total: 40 })).toBe('free');
});
