const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const TEST_DB_NAME = 'parksmart-phase2-test';
const mongoBase = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27028';
const mongoUri = `${mongoBase.replace(/\/$/, '')}/${TEST_DB_NAME}`;

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'parksmart-phase-two-integration-secret';
process.env.GEOCODING_PROVIDER = 'geoapify';
process.env.GEOCODING_API_KEY = 'test-key';

const { app, server } = require('../server');
const User = require('../models/User');
const GeocodingService = require('../services/geocodingService');

let baseUrl;
const originalFetch = global.fetch;

const request = async (path, { method = 'GET', token, body } = {}) => {
  const response = await originalFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, payload: await response.json() };
};

const place = (overrides = {}) => ({
  formattedAddress: 'Moshi, Pimpri-Chinchwad, Maharashtra 412105, India',
  addressLine1: 'Moshi Alandi Road', city: 'Pimpri-Chinchwad', district: 'Pune',
  state: 'Maharashtra', pincode: '412105', country: 'India',
  latitude: 18.6712, longitude: 73.8264, provider: 'geoapify', providerPlaceId: 'test-place-moshi',
  ...overrides,
});

const selected = (overrides = {}) => {
  const result = place(overrides);
  return { ...result, selectionToken: GeocodingService.createSelectionToken(result) };
};

const applicationPayload = (businessName, phone, address = selected()) => ({
  businessName, businessType: 'Private Parking', phone, address: address.addressLine1,
  city: address.city, state: address.state, pincode: address.pincode,
  latitude: address.latitude, longitude: address.longitude, selectionToken: address.selectionToken,
});

const operatingHours = () => Object.fromEntries(
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .map((day) => [day, { open: true, allDay: day === 'sunday', openTime: '06:00', closeTime: '23:00' }])
);

const locationPayload = (name, address, pricing = { car: 50, bike: 20, ev: 70 }) => ({
  name, description: `${name} description`,
  address: {
    formattedAddress: address.formattedAddress, addressLine1: address.addressLine1,
    city: address.city, district: address.district, state: address.state,
    pincode: address.pincode, country: address.country,
  },
  latitude: address.latitude, longitude: address.longitude, selectionToken: address.selectionToken,
  vehicleTypes: ['car', 'bike', 'ev'], evSupported: true,
  evDetails: { slotCount: 2, chargerType: 'CCS2' }, operatingHours: operatingHours(),
  amenities: ['covered', 'cctv', 'security_guard', 'accessible'], pricing,
});

const register = (name, email, phone) => request('/auth/register', {
  method: 'POST', body: { name, email, phone, password: 'secret12', role: 'admin' },
});

test.before(async () => {
  await mongoose.connect(mongoUri);
  await mongoose.connection.dropDatabase();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  assert.ok(app.get('io'), 'Socket.IO is attached when the backend starts');
});

test.after(async () => {
  global.fetch = originalFetch;
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (server.listening) await new Promise((resolve) => server.close(resolve));
});

test('Phase 1 roles and Phase 2 vendor parking management work end-to-end', async () => {
  const vendorARegistration = await register('Vendor A', 'vendor-a@example.com', '9000000001');
  assert.equal(vendorARegistration.status, 201);
  assert.equal(vendorARegistration.payload.user.role, 'customer', 'registration cannot self-assign admin');
  const vendorAToken = vendorARegistration.payload.token;
  const vendorBRegistration = await register('Vendor B', 'vendor-b@example.com', '9000000002');
  const vendorBToken = vendorBRegistration.payload.token;
  const customerRegistration = await register('Customer', 'customer@example.com', '9000000003');
  const customerToken = customerRegistration.payload.token;
  await register('Admin', 'admin@example.com', '9000000004');
  await User.updateOne({ email: 'admin@example.com' }, { $set: { role: 'admin' } });
  const adminLogin = await request('/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'secret12' } });
  assert.equal(adminLogin.status, 200, 'admin login still works');
  const adminToken = adminLogin.payload.token;
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'customer@example.com', password: 'secret12' } })).status, 200, 'customer login still works');

  const noSelectedAddress = await request('/vendors/register', {
    method: 'POST', token: vendorAToken,
    body: { ...applicationPayload('Invalid Address Vendor', '9000000001'), selectionToken: '' },
  });
  assert.equal(noSelectedAddress.status, 400, 'unselected address is rejected');
  const invalidState = await request('/vendors/register', {
    method: 'POST', token: vendorAToken,
    body: { ...applicationPayload('Invalid State Vendor', '9000000001'), state: 'Atlantis' },
  });
  assert.equal(invalidState.status, 400, 'invalid state is rejected');

  const applicationA = await request('/vendors/register', { method: 'POST', token: vendorAToken, body: applicationPayload('Vendor A Parking', '9000000001') });
  assert.equal(applicationA.status, 201);
  assert.deepEqual(applicationA.payload.vendorProfile.businessLocation.coordinates, [73.8264, 18.6712]);
  assert.equal((await request('/vendors/parking-locations', { token: vendorAToken })).status, 403, 'pending vendor cannot manage parking');

  const bAddress = selected({ formattedAddress: 'Baner, Pune, Maharashtra 411045, India', addressLine1: 'Baner Road', city: 'Pune', pincode: '411045', latitude: 18.559, longitude: 73.7868, providerPlaceId: 'test-place-baner' });
  const applicationB = await request('/vendors/register', { method: 'POST', token: vendorBToken, body: applicationPayload('Vendor B Parking', '9000000002', bAddress) });
  await request(`/admin/vendors/${applicationA.payload.vendorProfile._id}/approve`, { method: 'PATCH', token: adminToken });
  await request(`/admin/vendors/${applicationB.payload.vendorProfile._id}/approve`, { method: 'PATCH', token: adminToken });
  assert.equal((await request('/vendors/parking-locations', { token: vendorAToken })).status, 200, 'approved vendor can manage parking');
  assert.equal((await request('/vendors/parking-locations', { token: customerToken })).status, 403, 'customer cannot access vendor parking APIs');
  assert.equal((await request('/admin/dashboard', { token: adminToken })).status, 200, 'admin access remains intact');

  const invalidCoordinates = await request('/vendors/parking-locations', {
    method: 'POST', token: vendorAToken, body: { ...locationPayload('Bad Coordinates', selected()), latitude: 999 },
  });
  assert.equal(invalidCoordinates.status, 400);
  const negativePricing = await request('/vendors/parking-locations', {
    method: 'POST', token: vendorAToken, body: locationPayload('Bad Pricing', selected(), { car: -1, bike: 20, ev: 70 }),
  });
  assert.equal(negativePricing.status, 400);

  const moshiAddress = selected();
  const wakadAddress = selected({ formattedAddress: 'Wakad, Pune, Maharashtra 411057, India', addressLine1: 'Wakad Road', city: 'Pune', pincode: '411057', latitude: 18.5975, longitude: 73.7898, providerPlaceId: 'test-place-wakad' });
  const createMoshi = await request('/vendors/parking-locations', { method: 'POST', token: vendorAToken, body: locationPayload('Moshi Parking', moshiAddress, { car: 50, bike: 20, ev: 70 }) });
  const createWakad = await request('/vendors/parking-locations', { method: 'POST', token: vendorAToken, body: locationPayload('Wakad Parking', wakadAddress, { car: 80, bike: 30, ev: 100 }) });
  const createBaner = await request('/vendors/parking-locations', { method: 'POST', token: vendorBToken, body: locationPayload('Baner Parking', bAddress, { car: 65, bike: 25, ev: 85 }) });
  assert.equal(createMoshi.status, 201);
  assert.equal(createWakad.status, 201, 'vendor can create multiple locations');
  assert.equal(createMoshi.payload.location.pricing.car, 50);
  assert.equal(createWakad.payload.location.pricing.car, 80, 'per-location prices differ');
  const moshiId = createMoshi.payload.location._id;
  const wakadId = createWakad.payload.location._id;
  const banerId = createBaner.payload.location._id;

  const vendorAList = await request('/vendors/parking-locations', { token: vendorAToken });
  assert.equal(vendorAList.payload.locations.length, 2);
  assert.ok(vendorAList.payload.locations.every((location) => location.vendorId === applicationA.payload.vendorProfile._id));
  assert.equal((await request(`/vendors/parking-locations/${banerId}`, { token: vendorAToken })).status, 404, 'Vendor A cannot view Vendor B data');
  assert.equal((await request(`/vendors/parking-locations/${banerId}`, { method: 'PATCH', token: vendorAToken, body: locationPayload('Stolen', bAddress) })).status, 404, 'Vendor A cannot edit Vendor B data');

  const movedMoshi = locationPayload('Moshi Parking Updated', moshiAddress, { car: 55, bike: 22, ev: 75 });
  movedMoshi.latitude += 0.001;
  movedMoshi.longitude += 0.001;
  const updateMoshi = await request(`/vendors/parking-locations/${moshiId}`, { method: 'PATCH', token: vendorAToken, body: movedMoshi });
  assert.equal(updateMoshi.status, 200, 'owner can edit and move marker');
  assert.deepEqual(updateMoshi.payload.location.location.coordinates, [movedMoshi.longitude, movedMoshi.latitude]);

  const slotOne = await request(`/vendors/parking-locations/${moshiId}/slots`, { method: 'POST', token: vendorAToken, body: { slotNumber: 'C01', vehicleType: 'car' } });
  assert.equal(slotOne.status, 201);
  assert.equal((await request(`/vendors/parking-locations/${moshiId}/slots`, { method: 'POST', token: vendorAToken, body: { slotNumber: 'C01', vehicleType: 'car' } })).status, 409, 'same-location duplicate rejected');
  assert.equal((await request(`/vendors/parking-locations/${wakadId}/slots`, { method: 'POST', token: vendorAToken, body: { slotNumber: 'C01', vehicleType: 'car' } })).status, 201, 'same number allowed elsewhere');
  const bulk = await request(`/vendors/parking-locations/${moshiId}/slots/bulk`, { method: 'POST', token: vendorAToken, body: { prefix: 'B', count: 3, vehicleType: 'bike' } });
  assert.equal(bulk.status, 201);
  assert.deepEqual(bulk.payload.slots.map((slot) => slot.slotNumber), ['B01', 'B02', 'B03']);
  const evSlot = await request(`/vendors/parking-locations/${moshiId}/slots`, { method: 'POST', token: vendorAToken, body: { slotNumber: 'EV01', vehicleType: 'ev', evCompatible: true } });
  assert.equal(evSlot.payload.slot.evCompatible, true);
  assert.equal((await request(`/vendors/parking-locations/${banerId}/slots`, { method: 'POST', token: vendorAToken, body: { slotNumber: 'X01', vehicleType: 'car' } })).status, 404, 'Vendor A cannot add slots to Vendor B');

  const repricedMoshi = { ...movedMoshi, pricing: { car: 60, bike: 24, ev: 80 } };
  assert.equal((await request(`/vendors/parking-locations/${moshiId}`, { method: 'PATCH', token: vendorAToken, body: repricedMoshi })).status, 200);
  const repricedSlots = await request(`/vendors/parking-locations/${moshiId}/slots`, { token: vendorAToken });
  assert.equal(repricedSlots.payload.slots.find((slot) => slot.slotNumber === 'C01').pricePerHour, 60, 'location pricing updates owned slots');

  const vehicle = await request('/vehicles', { method: 'POST', token: customerToken, body: { licensePlate: 'MH14AB1234', vehicleType: 'car', brand: 'Test', model: 'Car', color: 'Blue' } });
  assert.equal(vehicle.status, 201, 'existing vehicle flow works');
  const start = new Date(Date.now() + 3600000);
  const end = new Date(start.getTime() + 3600000);
  const booking = await request('/bookings', { method: 'POST', token: customerToken, body: { slotId: slotOne.payload.slot._id, vehicleId: vehicle.payload.vehicle._id, startTime: start, expectedEndTime: end, paymentMethod: 'upi' } });
  assert.equal(booking.status, 201, 'existing booking works with vendor slot');
  const vendorBookings = await request('/vendors/bookings', { token: vendorAToken });
  assert.equal(vendorBookings.payload.bookings.length, 1);
  assert.equal(vendorBookings.payload.bookings[0].slot.parkingLocation.name, 'Moshi Parking Updated');

  const dashboard = await request('/vendors/dashboard', { token: vendorAToken });
  assert.equal(dashboard.payload.stats.parkingLocations, 2);
  assert.equal(dashboard.payload.stats.totalSlots, 6);
  assert.equal(dashboard.payload.stats.activeBookings, 1);

  const deactivate = await request(`/vendors/parking-locations/${wakadId}`, { method: 'DELETE', token: vendorAToken });
  assert.equal(deactivate.payload.location.status, 'inactive');
  const wakadSlotsAfterDeactivate = await request(`/vendors/parking-locations/${wakadId}/slots`, { token: vendorAToken });
  assert.equal(wakadSlotsAfterDeactivate.payload.slots[0].status, 'maintenance', 'available slots become unbookable when location is deactivated');
  const legacySlot = await request('/slots', { method: 'POST', token: adminToken, body: { slotNumber: 'LEGACY01', floor: 'G', zone: 'A', type: 'standard', pricePerHour: 30, location: { lat: 28.61, lng: 77.2, label: 'Legacy' } } });
  assert.equal(legacySlot.status, 201, 'legacy admin slot flow remains available');
  assert.equal((await request('/slots', { token: customerToken })).status, 200, 'customer slot API remains available');

  global.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.geoapify.com/')) {
      return new Response(JSON.stringify({ results: [{ formatted: 'Moshi, Pune, Maharashtra 412105, India', address_line1: 'Moshi', city: 'Pune', district: 'Pune', state: 'Maharashtra', postcode: '412105', country: 'India', lat: 18.6712, lon: 73.8264, place_id: 'mock-place' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, options);
  };
  const suggestions = await request('/location/autocomplete?q=Moshi', { token: vendorAToken });
  global.fetch = originalFetch;
  assert.equal(suggestions.status, 200);
  assert.equal(suggestions.payload.suggestions.length, 1);
  assert.equal(suggestions.payload.suggestions[0].latitude, 18.6712);
  assert.ok(suggestions.payload.suggestions[0].selectionToken);

  const vendorLogin = await request('/auth/login', { method: 'POST', body: { email: 'vendor-a@example.com', password: 'secret12' } });
  assert.equal(vendorLogin.payload.user.role, 'vendor', 'vendor login reflects approval');
});
