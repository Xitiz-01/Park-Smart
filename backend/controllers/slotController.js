const ParkingSlot = require('../models/ParkingSlot');

const toRadians = (deg) => (deg * Math.PI) / 180;

const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const EXTERNAL_PARKING_CACHE_TTL_MS = Number(process.env.EXTERNAL_PARKING_CACHE_TTL_MS || 120000);
const MAX_EXTERNAL_CACHE_ENTRIES = 200;
const externalNearbyCache = new Map();

const getExternalCacheKey = (lat, lng, radiusMeters, maxResults) =>
  `${lat.toFixed(4)}:${lng.toFixed(4)}:${Math.round(radiusMeters)}:${Math.round(maxResults)}`;

const getCachedExternalData = (cacheKey, allowStale = false) => {
  const cached = externalNearbyCache.get(cacheKey);
  if (!cached) return null;

  const age = Date.now() - cached.createdAt;
  if (age <= EXTERNAL_PARKING_CACHE_TTL_MS) {
    return { ...cached.payload, cached: true };
  }

  if (allowStale) {
    return { ...cached.payload, cached: true, stale: true };
  }

  return null;
};

const setCachedExternalData = (cacheKey, payload) => {
  externalNearbyCache.set(cacheKey, {
    payload,
    createdAt: Date.now(),
  });

  if (externalNearbyCache.size > MAX_EXTERNAL_CACHE_ENTRIES) {
    const oldestKey = externalNearbyCache.keys().next().value;
    externalNearbyCache.delete(oldestKey);
  }
};

const fetchJsonWithTimeout = async (url, options, timeoutMs, providerLabel) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(`${providerLabel} responded with ${response.status}`);
    }

    try {
      return JSON.parse(rawBody);
    } catch (parseError) {
      throw new Error(`${providerLabel} returned non-JSON data`);
    }
  } finally {
    clearTimeout(timer);
  }
};

const mapOverpassPlaces = (elements, userLat, userLng, radiusMeters, maxResults) =>
  (elements || [])
    .map((item) => {
      const latValue = item.lat ?? item.center?.lat;
      const lngValue = item.lon ?? item.center?.lon;
      if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) return null;

      const distanceMeters = calculateDistanceMeters(userLat, userLng, latValue, lngValue);
      return {
        id: `${item.type}/${item.id}`,
        source: 'osm-overpass',
        name: item.tags?.name || item.tags?.operator || 'Parking',
        location: {
          lat: Number(latValue),
          lng: Number(lngValue),
          label: item.tags?.['addr:full'] || item.tags?.['addr:street'] || item.tags?.name || 'Nearby parking',
        },
        capacity: item.tags?.capacity || null,
        fee: item.tags?.fee || null,
        access: item.tags?.access || null,
        distanceMeters: Math.round(distanceMeters),
        distanceKm: Number((distanceMeters / 1000).toFixed(2)),
      };
    })
    .filter(Boolean)
    .filter((place) => place.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, maxResults);

const fetchFromOverpass = async ({ userLat, userLng, radiusMeters, maxResults }) => {
  const query = `
[out:json][timeout:18];
(
  node["amenity"="parking"](around:${radiusMeters},${userLat},${userLng});
  way["amenity"="parking"](around:${radiusMeters},${userLat},${userLng});
  relation["amenity"="parking"](around:${radiusMeters},${userLat},${userLng});
);
out center tags;
`.trim();

  let lastError = null;
  for (const endpoint of OVERPASS_URLS) {
    try {
      const data = await fetchJsonWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: `data=${encodeURIComponent(query)}`,
        },
        10000,
        endpoint
      );

      return {
        provider: endpoint,
        places: mapOverpassPlaces(data.elements, userLat, userLng, radiusMeters, maxResults),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('All Overpass providers are unavailable');
};

const getBoundingBox = (lat, lng, radiusMeters) => {
  const latDelta = radiusMeters / 111320;
  const lngDenominator = Math.max(111320 * Math.cos(toRadians(lat)), 0.000001);
  const lngDelta = radiusMeters / lngDenominator;

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
};

const fetchFromNominatim = async ({ userLat, userLng, radiusMeters, maxResults }) => {
  const { minLat, maxLat, minLng, maxLng } = getBoundingBox(userLat, userLng, radiusMeters);
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: 'parking',
    bounded: '1',
    addressdetails: '1',
    extratags: '1',
    limit: String(Math.min(Math.max(maxResults * 3, maxResults), 100)),
    viewbox: `${minLng},${maxLat},${maxLng},${minLat}`,
  });

  const data = await fetchJsonWithTimeout(
    `${NOMINATIM_URL}?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'User-Agent': 'ParkSmart/1.0',
        Accept: 'application/json',
      },
    },
    9000,
    'Nominatim'
  );

  if (!Array.isArray(data)) {
    throw new Error('Nominatim returned an invalid response');
  }

  const places = data
    .map((item) => {
      const latValue = Number(item.lat);
      const lngValue = Number(item.lon);
      if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) return null;

      const distanceMeters = calculateDistanceMeters(userLat, userLng, latValue, lngValue);
      return {
        id: `${item.osm_type || 'place'}/${item.osm_id || item.place_id}`,
        source: 'osm-nominatim',
        name: item.name || item.display_name?.split(',')[0] || 'Parking',
        location: {
          lat: latValue,
          lng: lngValue,
          label: item.display_name || 'Nearby parking',
        },
        capacity: item.extratags?.capacity || null,
        fee: item.extratags?.fee || null,
        access: item.extratags?.access || null,
        distanceMeters: Math.round(distanceMeters),
        distanceKm: Number((distanceMeters / 1000).toFixed(2)),
      };
    })
    .filter(Boolean)
    .filter((place) => place.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, maxResults);

  return {
    provider: NOMINATIM_URL,
    places,
  };
};

// @desc    Get all slots with availability
// @route   GET /api/slots
const getAllSlots = async (req, res) => {
  try {
    const { zone, type, status } = req.query;
    const filter = {};
    if (zone) filter.zone = zone;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const slots = await ParkingSlot.find(filter).populate('currentBooking');
    const totalSlots = await ParkingSlot.countDocuments();
    const availableSlots = await ParkingSlot.countDocuments({ status: 'available' });

    res.json({
      success: true,
      slots,
      stats: { total: totalSlots, available: availableSlots, occupied: totalSlots - availableSlots },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get nearby slots using user coordinates
// @route   GET /api/slots/nearby
const getNearbySlots = async (req, res) => {
  try {
    const { lat, lng, radius = 2000, type, status, zone, limit = 100 } = req.query;
    const userLat = Number(lat);
    const userLng = Number(lng);
    const radiusMeters = Number(radius);
    const maxResults = Number(limit);

    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng query params are required' });
    }

    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      return res.status(400).json({ success: false, message: 'Radius must be a positive number in meters' });
    }

    const filter = {};
    if (zone) filter.zone = zone;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const slots = await ParkingSlot.find(filter).populate('currentBooking');
    const nearby = slots
      .filter((slot) => Number.isFinite(slot.location?.lat) && Number.isFinite(slot.location?.lng))
      .map((slot) => {
        const distanceMeters = calculateDistanceMeters(userLat, userLng, slot.location.lat, slot.location.lng);
        return {
          ...slot.toObject(),
          distanceMeters: Math.round(distanceMeters),
          distanceKm: Number((distanceMeters / 1000).toFixed(2)),
        };
      })
      .filter((slot) => slot.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, Number.isFinite(maxResults) ? maxResults : 100);

    res.json({
      success: true,
      center: { lat: userLat, lng: userLng },
      radiusMeters,
      count: nearby.length,
      slots: nearby,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get nearby external parking places from OpenStreetMap
// @route   GET /api/slots/external-nearby
const getExternalNearbyParking = async (req, res) => {
  try {
    const { lat, lng, radius = 2000, limit = 50 } = req.query;
    const userLat = Number(lat);
    const userLng = Number(lng);
    const radiusMeters = Number(radius);
    const maxResults = Number(limit);

    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng query params are required' });
    }
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      return res.status(400).json({ success: false, message: 'Radius must be a positive number in meters' });
    }

    const safeRadius = Math.min(radiusMeters, 10000);
    const safeLimit = Math.min(Math.max(Number.isFinite(maxResults) ? Math.round(maxResults) : 50, 1), 100);
    const cacheKey = getExternalCacheKey(userLat, userLng, safeRadius, safeLimit);

    const cached = getCachedExternalData(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let provider = '';
    let places = [];
    let warning = '';
    let fallbackUsed = false;

    try {
      const overpassResult = await fetchFromOverpass({
        userLat,
        userLng,
        radiusMeters: safeRadius,
        maxResults: safeLimit,
      });
      provider = overpassResult.provider;
      places = overpassResult.places;
    } catch (overpassError) {
      fallbackUsed = true;
      warning = `Overpass unavailable. Fallback provider used. (${overpassError.message})`;

      try {
        const nominatimResult = await fetchFromNominatim({
          userLat,
          userLng,
          radiusMeters: safeRadius,
          maxResults: safeLimit,
        });
        provider = nominatimResult.provider;
        places = nominatimResult.places;
      } catch (fallbackError) {
        const staleCached = getCachedExternalData(cacheKey, true);
        if (staleCached) {
          return res.json({
            ...staleCached,
            warning: 'Serving stale cached nearby parking data due to external provider issues',
          });
        }

        return res.status(502).json({
          success: false,
          message: 'Live nearby parking providers are temporarily unavailable',
          details: [overpassError.message, fallbackError.message],
        });
      }
    }

    const responsePayload = {
      success: true,
      center: { lat: userLat, lng: userLng },
      radiusMeters: safeRadius,
      count: places.length,
      places,
      provider,
      cached: false,
      fallbackUsed,
      warning: warning || undefined,
    };

    setCachedExternalData(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'External parking request timed out' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single slot
// @route   GET /api/slots/:id
const getSlotById = async (req, res) => {
  try {
    const slot = await ParkingSlot.findById(req.params.id).populate('currentBooking');
    if (!slot) return res.status(404).json({ success: false, message: 'Slot not found' });
    res.json({ success: true, slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create slot (Admin)
// @route   POST /api/slots
const createSlot = async (req, res) => {
  try {
    const slot = await ParkingSlot.create(req.body);
    res.status(201).json({ success: true, slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update slot (Admin)
// @route   PUT /api/slots/:id
const updateSlot = async (req, res) => {
  try {
    const slot = await ParkingSlot.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!slot) return res.status(404).json({ success: false, message: 'Slot not found' });
    res.json({ success: true, slot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete slot (Admin)
// @route   DELETE /api/slots/:id
const deleteSlot = async (req, res) => {
  try {
    const slot = await ParkingSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ success: false, message: 'Slot not found' });
    if (slot.status === 'occupied') {
      return res.status(400).json({ success: false, message: 'Cannot delete an occupied slot' });
    }
    await slot.deleteOne();
    res.json({ success: true, message: 'Slot deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Seed slots (Admin - for initial setup)
// @route   POST /api/slots/seed
const seedSlots = async (req, res) => {
  try {
    await ParkingSlot.deleteMany({});
    const zones = ['A', 'B', 'C', 'D'];
    const floors = ['G', '1', '2'];
    const zoneCenters = {
      A: { lat: 28.6130, lng: 77.2080, label: 'Zone A - North' },
      B: { lat: 28.6122, lng: 77.2093, label: 'Zone B - East' },
      C: { lat: 28.6137, lng: 77.2104, label: 'Zone C - South' },
      D: { lat: 28.6146, lng: 77.2089, label: 'Zone D - West' },
    };
    const slots = [];

    zones.forEach((zone, zoneIndex) => {
      floors.forEach((floor, floorIndex) => {
        for (let i = 1; i <= 5; i++) {
          const type = i === 1 ? 'disabled' : i === 5 ? 'ev' : i % 2 === 0 ? 'compact' : 'standard';
          const zoneCenter = zoneCenters[zone];
          const latJitter = (floorIndex * 0.00015) + (i * 0.00002);
          const lngJitter = (zoneIndex * 0.00009) + (i * 0.00002);
          slots.push({
            slotNumber: `${zone}${floor}${String(i).padStart(2, '0')}`,
            floor,
            zone,
            type,
            status: 'available',
            pricePerHour: type === 'ev' ? 50 : type === 'disabled' ? 20 : 30,
            features: {
              hasCCTV: true,
              hasCover: floor !== 'G',
              hasEVCharger: type === 'ev',
            },
            location: {
              lat: Number((zoneCenter.lat + latJitter).toFixed(6)),
              lng: Number((zoneCenter.lng + lngJitter).toFixed(6)),
              label: zoneCenter.label,
            },
          });
        }
      });
    });

    const created = await ParkingSlot.insertMany(slots);
    res.status(201).json({ success: true, message: `${created.length} slots created`, count: created.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllSlots,
  getNearbySlots,
  getExternalNearbyParking,
  getSlotById,
  createSlot,
  updateSlot,
  deleteSlot,
  seedSlots,
};
