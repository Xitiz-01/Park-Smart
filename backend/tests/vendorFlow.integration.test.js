const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const TEST_DB_NAME = 'parksmart-phase2-test';
const mongoBase = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27028';
const mongoUri = `${mongoBase.replace(/\/$/, '')}/${TEST_DB_NAME}`;

process.env.NODE_ENV = 'test';
process.env.ADDRESS_SELECTION_SECRET = 'parksmart-address-selection-integration-secret';
process.env.MONGODB_URI = mongoUri;
process.env.BETTER_AUTH_SECRET = 'parksmart-better-auth-test-secret-32-characters-minimum';
process.env.GEOCODING_PROVIDER = 'geoapify';
process.env.GEOCODING_API_KEY = 'test-key';
process.env.VERIFICATION_STORAGE_LOCAL_PATH = '/tmp/parksmart-verification-integration-storage';

const { app, server } = require('../server');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const GeocodingService = require('../services/geocodingService');
const { migrateExistingUsers } = require('../services/betterAuthMigration');
const { migrateVehicleFuelTypes } = require('../scripts/migrateVehicleFuelType');
const { migrateVehicleBodyStyles } = require('../scripts/migrateVehicleBodyStyle');
const { closeBetterAuth } = require('../auth/betterAuthBridge');

let baseUrl;
const originalFetch = global.fetch;

class CookieJar {
  constructor() { this.cookies = new Map(); }

  update(response) {
    const values = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') || '').split(/,(?=[^;,]+=)/);
    values.filter(Boolean).forEach((value) => {
      const [pair] = value.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const cookieValue = pair.slice(separator + 1);
      if (cookieValue) this.cookies.set(name, cookieValue);
      else this.cookies.delete(name);
    });
  }

  header() { return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; '); }
}

const request = async (path, { method = 'GET', client, body } = {}) => {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await originalFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      Origin: 'http://localhost:3000',
      ...(client?.header() ? { Cookie: client.header() } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  client?.update(response);
  return { status: response.status, payload: await response.json() };
};

const verificationUpload = (fields, content = Buffer.from('%PDF-1.4\n%%EOF'), options = {}) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  form.append('document', new Blob([content], { type: options.type || 'application/pdf' }), options.name || 'evidence.pdf');
  return form;
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
    .map((day) => [day, { open: true, allDay: true, openTime: '06:00', closeTime: '23:00' }])
);

const locationPayload = (name, address, pricing = { car: 50, motorcycle: 20, ev: 70 }) => ({
  name, description: `${name} description`,
  address: {
    formattedAddress: address.formattedAddress, addressLine1: address.addressLine1,
    city: address.city, district: address.district, state: address.state,
    pincode: address.pincode, country: address.country,
  },
  latitude: address.latitude, longitude: address.longitude, selectionToken: address.selectionToken,
  vehicleTypes: ['car', 'motorcycle', 'ev'], evSupported: true,
  evDetails: { slotCount: 2, chargerType: 'CCS2' }, operatingHours: operatingHours(),
  amenities: ['covered', 'cctv', 'security_guard', 'accessible'], pricing,
  capacity: { car: 1, motorcycle: 2 },
});

const register = async (name, email, phone, extras = {}) => {
  const client = new CookieJar();
  const response = await request('/auth/sign-up/email', {
    method: 'POST', client, body: { name, email, phone, password: 'secret12', ...extras },
  });
  return { ...response, client };
};

const login = async (email, password = 'secret12') => {
  const client = new CookieJar();
  const response = await request('/auth/sign-in/email', { method: 'POST', client, body: { email, password } });
  return { ...response, client };
};

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
  await closeBetterAuth();
});

test('Better Auth, RBAC, migration, and ParkSmart domain flows work end-to-end', async () => {
  const vendorARegistration = await register('Vendor A', 'vendor-a@example.com', '9000000001');
  assert.equal(vendorARegistration.status, 200);
  const vendorAProfile = await request('/account/profile', { client: vendorARegistration.client });
  assert.equal(vendorAProfile.payload.user.role, 'customer');
  const vendorAClient = vendorARegistration.client;
  const vendorBRegistration = await register('Vendor B', 'vendor-b@example.com', '9000000002');
  const vendorBClient = vendorBRegistration.client;
  const customerRegistration = await register('Customer', 'customer@example.com', '9000000003');
  const customerClient = customerRegistration.client;
  const adminRegistration = await register('Admin', 'admin@example.com', '9000000004');
  process.env.BETTER_AUTH_SUPER_ADMIN_USER_IDS = adminRegistration.payload.user.id;
  await request('/account/profile', { client: adminRegistration.client });
  const adminLogin = await login('admin@example.com');
  assert.equal(adminLogin.status, 200, 'admin login still works');
  const adminClient = adminLogin.client;
  assert.equal((await login('customer@example.com')).status, 200, 'customer login still works');

  const roleInjection = await register('Injected Role', 'injected@example.com', '9000000009', { role: 'admin' });
  assert.equal(roleInjection.status, 400, 'public signup cannot self-assign ADMIN');
  assert.equal((await request('/admin/dashboard')).status, 401, 'unauthenticated API access is rejected');
  assert.equal((await request('/admin/dashboard', { client: customerClient })).status, 403, 'customer cannot access admin APIs');

  const noSelectedAddress = await request('/vendors/register', {
    method: 'POST', client: vendorAClient,
    body: { ...applicationPayload('Invalid Address Vendor', '9000000001'), selectionToken: '' },
  });
  assert.equal(noSelectedAddress.status, 400, 'unselected address is rejected');
  const invalidState = await request('/vendors/register', {
    method: 'POST', client: vendorAClient,
    body: { ...applicationPayload('Invalid State Vendor', '9000000001'), state: 'Atlantis' },
  });
  assert.equal(invalidState.status, 400, 'invalid state is rejected');

  const applicationA = await request('/vendors/register', { method: 'POST', client: vendorAClient, body: applicationPayload('Vendor A Parking', '9000000001') });
  assert.equal(applicationA.status, 201);
  assert.deepEqual(applicationA.payload.vendorProfile.businessLocation.coordinates, [73.8264, 18.6712]);
  assert.equal((await request('/vendors/parking-locations', { client: vendorAClient })).status, 403, 'pending vendor cannot manage parking');

  const bAddress = selected({ formattedAddress: 'Baner, Pune, Maharashtra 411045, India', addressLine1: 'Baner Road', city: 'Pune', pincode: '411045', latitude: 18.559, longitude: 73.7868, providerPlaceId: 'test-place-baner' });
  const applicationB = await request('/vendors/register', { method: 'POST', client: vendorBClient, body: applicationPayload('Vendor B Parking', '9000000002', bAddress) });
  await request(`/admin/vendors/${applicationA.payload.vendorProfile._id}/approve`, { method: 'PATCH', client: adminClient });
  await request(`/admin/vendors/${applicationB.payload.vendorProfile._id}/approve`, { method: 'PATCH', client: adminClient });
  assert.equal((await request('/vendors/parking-locations', { client: vendorAClient })).status, 200, 'approved vendor can manage parking');
  assert.equal((await request('/vendors/parking-locations', { client: customerClient })).status, 403, 'customer cannot access vendor parking APIs');
  assert.equal((await request('/admin/dashboard', { client: adminClient })).status, 200, 'admin access remains intact');

  const ownVerification = await request('/vendor-verification', { client: vendorAClient });
  assert.equal(ownVerification.status, 200, 'vendor can view own verification');
  assert.equal(ownVerification.payload.verification.vendor, applicationA.payload.vendorProfile._id);
  const ignoredVendorOverride = await request(`/vendor-verification?vendorId=${applicationB.payload.vendorProfile._id}`, { client: vendorAClient });
  assert.equal(ignoredVendorOverride.payload.verification.vendor, applicationA.payload.vendorProfile._id, 'vendor ID query cannot expose another vendor verification');
  assert.equal((await request('/vendor-verification', { client: customerClient })).status, 403, 'customer cannot access vendor verification');
  assert.equal(ownVerification.payload.providerAvailability.digilocker, false, 'DigiLocker is disabled without credentials');
  assert.equal((await request('/vendor-verification/digilocker/start', { method: 'POST', client: vendorAClient, body: { consent: true } })).status, 503, 'disabled DigiLocker cannot fake verification');
  assert.equal((await request('/vendor-verification/digilocker/callback?state=invalid&code=invalid')).status, 400, 'invalid DigiLocker callback state is rejected');

  const invalidUpload = verificationUpload({ category: 'IDENTITY', documentType: 'PAN', consent: true }, Buffer.from('plain text'), { type: 'text/plain', name: 'pan.txt' });
  assert.equal((await request('/vendor-verification/documents', { method: 'POST', client: vendorAClient, body: invalidUpload })).status, 400, 'invalid verification file type is rejected');
  const oversizedUpload = verificationUpload({ category: 'IDENTITY', documentType: 'PAN', consent: true }, Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(5 * 1024 * 1024)]));
  assert.equal((await request('/vendor-verification/documents', { method: 'POST', client: vendorAClient, body: oversizedUpload })).status, 413, 'oversized verification document is rejected');

  const identityDocument = await request('/vendor-verification/documents', { method: 'POST', client: vendorAClient, body: verificationUpload({ category: 'IDENTITY', documentType: 'PAN', consent: true }) });
  const businessDocument = await request('/vendor-verification/documents', { method: 'POST', client: vendorAClient, body: verificationUpload({ category: 'BUSINESS', documentType: 'BUSINESS_REGISTRATION', consent: true }) });
  const bankDocument = await request('/vendor-verification/documents', { method: 'POST', client: vendorAClient, body: verificationUpload({ category: 'BANK', documentType: 'BANK_PROOF', consent: true }) });
  assert.deepEqual([identityDocument.status, businessDocument.status, bankDocument.status], [201, 201, 201], 'manual identity, business, and bank evidence can be submitted');
  assert.equal((await request(`/admin/vendor-verifications/${applicationA.payload.vendorProfile._id}`, { client: adminClient })).status, 200, 'admin can inspect a verification case');
  assert.equal((await request(`/admin/vendor-verifications/document/${identityDocument.payload.document._id}/resubmit`, { method: 'PATCH', client: adminClient, body: { reason: 'Image needs a clearer edge' } })).status, 200, 'admin can request resubmission');
  assert.equal((await request(`/admin/vendor-verifications/document/${businessDocument.payload.document._id}/reject`, { method: 'PATCH', client: adminClient, body: { reason: 'Registration details need confirmation' } })).status, 200, 'admin can reject evidence with a reason');
  assert.equal((await request(`/admin/vendor-verifications/document/${identityDocument.payload.document._id}/approve`, { method: 'PATCH', client: adminClient, body: {} })).status, 200, 'admin can approve resubmitted evidence');
  assert.equal((await request(`/admin/vendor-verifications/document/${businessDocument.payload.document._id}/approve`, { method: 'PATCH', client: adminClient, body: {} })).status, 200, 'admin can approve previously rejected evidence');
  assert.equal((await request(`/admin/vendor-verifications/document/${bankDocument.payload.document._id}/approve`, { method: 'PATCH', client: adminClient, body: {} })).status, 200, 'admin can approve bank readiness evidence');
  assert.equal((await request(`/admin/vendor-verifications/document/${identityDocument.payload.document._id}/content`, { client: customerClient })).status, 403, 'customer cannot access private verification documents');
  const adminDocumentResponse = await originalFetch(`${baseUrl}/admin/vendor-verifications/document/${identityDocument.payload.document._id}/content`, { headers: { Origin: 'http://localhost:3000', Cookie: adminClient.header() } });
  assert.equal(adminDocumentResponse.status, 200, 'authorized admin can access a private verification document');
  assert.equal(adminDocumentResponse.headers.get('cache-control'), 'no-store, private');
  const verifiedSummary = await request('/vendor-verification', { client: vendorAClient });
  assert.equal(verifiedSummary.payload.verification.overallStatus, 'VERIFIED');
  assert.equal(verifiedSummary.payload.verification.bankStatus, 'VERIFIED');
  assert.equal(verifiedSummary.payload.verification.payoutEligible, true, 'payout eligibility is derived from overall and bank verification');
  assert.ok(verifiedSummary.payload.audit.some((entry) => entry.action === 'RESUBMISSION_REQUESTED'), 'verification actions create audit entries');

  const invalidCoordinates = await request('/vendors/parking-locations', {
    method: 'POST', client: vendorAClient, body: { ...locationPayload('Bad Coordinates', selected()), latitude: 999 },
  });
  assert.equal(invalidCoordinates.status, 400);
  const negativePricing = await request('/vendors/parking-locations', {
    method: 'POST', client: vendorAClient, body: locationPayload('Bad Pricing', selected(), { car: -1, motorcycle: 20, ev: 70 }),
  });
  assert.equal(negativePricing.status, 400);

  const moshiAddress = selected();
  const wakadAddress = selected({ formattedAddress: 'Wakad, Pune, Maharashtra 411057, India', addressLine1: 'Wakad Road', city: 'Pune', pincode: '411057', latitude: 18.5975, longitude: 73.7898, providerPlaceId: 'test-place-wakad' });
  const createMoshi = await request('/vendors/parking-locations', { method: 'POST', client: vendorAClient, body: locationPayload('Moshi Parking', moshiAddress, { car: 50, motorcycle: 20, ev: 70 }) });
  const createWakad = await request('/vendors/parking-locations', { method: 'POST', client: vendorAClient, body: locationPayload('Wakad Parking', wakadAddress, { car: 80, motorcycle: 30, ev: 100 }) });
  const createBaner = await request('/vendors/parking-locations', { method: 'POST', client: vendorBClient, body: locationPayload('Baner Parking', bAddress, { car: 65, motorcycle: 25, ev: 85 }) });
  assert.equal(createMoshi.status, 201);
  assert.equal(createWakad.status, 201, 'vendor can create multiple locations');
  assert.equal(createMoshi.payload.location.pricing.car, 50);
  assert.equal(createWakad.payload.location.pricing.car, 80, 'per-location prices differ');
  const moshiId = createMoshi.payload.location._id;
  const wakadId = createWakad.payload.location._id;
  const banerId = createBaner.payload.location._id;
  assert.equal(createMoshi.payload.location.status, 'draft', 'new locations start as drafts');
  assert.equal((await request(`/vendors/parking-locations/${moshiId}/publish`, { method: 'POST', client: vendorAClient })).status, 409, 'verified vendor cannot publish without location authorization');
  assert.equal((await request(`/vendors/parking-locations/${banerId}/publish`, { method: 'POST', client: vendorBClient })).status, 409, 'unverified vendor cannot publish');

  const moshiAuthorization = await request(`/vendor-verification/parking-authorizations/${moshiId}`, { method: 'POST', client: vendorAClient, body: verificationUpload({ documentType: 'OWNERSHIP_PROOF', consent: true }) });
  const wakadAuthorization = await request(`/vendor-verification/parking-authorizations/${wakadId}`, { method: 'POST', client: vendorAClient, body: verificationUpload({ documentType: 'LEASE', consent: true }) });
  assert.deepEqual([moshiAuthorization.status, wakadAuthorization.status], [201, 201], 'vendor can submit per-location authorization evidence');
  assert.equal((await request(`/admin/vendor-verifications/authorization/${moshiAuthorization.payload.authorization._id}/approve`, { method: 'PATCH', client: adminClient, body: {} })).status, 200);
  assert.equal((await request(`/admin/vendor-verifications/authorization/${wakadAuthorization.payload.authorization._id}/approve`, { method: 'PATCH', client: adminClient, body: {} })).status, 200);
  assert.equal((await request(`/vendors/parking-locations/${moshiId}/publish`, { method: 'POST', client: vendorAClient })).status, 200, 'verified vendor can publish an authorized location');
  assert.equal((await request(`/vendors/parking-locations/${wakadId}/publish`, { method: 'POST', client: vendorAClient })).status, 200, 'publishing gate is scoped per location');

  const vendorAList = await request('/vendors/parking-locations', { client: vendorAClient });
  assert.equal(vendorAList.payload.locations.length, 2);
  assert.ok(vendorAList.payload.locations.every((location) => location.vendorId === applicationA.payload.vendorProfile._id));
  assert.equal((await request(`/vendors/parking-locations/${banerId}`, { client: vendorAClient })).status, 404, 'Vendor A cannot view Vendor B data');
  assert.equal((await request(`/vendors/parking-locations/${banerId}`, { method: 'PATCH', client: vendorAClient, body: locationPayload('Stolen', bAddress) })).status, 404, 'Vendor A cannot edit Vendor B data');

  const movedMoshi = locationPayload('Moshi Parking Updated', moshiAddress, { car: 55, motorcycle: 22, ev: 75 });
  movedMoshi.latitude += 0.001;
  movedMoshi.longitude += 0.001;
  const updateMoshi = await request(`/vendors/parking-locations/${moshiId}`, { method: 'PATCH', client: vendorAClient, body: movedMoshi });
  assert.equal(updateMoshi.status, 200, 'owner can edit and move marker');
  assert.deepEqual(updateMoshi.payload.location.location.coordinates, [movedMoshi.longitude, movedMoshi.latitude]);

  const regularSlotRejected = await request(`/vendors/parking-locations/${moshiId}/slots`, { method: 'POST', client: vendorAClient, body: { slotNumber: 'C01', vehicleType: 'car' } });
  assert.equal(regularSlotRejected.status, 400, 'regular vehicles are managed by capacity rather than physical slots');
  const slotOne = await request(`/vendors/parking-locations/${moshiId}/slots`, { method: 'POST', client: vendorAClient, body: { slotNumber: 'C01', vehicleType: 'ev' } });
  assert.equal(slotOne.status, 201);
  assert.equal(slotOne.payload.slot.vehicleType, 'ev');
  assert.equal((await request(`/vendors/parking-locations/${moshiId}/slots`, { method: 'POST', client: vendorAClient, body: { slotNumber: 'C01', vehicleType: 'ev' } })).status, 409, 'same-location duplicate rejected');
  assert.equal((await request(`/vendors/parking-locations/${wakadId}/slots`, { method: 'POST', client: vendorAClient, body: { slotNumber: 'C01', vehicleType: 'ev' } })).status, 201, 'same number allowed elsewhere');
  const bulk = await request(`/vendors/parking-locations/${moshiId}/slots/bulk`, { method: 'POST', client: vendorAClient, body: { prefix: 'B', count: 3, vehicleType: 'ev' } });
  assert.equal(bulk.status, 201);
  assert.deepEqual(bulk.payload.slots.map((slot) => slot.slotNumber), ['B01', 'B02', 'B03']);
  const evSlot = await request(`/vendors/parking-locations/${moshiId}/slots`, { method: 'POST', client: vendorAClient, body: { slotNumber: 'EV01', vehicleType: 'ev', evCompatible: true } });
  assert.equal(evSlot.payload.slot.evCompatible, true);
  assert.equal((await request(`/vendors/parking-locations/${banerId}/slots`, { method: 'POST', client: vendorAClient, body: { slotNumber: 'X01', vehicleType: 'ev' } })).status, 404, 'Vendor A cannot add slots to Vendor B');

  const repricedMoshi = { ...movedMoshi, pricing: { car: 60, motorcycle: 24, ev: 80 } };
  assert.equal((await request(`/vendors/parking-locations/${moshiId}`, { method: 'PATCH', client: vendorAClient, body: repricedMoshi })).status, 200);
  const repricedSlots = await request(`/vendors/parking-locations/${moshiId}/slots`, { client: vendorAClient });
  assert.equal(repricedSlots.payload.slots.find((slot) => slot.slotNumber === 'C01').pricePerHour, 80, 'location EV pricing updates owned physical slots');

  const catalogBrands = await request('/vehicle-catalog/brands', { client: customerClient });
  assert.equal(catalogBrands.status, 200, 'vehicle catalog brands endpoint is available');
  assert.ok(catalogBrands.payload.brands.includes('Mahindra'));
  const unfilteredLegacyQuery = await request('/vehicle-catalog/brands?vehicleType=suv', { client: customerClient });
  assert.deepEqual(unfilteredLegacyQuery.payload.makes, catalogBrands.payload.makes, 'make list is not filtered by the old car/SUV distinction');
  assert.deepEqual(catalogBrands.payload.makes, catalogBrands.payload.brands, 'make and legacy brand response aliases agree');
  const catalogModels = await request('/vehicle-catalog/models?make=Mahindra', { client: customerClient });
  assert.equal(catalogModels.status, 200, 'vehicle catalog models endpoint is available');
  assert.ok(catalogModels.payload.models.some((item) => item.model === 'XEV 9e'));
  assert.equal((await request('/vehicle-catalog/models?brand=Imaginary%20Motors', { client: customerClient })).status, 404, 'unknown catalog brands are rejected');
  const catalogYears = await request('/vehicle-catalog/years?make=Mahindra&model=XEV%209e', { client: customerClient });
  assert.ok(catalogYears.payload.years.includes(2026), 'historical/current model years are available');
  const catalogDetails = await request('/vehicle-catalog/details?make=Mahindra&model=XEV%209e&modelYear=2026', { client: customerClient });
  assert.equal(catalogDetails.payload.vehicle.make, 'Mahindra');
  assert.equal(catalogDetails.payload.vehicle.vehicleType, 'car');
  assert.equal(catalogDetails.payload.vehicle.bodyStyle, 'suv');
  assert.deepEqual(catalogDetails.payload.vehicle.fuelTypes, ['electric']);
  assert.equal((await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14FAKE0', vehicleType: 'car', bodyStyle: 'suv', fuelType: 'electric', make: 'Imaginary Motors', model: 'X1' } })).status, 400, 'invalid makes are rejected');
  assert.equal((await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14FAKE1', vehicleType: 'car', bodyStyle: 'suv', fuelType: 'electric', make: 'Mahindra', model: 'RandomFakeModel' } })).status, 400, 'invalid make/model combinations are rejected');
  assert.equal((await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14WRONG', vehicleType: 'car', bodyStyle: 'suv', fuelType: 'petrol', make: 'Hyundai', model: 'i20' } })).status, 400, 'catalog body metadata is validated server-side');
  assert.equal((await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14BADYR1', vehicleType: 'car', bodyStyle: 'suv', fuelType: 'electric', make: 'Mahindra', model: 'XEV 9e', modelYear: 2000 } })).status, 400, 'model years outside the catalog range are rejected');

  const vehicle = await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14AB1234', vehicleType: 'CAR', bodyStyle: 'HATCHBACK', fuelType: 'PETROL', make: 'Hyundai', model: 'i20', modelYear: 2024, color: 'Blue' } });
  assert.equal(vehicle.status, 201, 'existing vehicle flow works');
  assert.equal(vehicle.payload.vehicle.vehicleType, 'car', 'physical vehicle type is normalized');
  assert.equal(vehicle.payload.vehicle.fuelType, 'petrol', 'fuel type is normalized and returned by the API');
  assert.equal(vehicle.payload.vehicle.make, 'Hyundai');
  assert.equal(vehicle.payload.vehicle.modelYear, 2024);
  const dieselVehicle = await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14DS1234', vehicleType: 'car', bodyStyle: 'suv', fuelType: 'diesel', make: 'Hyundai', model: 'Creta' } });
  assert.equal(dieselVehicle.status, 201, 'diesel cars can be created');
  assert.equal((await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14NOFUEL', vehicleType: 'car' } })).status, 400, 'new vehicles require a fuel type');
  const customerUser = await User.findOne({ authUserId: customerRegistration.payload.user.id });
  const missingFuelVehicleId = new mongoose.Types.ObjectId();
  await Vehicle.collection.insertOne({
    _id: missingFuelVehicleId, user: customerUser._id, licensePlate: 'MH14OLD123', vehicleType: 'car',
    isDefault: false, createdAt: new Date(), updatedAt: new Date(),
  });
  const vehiclesWithLegacyRecord = await request('/vehicles', { client: customerClient });
  assert.equal(vehiclesWithLegacyRecord.payload.vehicles.find((item) => item._id === String(missingFuelVehicleId)).fuelType, null, 'old vehicles without fuelType remain readable');
  assert.equal((await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14BAD123', vehicleType: 'car', fuelType: 'steam' } })).status, 400, 'invalid fuel types are rejected');
  assert.equal((await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14EV0000', vehicleType: 'ev', fuelType: 'electric' } })).status, 400, 'new vehicles cannot use EV as a physical class');
  const start = new Date(Date.now() + 3600000);
  const end = new Date(start.getTime() + 3600000);
  const [reservedBay, occupiedBay, maintenanceBay] = bulk.payload.slots;
  assert.equal((await request(`/vendors/slots/${reservedBay._id}`, { method: 'PATCH', client: vendorAClient, body: { status: 'reserved' } })).status, 200);
  assert.equal((await request(`/vendors/slots/${occupiedBay._id}`, { method: 'PATCH', client: vendorAClient, body: { status: 'occupied' } })).status, 200);
  assert.equal((await request(`/vendors/slots/${maintenanceBay._id}`, { method: 'PATCH', client: vendorAClient, body: { status: 'maintenance' } })).status, 200);
  const evBoard = await request(`/parking-locations/${moshiId}?vehicleType=car&fuelType=electric&startTime=${encodeURIComponent(start.toISOString())}&endTime=${encodeURIComponent(end.toISOString())}`, { client: customerClient });
  const boardStates = Object.fromEntries(evBoard.payload.location.availability.evSlots.map((slot) => [slot.slotNumber, slot.availabilityStatus]));
  assert.equal(boardStates[reservedBay.slotNumber], 'reserved');
  assert.equal(boardStates[occupiedBay.slotNumber], 'occupied');
  assert.equal(boardStates[maintenanceBay.slotNumber], 'maintenance');
  assert.equal(boardStates[evSlot.payload.slot.slotNumber], 'available');
  const booking = await request('/bookings', { method: 'POST', client: customerClient, body: { parkingLocationId: moshiId, bookingType: 'regular', vehicleId: vehicle.payload.vehicle._id, startTime: start, expectedEndTime: end } });
  assert.equal(booking.status, 201, 'regular booking reserves location capacity');
  assert.equal(booking.payload.booking.slot, null, 'regular booking has no numbered slot');
  assert.equal(booking.payload.booking.paymentStatus, 'pending', 'booking does not fake payment settlement');
  const vendorBookings = await request('/vendors/bookings', { client: vendorAClient });
  assert.equal(vendorBookings.payload.bookings.length, 1);
  assert.equal(vendorBookings.payload.bookings[0].parkingLocation.name, 'Moshi Parking Updated');

  const discovered = await request(`/parking-locations/nearby?lat=${movedMoshi.latitude}&lng=${movedMoshi.longitude}&radiusKm=5&vehicleType=car&startTime=${encodeURIComponent(start.toISOString())}&endTime=${encodeURIComponent(end.toISOString())}`, { client: customerClient });
  assert.equal(discovered.status, 200, 'dynamic parking discovery works');
  assert.equal(discovered.payload.locations.find((item) => item._id === moshiId).availability.available, 0, 'discovery reports reserved capacity');
  const regularAtEvLocation = await request(`/parking-locations/nearby?lat=${movedMoshi.latitude}&lng=${movedMoshi.longitude}&radiusKm=5&vehicleType=car&fuelType=petrol&ev=true&startTime=${encodeURIComponent(start.toISOString())}&endTime=${encodeURIComponent(end.toISOString())}`, { client: customerClient });
  assert.equal(regularAtEvLocation.status, 200, 'EV-only filtering remains available to regular vehicles');
  assert.ok(regularAtEvLocation.payload.locations.some((item) => item._id === moshiId));
  assert.equal(regularAtEvLocation.payload.requestedWindow.bookingType, 'regular', 'manual EV filtering does not change booking mode');

  const raceStart = new Date(start.getTime() + 3 * 3600000);
  const raceEnd = new Date(raceStart.getTime() + 3600000);
  const racePayload = { parkingLocationId: moshiId, bookingType: 'regular', vehicleId: vehicle.payload.vehicle._id, startTime: raceStart, expectedEndTime: raceEnd };
  const race = await Promise.all([
    request('/bookings', { method: 'POST', client: customerClient, body: racePayload }),
    request('/bookings', { method: 'POST', client: customerClient, body: racePayload }),
  ]);
  assert.deepEqual(race.map((result) => result.status).sort(), [201, 409], 'atomic capacity ledger prevents concurrent overbooking');
  const winningRaceBooking = race.find((result) => result.status === 201).payload.booking;
  assert.equal((await request(`/bookings/${winningRaceBooking._id}/cancel`, { method: 'PUT', client: customerClient })).status, 200);
  const releasedCapacityBooking = await request('/bookings', { method: 'POST', client: customerClient, body: racePayload });
  assert.equal(releasedCapacityBooking.status, 201, 'cancellation immediately releases regular capacity');

  const evVehicle = await request('/vehicles', { method: 'POST', client: customerClient, body: { licensePlate: 'MH14EV1234', vehicleType: 'car', bodyStyle: 'suv', fuelType: 'electric', make: 'Mahindra', model: 'XEV 9e', modelYear: 2026, color: 'Green' } });
  assert.equal(evVehicle.status, 201, 'electric SUVs use car capacity classification and SUV body style');
  assert.equal((await request('/bookings', { method: 'POST', client: customerClient, body: { parkingLocationId: moshiId, bookingType: 'ev', slotId: reservedBay._id, vehicleId: evVehicle.payload.vehicle._id, startTime: raceStart, expectedEndTime: raceEnd } })).status, 400, 'backend rejects an EV bay that became operationally unavailable');
  const evDiscovery = await request(`/parking-locations/nearby?lat=${movedMoshi.latitude}&lng=${movedMoshi.longitude}&radiusKm=5&vehicleType=car&fuelType=electric&startTime=${encodeURIComponent(raceStart.toISOString())}&endTime=${encodeURIComponent(raceEnd.toISOString())}`, { client: customerClient });
  assert.equal(evDiscovery.status, 200, 'electric vehicle discovery returns EV-compatible locations');
  assert.ok(evDiscovery.payload.locations.some((item) => item._id === moshiId));
  assert.equal(evDiscovery.payload.requestedWindow.bookingType, 'ev');
  const evRacePayload = { parkingLocationId: moshiId, bookingType: 'ev', slotId: evSlot.payload.slot._id, vehicleId: evVehicle.payload.vehicle._id, startTime: raceStart, expectedEndTime: raceEnd };
  const evRace = await Promise.all([
    request('/bookings', { method: 'POST', client: customerClient, body: evRacePayload }),
    request('/bookings', { method: 'POST', client: customerClient, body: evRacePayload }),
  ]);
  assert.deepEqual(evRace.map((result) => result.status).sort(), [201, 409], 'atomic EV ledger prevents simultaneous overlapping reservations');
  const evBooking = evRace.find((result) => result.status === 201);
  assert.equal(evBooking.payload.booking.slot._id, evSlot.payload.slot._id);
  const laterEvStart = new Date(raceEnd.getTime() + 60000);
  const laterEvEnd = new Date(laterEvStart.getTime() + 3600000);
  assert.equal((await request('/bookings', { method: 'POST', client: customerClient, body: { parkingLocationId: moshiId, bookingType: 'ev', slotId: evSlot.payload.slot._id, vehicleId: evVehicle.payload.vehicle._id, startTime: laterEvStart, expectedEndTime: laterEvEnd } })).status, 201, 'the same EV bay can be reserved for a non-overlapping time');

  const legacyEvId = new mongoose.Types.ObjectId();
  await Vehicle.collection.insertOne({
    _id: legacyEvId, user: customerUser._id, licensePlate: 'MH14LEGACY', vehicleType: 'ev',
    brand: 'Legacy', model: 'Electric', isDefault: false, createdAt: new Date(), updatedAt: new Date(),
  });
  const legacyEvStart = new Date(laterEvEnd.getTime() + 60000);
  const legacyEvEnd = new Date(legacyEvStart.getTime() + 3600000);
  const legacyEvBooking = await request('/bookings', { method: 'POST', client: customerClient, body: { parkingLocationId: moshiId, bookingType: 'ev', slotId: evSlot.payload.slot._id, vehicleId: legacyEvId, startTime: legacyEvStart, expectedEndTime: legacyEvEnd } });
  assert.equal(legacyEvBooking.status, 201, 'legacy vehicleType=ev records still use EV exact-slot booking');
  assert.equal(legacyEvBooking.payload.booking.bookingType, 'ev');
  assert.equal(legacyEvBooking.payload.booking.vehicleType, 'car');

  const quietLogger = { log() {}, warn() {} };
  const preview = await migrateVehicleFuelTypes({ collection: Vehicle.collection, apply: false, logger: quietLogger });
  assert.equal(preview.migrated, 1, 'migration dry run reports the legacy EV record');
  assert.equal((await Vehicle.collection.findOne({ _id: legacyEvId })).vehicleType, 'ev', 'migration preview does not write');
  const appliedVehicleMigration = await migrateVehicleFuelTypes({ collection: Vehicle.collection, apply: true, logger: quietLogger });
  assert.equal(appliedVehicleMigration.migrated, 1);
  const migratedVehicle = await Vehicle.collection.findOne({ _id: legacyEvId });
  assert.equal(migratedVehicle.vehicleType, 'car');
  assert.equal(migratedVehicle.fuelType, 'electric');
  const repeatedVehicleMigration = await migrateVehicleFuelTypes({ collection: Vehicle.collection, apply: true, logger: quietLogger });
  assert.equal(repeatedVehicleMigration.migrated, 0, 'vehicle fuel migration is idempotent');

  const legacySuvId = new mongoose.Types.ObjectId();
  const conflictingSuvId = new mongoose.Types.ObjectId();
  await Vehicle.collection.insertMany([
    {
      _id: legacySuvId, user: customerUser._id, licensePlate: 'MH14OLDSUV', vehicleType: 'suv', fuelType: 'diesel',
      brand: 'Hyundai', model: 'Creta', isDefault: false, createdAt: new Date(), updatedAt: new Date(),
    },
    {
      _id: conflictingSuvId, user: customerUser._id, licensePlate: 'MH14ODDBDY', vehicleType: 'suv', bodyStyle: 'hatchback', fuelType: 'petrol',
      brand: 'Legacy', model: 'Imported', isDefault: false, createdAt: new Date(), updatedAt: new Date(),
    },
  ]);
  const editLegacySuv = await request(`/vehicles/${legacySuvId}`, { method: 'PUT', client: customerClient, body: { color: 'Silver' } });
  assert.equal(editLegacySuv.status, 200, 'an unchanged legacy SUV catalog identity remains editable');
  assert.equal(editLegacySuv.payload.vehicle.vehicleType, 'suv', 'compatibility read does not silently rewrite persisted data');
  const bodyPreview = await migrateVehicleBodyStyles({ collection: Vehicle.collection, apply: false, logger: quietLogger });
  assert.equal(bodyPreview.migrated, 2, 'body-style migration dry run reports legacy SUVs');
  assert.equal(bodyPreview.conflicts, 1, 'explicit contradictory body style is reported');
  assert.equal((await Vehicle.collection.findOne({ _id: legacySuvId })).vehicleType, 'suv', 'body-style preview does not write');
  const appliedBodyMigration = await migrateVehicleBodyStyles({ collection: Vehicle.collection, apply: true, logger: quietLogger });
  assert.equal(appliedBodyMigration.migrated, 2);
  const migratedSuv = await Vehicle.collection.findOne({ _id: legacySuvId });
  assert.equal(migratedSuv.vehicleType, 'car');
  assert.equal(migratedSuv.bodyStyle, 'suv');
  const preservedConflict = await Vehicle.collection.findOne({ _id: conflictingSuvId });
  assert.equal(preservedConflict.vehicleType, 'car');
  assert.equal(preservedConflict.bodyStyle, 'hatchback', 'migration preserves explicit body style conflicts');
  assert.equal((await migrateVehicleBodyStyles({ collection: Vehicle.collection, apply: true, logger: quietLogger })).migrated, 0, 'body-style migration is idempotent');

  assert.equal((await request(`/vendors/bookings/${booking.payload.booking._id}/checkin`, { method: 'PUT', client: vendorBClient })).status, 404, 'another vendor cannot check in this booking');
  assert.equal((await request(`/vendors/bookings/${booking.payload.booking._id}/checkin`, { method: 'PUT', client: vendorAClient })).status, 200, 'owning vendor can check in');
  const checkedOut = await request(`/vendors/bookings/${booking.payload.booking._id}/checkout`, { method: 'PUT', client: vendorAClient });
  assert.equal(checkedOut.status, 200, 'owning vendor can check out');
  assert.ok(checkedOut.payload.booking.checkOutTime);

  const dashboard = await request('/vendors/dashboard', { client: vendorAClient });
  assert.equal(dashboard.payload.stats.parkingLocations, 2);
  assert.ok(dashboard.payload.stats.totalSlots >= 12, 'dashboard combines regular capacity and EV bays');
  assert.ok(dashboard.payload.stats.activeBookings >= 2);

  const deactivate = await request(`/vendors/parking-locations/${wakadId}`, { method: 'DELETE', client: vendorAClient });
  assert.equal(deactivate.payload.location.status, 'inactive');
  const wakadSlotsAfterDeactivate = await request(`/vendors/parking-locations/${wakadId}/slots`, { client: vendorAClient });
  assert.equal(wakadSlotsAfterDeactivate.payload.slots[0].status, 'maintenance', 'available slots become unbookable when location is deactivated');
  const legacySlot = await request('/slots', { method: 'POST', client: adminClient, body: { slotNumber: 'LEGACY01', floor: 'G', zone: 'A', type: 'standard', pricePerHour: 30, location: { lat: 28.61, lng: 77.2, label: 'Legacy' } } });
  assert.equal(legacySlot.status, 201, 'legacy admin slot flow remains available');
  assert.equal((await request('/slots', { client: customerClient })).status, 200, 'customer slot API remains available');

  global.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.geoapify.com/')) {
      return new Response(JSON.stringify({ results: [{ formatted: 'Moshi, Pune, Maharashtra 412105, India', address_line1: 'Moshi', city: 'Pune', district: 'Pune', state: 'Maharashtra', postcode: '412105', country: 'India', lat: 18.6712, lon: 73.8264, place_id: 'mock-place' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, options);
  };
  const suggestions = await request('/location/autocomplete?q=Moshi', { client: vendorAClient });
  global.fetch = originalFetch;
  assert.equal(suggestions.status, 200);
  assert.equal(suggestions.payload.suggestions.length, 1);
  assert.equal(suggestions.payload.suggestions[0].latitude, 18.6712);
  assert.ok(suggestions.payload.suggestions[0].selectionToken);

  const vendorLogin = await login('vendor-a@example.com');
  const approvedVendorProfile = await request('/account/profile', { client: vendorLogin.client });
  assert.equal(approvedVendorProfile.payload.user.role, 'vendor', 'domain profile reflects vendor approval');

  assert.equal(
    (await request(`/vehicles/${vehicle.payload.vehicle._id}`, { method: 'DELETE', client: vendorBClient })).status,
    404,
    'another user cannot modify a customer vehicle'
  );
  assert.equal(
    (await request(`/bookings/${booking.payload.booking._id}`, { client: vendorBClient })).status,
    403,
    'another user cannot read a customer booking'
  );

  const adminCandidate = await register('Admin Candidate', 'admin-candidate@example.com', '9000000010');
  const candidateProfile = await request('/account/profile', { client: adminCandidate.client });
  const promotion = await request(`/admin/users/${candidateProfile.payload.user._id}/role`, {
    method: 'PATCH', client: adminClient, body: { role: 'admin' },
  });
  assert.equal(promotion.status, 200, 'SUPER_ADMIN can promote an eligible customer to ADMIN');
  const candidateLogin = await login('admin-candidate@example.com');
  const promotedProfile = await request('/account/profile', { client: candidateLogin.client });
  assert.equal(promotedProfile.payload.user.role, 'admin');

  const vendorC = await register('Vendor C', 'vendor-c@example.com', '9000000012');
  const applicationC = await request('/vendors/register', {
    method: 'POST', client: vendorC.client, body: applicationPayload('Vendor C Parking', '9000000012'),
  });
  const normalAdminApproval = await request(`/admin/vendors/${applicationC.payload.vendorProfile._id}/approve`, {
    method: 'PATCH', client: candidateLogin.client,
  });
  assert.equal(normalAdminApproval.status, 200, 'normal ADMIN can approve a vendor application');
  assert.equal((await request('/account/profile', { client: vendorC.client })).payload.user.role, 'vendor');

  assert.equal(
    (await request(`/admin/users/${customerRegistration.payload.user.id}/role`, {
      method: 'PATCH', client: candidateLogin.client, body: { role: 'super_admin' },
    })).status,
    403,
    'normal ADMIN cannot grant SUPER_ADMIN'
  );

  const legacyId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id: legacyId,
    name: 'Legacy Admin',
    email: 'legacy-admin@example.com',
    phone: '9000000011',
    password: await bcrypt.hash('secret12', 10),
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const migration = await migrateExistingUsers({ db: mongoose.connection.db, dryRun: false, logger: { log() {}, warn() {} } });
  assert.ok(migration.linked >= 1, 'existing ParkSmart user was linked');
  const legacyLogin = await login('legacy-admin@example.com');
  assert.equal(legacyLogin.status, 200, 'legacy bcrypt password works after migration');
  const legacyProfile = await request('/account/profile', { client: legacyLogin.client });
  assert.equal(legacyProfile.payload.user._id, legacyId.toString(), 'existing domain user ID is preserved');
  assert.equal(legacyProfile.payload.user.role, 'admin', 'existing role is preserved');

  assert.equal((await request('/auth/sign-out', { method: 'POST', client: vendorLogin.client })).status, 200);
  assert.equal((await request('/account/profile', { client: vendorLogin.client })).status, 401, 'logout invalidates the session');
});
