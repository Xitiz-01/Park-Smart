const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const TEST_DB_NAME = 'parksmart-phase1-test';
const mongoBase = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27028';
const mongoUri = `${mongoBase.replace(/\/$/, '')}/${TEST_DB_NAME}`;

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase-one-integration-test-secret';

const { server } = require('../server');
const User = require('../models/User');

let baseUrl;

const request = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { status: response.status, payload };
};

test.before(async () => {
  await mongoose.connect(mongoUri);
  await mongoose.connection.dropDatabase();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (server.listening) await new Promise((resolve) => server.close(resolve));
});

test('customer, admin, vendor approval, suspension, and legacy flows work together', async () => {
  const customerRegistration = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Customer One', email: 'customer@example.com', phone: '9000000001', password: 'secret12', role: 'admin' },
  });
  assert.equal(customerRegistration.status, 201);
  assert.equal(customerRegistration.payload.user.role, 'customer', 'public registration must ignore privileged roles');
  const customerToken = customerRegistration.payload.token;

  const unauthenticated = await request('/vendors/me');
  assert.equal(unauthenticated.status, 401, 'unauthenticated requests are rejected');

  const customerLogin = await request('/auth/login', {
    method: 'POST', body: { email: 'customer@example.com', password: 'secret12' },
  });
  assert.equal(customerLogin.status, 200, 'existing customer login');

  await request('/auth/register', {
    method: 'POST',
    body: { name: 'Admin User', email: 'admin@example.com', phone: '9000000002', password: 'secret12' },
  });
  await User.updateOne({ email: 'admin@example.com' }, { $set: { role: 'admin' } });
  const adminLogin = await request('/auth/login', {
    method: 'POST', body: { email: 'admin@example.com', password: 'secret12' },
  });
  assert.equal(adminLogin.status, 200, 'existing admin login');
  assert.equal(adminLogin.payload.user.role, 'admin');
  const adminToken = adminLogin.payload.token;

  const applicationData = {
    businessName: 'Central Parking Co', businessType: 'Private Parking', phone: '9000000001',
    address: '10 Market Road', city: 'Delhi', state: 'Delhi', pincode: '110001',
  };
  const application = await request('/vendors/register', { method: 'POST', token: customerToken, body: applicationData });
  assert.equal(application.status, 201, 'customer can submit vendor application');
  assert.equal(application.payload.vendorProfile.vendorStatus, 'pending');
  const vendorId = application.payload.vendorProfile._id;

  const duplicate = await request('/vendors/register', { method: 'POST', token: customerToken, body: applicationData });
  assert.equal(duplicate.status, 409, 'duplicate application rejected');

  const forbiddenAdmin = await request('/admin/vendors', { token: customerToken });
  assert.equal(forbiddenAdmin.status, 403, 'customer cannot access admin vendor API');
  const pendingDashboard = await request('/vendors/dashboard', { token: customerToken });
  assert.equal(pendingDashboard.status, 403, 'pending applicant cannot access vendor dashboard API');

  const vendorList = await request('/admin/vendors', { token: adminToken });
  assert.equal(vendorList.status, 200, 'admin can list vendors');
  assert.equal(vendorList.payload.vendors.length, 1);

  const approval = await request(`/admin/vendors/${vendorId}/approve`, { method: 'PATCH', token: adminToken });
  assert.equal(approval.status, 200, 'admin can approve vendor');
  assert.equal(approval.payload.vendor.userId.role, 'vendor');

  const approvedDashboard = await request('/vendors/dashboard', { token: customerToken });
  assert.equal(approvedDashboard.status, 200, 'old ID-only JWT sees current approved vendor permissions');
  const vendorCannotAdmin = await request('/admin/vendors', { token: customerToken });
  assert.equal(vendorCannotAdmin.status, 403, 'vendor cannot access admin APIs');

  const safeUpdate = await request('/vendors/me', {
    method: 'PUT', token: customerToken, body: { businessName: 'Central Parking Updated', vendorStatus: 'suspended', role: 'admin' },
  });
  assert.equal(safeUpdate.status, 200);
  assert.equal(safeUpdate.payload.vendorProfile.businessName, 'Central Parking Updated');
  assert.equal(safeUpdate.payload.vendorProfile.vendorStatus, 'active', 'vendor cannot edit protected status');

  const secondCustomer = await request('/auth/register', {
    method: 'POST',
    body: { name: 'Booking Customer', email: 'booking@example.com', phone: '9000000003', password: 'secret12' },
  });
  const bookingToken = secondCustomer.payload.token;
  const vehicle = await request('/vehicles', {
    method: 'POST', token: bookingToken,
    body: { licensePlate: 'DL01AB1234', vehicleType: 'car', brand: 'Test', model: 'Car', color: 'Blue' },
  });
  assert.equal(vehicle.status, 201, 'existing vehicle creation still works');
  const slot = await request('/slots', {
    method: 'POST', token: adminToken,
    body: { slotNumber: 'T001', floor: 'G', zone: 'A', type: 'standard', pricePerHour: 30, location: { lat: 28.61, lng: 77.2, label: 'Test' } },
  });
  assert.equal(slot.status, 201, 'existing admin slot creation still works');
  const start = new Date(Date.now() + 3600000);
  const end = new Date(start.getTime() + 3600000);
  const booking = await request('/bookings', {
    method: 'POST', token: bookingToken,
    body: { slotId: slot.payload.slot._id, vehicleId: vehicle.payload.vehicle._id, startTime: start, expectedEndTime: end, paymentMethod: 'upi' },
  });
  assert.equal(booking.status, 201, 'existing booking flow still works');

  const rejectedApplication = await request('/vendors/register', {
    method: 'POST', token: bookingToken,
    body: { ...applicationData, businessName: 'Rejected Parking Co', phone: '9000000003' },
  });
  const rejection = await request(`/admin/vendors/${rejectedApplication.payload.vendorProfile._id}/reject`, {
    method: 'PATCH', token: adminToken,
  });
  assert.equal(rejection.status, 200, 'admin can reject vendor application');
  assert.equal(rejection.payload.vendor.vendorStatus, 'rejected');

  const suspension = await request(`/admin/vendors/${vendorId}/suspend`, { method: 'PATCH', token: adminToken });
  assert.equal(suspension.status, 200, 'admin can suspend vendor');
  const suspendedDashboard = await request('/vendors/dashboard', { token: customerToken });
  assert.equal(suspendedDashboard.status, 403, 'suspended vendor immediately loses vendor access');
  const refreshedProfile = await request('/auth/profile', { token: customerToken });
  assert.equal(refreshedProfile.payload.user.role, 'customer');
  assert.equal(refreshedProfile.payload.vendorProfile.vendorStatus, 'suspended');
});
