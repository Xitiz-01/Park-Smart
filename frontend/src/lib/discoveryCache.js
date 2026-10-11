// Find Parking's last good result, so a network failure can still show
// something. Same key and shape as before; reads and writes never throw
// (private mode, blocked storage or a corrupt entry just mean "no cache").
export const CACHE_KEY = 'parksmart-location-discovery-v1';

export function readDiscoveryCache() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function writeDiscoveryCache(value) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the live result still shows.
  }
}
