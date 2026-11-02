import { CACHE_KEY, readDiscoveryCache, writeDiscoveryCache } from './discoveryCache';

afterEach(() => { window.localStorage.clear(); vi.restoreAllMocks(); });

test('keeps the existing key and shape', () => {
  expect(CACHE_KEY).toBe('parksmart-location-discovery-v1');
  writeDiscoveryCache({ vehicleId: 'v1', locations: [{ _id: 'a' }] });
  expect(readDiscoveryCache()).toEqual({ vehicleId: 'v1', locations: [{ _id: 'a' }] });
});

test('a corrupt entry or blocked storage reads as no cache instead of throwing (audit O)', () => {
  window.localStorage.setItem(CACHE_KEY, '{not json');
  expect(readDiscoveryCache()).toBeNull();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(readDiscoveryCache()).toBeNull();
  expect(() => writeDiscoveryCache({})).not.toThrow();
});
