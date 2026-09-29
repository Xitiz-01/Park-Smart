const mongoose = require('mongoose');
const ParkingLocation = require('../models/ParkingLocation');
const { getAvailability, parseWindow } = require('../services/parkingAvailabilityService');
const {
  VEHICLE_TYPES,
  FUEL_TYPES,
  normalizeVehicleType,
  normalizeFuelType,
  inventoryVehicleType,
  inventoryAliasesFor,
} = require('../utils/vehicleClassification');

const parseSearchWindow = (query) => {
  const start = query.startTime ? new Date(query.startTime) : new Date(Date.now() + 5 * 60 * 1000);
  const end = query.endTime ? new Date(query.endTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return parseWindow(start, end);
};

const priceFor = (location, vehicleType) => {
  const aliases = inventoryAliasesFor(vehicleType);
  const price = aliases.map((type) => location.pricing?.[type]).find((value) => value !== undefined);
  return Number(price ?? 0);
};

const requestedVehicle = (query) => {
  const requestedType = normalizeVehicleType(query.vehicleType || 'car');
  const legacyElectric = requestedType === 'ev';
  const vehicleType = legacyElectric ? 'car' : requestedType;
  const fuelType = legacyElectric ? 'electric' : normalizeFuelType(query.fuelType || null);
  if (!VEHICLE_TYPES.includes(vehicleType)) return { error: 'Invalid vehicle type' };
  if (fuelType && !FUEL_TYPES.includes(fuelType)) return { error: 'Invalid fuel type' };
  const vehicle = { vehicleType, fuelType };
  return { vehicle, inventoryType: inventoryVehicleType(vehicle) };
};

const nearbyParking = async (req, res) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);
    const radiusKm = req.query.radiusKm === undefined ? 10 : Number(req.query.radiusKm);
    const classification = requestedVehicle(req.query);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
    }
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
      return res.status(400).json({ success: false, message: 'Radius must be between 0 and 50 km' });
    }
    if (classification.error) return res.status(400).json({ success: false, message: classification.error });
    const { vehicle, inventoryType } = classification;
    const window = parseSearchWindow(req.query);
    if (window.error) return res.status(400).json({ success: false, message: window.error });

    const amenities = String(req.query.amenities || '').split(',').map((value) => value.trim()).filter(Boolean);
    const aliases = inventoryAliasesFor(inventoryType);
    const query = { status: 'active', vehicleTypes: aliases.length === 1 ? aliases[0] : { $in: aliases } };
    if (inventoryType === 'ev' || req.query.ev === 'true') query.evSupported = true;
    if (amenities.length) query.amenities = { $all: amenities };
    const locations = await ParkingLocation.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distanceMeters', maxDistance: radiusKm * 1000,
          spherical: true, query,
        },
      },
      { $limit: 100 },
    ]);

    const enriched = await Promise.all(locations.map(async (location) => {
      const availability = await getAvailability(location, inventoryType, window.startTime, window.endTime);
      return {
        ...location,
        distanceKm: Number((location.distanceMeters / 1000).toFixed(2)),
        pricePerHour: priceFor(location, inventoryType),
        availability: { ...availability, evSlots: undefined },
      };
    }));
    const maxPrice = req.query.maxPrice === undefined ? null : Number(req.query.maxPrice);
    if (req.query.maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
      return res.status(400).json({ success: false, message: 'Maximum price must be a non-negative number' });
    }
    let results = enriched.filter((location) => (
      (!Number.isFinite(maxPrice) || location.pricePerHour <= maxPrice)
      && (req.query.available !== 'true' || location.availability.available > 0)
    ));
    const sort = req.query.sort || 'nearest';
    if (sort === 'lowest_price') results.sort((a, b) => a.pricePerHour - b.pricePerHour || a.distanceMeters - b.distanceMeters);
    else if (sort === 'highest_availability') results.sort((a, b) => b.availability.available - a.availability.available || a.distanceMeters - b.distanceMeters);
    else results.sort((a, b) => a.distanceMeters - b.distanceMeters);

    res.json({
      success: true,
      locations: results,
      requestedWindow: {
        startTime: window.startTime,
        endTime: window.endTime,
        vehicleType: vehicle.vehicleType,
        fuelType: vehicle.fuelType,
        bookingType: inventoryType === 'ev' ? 'ev' : 'regular',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to discover nearby parking' });
  }
};

const getParkingLocation = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid parking location ID' });
    const classification = requestedVehicle(req.query);
    if (classification.error) return res.status(400).json({ success: false, message: classification.error });
    const { vehicle, inventoryType } = classification;
    const window = parseSearchWindow(req.query);
    if (window.error) return res.status(400).json({ success: false, message: window.error });
    const location = await ParkingLocation.findOne({ _id: req.params.id, status: 'active' }).lean();
    if (!location) return res.status(404).json({ success: false, message: 'Parking location not found' });
    const availability = await getAvailability(location, inventoryType, window.startTime, window.endTime);
    res.json({
      success: true,
      location: { ...location, pricePerHour: priceFor(location, inventoryType), availability },
      requestedWindow: {
        startTime: window.startTime,
        endTime: window.endTime,
        vehicleType: vehicle.vehicleType,
        fuelType: vehicle.fuelType,
        bookingType: inventoryType === 'ev' ? 'ev' : 'regular',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to load parking location' });
  }
};

module.exports = { nearbyParking, getParkingLocation };
