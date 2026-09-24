const jwt = require('jsonwebtoken');

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const validCoordinate = (latitude, longitude) =>
  Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
  Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

const createSelectionToken = (place) => jwt.sign(
  { kind: 'geocoding-selection', place },
  process.env.JWT_SECRET,
  { expiresIn: '30m' }
);

const verifySelectionToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.kind !== 'geocoding-selection' || !decoded.place) return null;
    const { latitude, longitude } = decoded.place;
    return validCoordinate(latitude, longitude) ? decoded.place : null;
  } catch {
    return null;
  }
};

const normalizeGeoapifyResult = (result) => {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!validCoordinate(latitude, longitude)) return null;
  return {
    formattedAddress: result.formatted,
    addressLine1: result.address_line1 || result.name || result.formatted,
    city: result.city || result.town || result.village || result.county || '',
    district: result.district || result.county || '',
    state: result.state || '',
    pincode: result.postcode || '',
    country: result.country || 'India',
    latitude,
    longitude,
    provider: 'geoapify',
    providerPlaceId: result.place_id || '',
  };
};

const autocomplete = async (query) => {
  const provider = (process.env.GEOCODING_PROVIDER || 'geoapify').toLowerCase();
  if (provider !== 'geoapify') throw new Error(`Unsupported geocoding provider: ${provider}`);
  if (!process.env.GEOCODING_API_KEY) {
    const error = new Error('Geocoding is not configured');
    error.statusCode = 503;
    throw error;
  }

  const cacheKey = `${provider}:${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.results;

  const params = new URLSearchParams({
    text: query,
    filter: 'countrycode:in',
    format: 'json',
    limit: '6',
    apiKey: process.env.GEOCODING_API_KEY,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Geocoding provider responded with ${response.status}`);
    const payload = await response.json();
    const results = (payload.results || []).map(normalizeGeoapifyResult).filter(Boolean).map((place) => ({
      ...place,
      selectionToken: createSelectionToken(place),
    }));
    cache.set(cacheKey, { results, createdAt: Date.now() });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return results;
  } finally {
    clearTimeout(timer);
  }
};

const distanceMeters = (a, b) => {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const validateSelectedLocation = ({ selectionToken, latitude, longitude }) => {
  const selected = verifySelectionToken(selectionToken);
  const adjusted = { latitude: Number(latitude), longitude: Number(longitude) };
  if (!selected || !validCoordinate(adjusted.latitude, adjusted.longitude)) return null;
  if (distanceMeters(selected, adjusted) > 5000) return null;
  return { ...selected, ...adjusted };
};

module.exports = {
  autocomplete,
  createSelectionToken,
  verifySelectionToken,
  validateSelectedLocation,
  validCoordinate,
};
