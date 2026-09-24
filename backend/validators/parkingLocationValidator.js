const { isIndianState, normalizeIndianState } = require('../constants/indianStates');
const GeocodingService = require('../services/geocodingService');

const VEHICLE_TYPES = ['car', 'bike', 'ev', 'motorcycle', 'suv'];
const AMENITIES = ['covered', 'cctv', 'security_guard', 'ev_charging', 'accessible', '24_7_access'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const validationError = (message) => ({ error: message });

const validateParkingLocation = (body, existing = null) => {
  const name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 120) return validationError('Parking location name must be between 2 and 120 characters');

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!GeocodingService.validCoordinate(latitude, longitude)) return validationError('Valid latitude and longitude are required');

  let selected;
  if (body.selectionToken) {
    selected = GeocodingService.validateSelectedLocation({ selectionToken: body.selectionToken, latitude, longitude });
    if (!selected) return validationError('Select a valid address suggestion before saving');
  } else if (existing) {
    const [oldLongitude, oldLatitude] = existing.location.coordinates;
    const sameAddress = body.address?.formattedAddress === existing.address.formattedAddress;
    const movedDistance = Math.abs(oldLatitude - latitude) + Math.abs(oldLongitude - longitude);
    if (!sameAddress || movedDistance > 0.08) return validationError('Select the address again before changing its location');
    selected = { ...existing.address.toObject(), latitude, longitude };
  } else {
    return validationError('Select a valid address suggestion before saving');
  }

  const suppliedState = normalizeIndianState(String(body.address?.state || selected.state || '').trim());
  const selectedState = normalizeIndianState(String(selected.state || '').trim());
  if (!isIndianState(suppliedState) || (selectedState && suppliedState !== selectedState)) {
    return validationError('Address must use the verified Indian state from the selected suggestion');
  }
  const city = String(body.address?.city || selected.city || '').trim();
  const pincode = String(body.address?.pincode || selected.pincode || '').trim();
  if (!city) return validationError('City is required');
  if (!/^\d{6}$/.test(pincode)) return validationError('Pincode must contain exactly 6 digits');

  const vehicleTypes = [...new Set(Array.isArray(body.vehicleTypes) ? body.vehicleTypes : [])];
  if (!vehicleTypes.length || vehicleTypes.some((type) => !VEHICLE_TYPES.includes(type))) {
    return validationError('Select at least one valid vehicle type');
  }

  const pricing = {};
  for (const type of vehicleTypes) {
    const price = Number(body.pricing?.[type]);
    if (!Number.isFinite(price) || price < 0 || price > 100000) return validationError(`Enter a valid non-negative price for ${type}`);
    pricing[type] = Math.round(price * 100) / 100;
  }

  const operatingHours = {};
  for (const day of DAYS) {
    const value = body.operatingHours?.[day] || {};
    const open = value.open !== false;
    const allDay = open && Boolean(value.allDay);
    const openTime = String(value.openTime || '06:00');
    const closeTime = String(value.closeTime || '23:00');
    if (open && !allDay && (!TIME_PATTERN.test(openTime) || !TIME_PATTERN.test(closeTime) || openTime === closeTime)) {
      return validationError(`Enter valid operating hours for ${day}`);
    }
    operatingHours[day] = { open, allDay, openTime, closeTime };
  }

  const amenities = [...new Set(Array.isArray(body.amenities) ? body.amenities : [])];
  if (amenities.some((value) => !AMENITIES.includes(value))) return validationError('One or more amenities are invalid');
  const evSupported = Boolean(body.evSupported);

  return {
    value: {
      name,
      description: String(body.description || '').trim().slice(0, 1000),
      address: {
        formattedAddress: selected.formattedAddress,
        addressLine1: selected.addressLine1 || selected.formattedAddress,
        city,
        district: selected.district || '',
        state: suppliedState,
        pincode,
        country: selected.country || 'India',
        provider: selected.provider,
        providerPlaceId: selected.providerPlaceId || '',
        verified: true,
      },
      location: { type: 'Point', coordinates: [longitude, latitude] },
      vehicleTypes,
      evSupported,
      evDetails: {
        slotCount: evSupported ? Math.max(0, Math.floor(Number(body.evDetails?.slotCount) || 0)) : 0,
        chargerType: evSupported ? String(body.evDetails?.chargerType || '').trim().slice(0, 80) : '',
      },
      operatingHours,
      amenities: evSupported ? [...new Set([...amenities, 'ev_charging'])] : amenities.filter((item) => item !== 'ev_charging'),
      pricing,
    },
  };
};

module.exports = { validateParkingLocation, VEHICLE_TYPES };
