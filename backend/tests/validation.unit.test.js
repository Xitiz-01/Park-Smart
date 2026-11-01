const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { validate } = require('../src/platform/http/validate');
const { errorHandler } = require('../src/platform/http/errorHandler');
const bookings = require('../src/schemas/bookings');
const vehicles = require('../src/schemas/vehicles');
const locations = require('../src/schemas/parkingLocations');
const verification = require('../src/schemas/verification');

const ID = '64b7f0c2a1b2c3d4e5f60718';
const ok = (schema, value) => assert.equal(schema.safeParse(value).success, true, JSON.stringify(value));
const bad = (schema, value) => assert.equal(schema.safeParse(value).success, false, JSON.stringify(value));

test('the middleware rejects with every problem and lets valid requests through unchanged', async () => {
  const app = express();
  app.use(express.json());
  app.post('/bookings/:id', validate({ params: bookings.bookingId, body: bookings.createBooking }), (req, res) => res.json(req.body));
  app.use(errorHandler);

  const rejected = await request(app).post('/bookings/not-an-id').send({ vehicleId: { $gt: '' }, startTime: 'tomorrow-ish' });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.error.code, 'VALIDATION_FAILED');
  assert.deepEqual(rejected.body.error.details.map((d) => d.path), ['params.id', 'body.vehicleId', 'body.startTime']);
  assert.equal(rejected.body.message, 'id: must be a valid id');

  const payload = { parkingLocationId: ID, bookingType: 'regular', vehicleId: ID, startTime: '2026-11-02T10:00:00.000Z', expectedEndTime: '2026-11-02T12:00:00.000Z', note: 'kept' };
  const accepted = await request(app).post(`/bookings/${ID}`).send(payload);
  assert.equal(accepted.status, 200);
  assert.deepEqual(accepted.body, payload, 'unknown fields are kept for the controller');
});

test('booking input: ids and times are typed, slot is optional for capacity bookings', () => {
  ok(bookings.createBooking, { parkingLocationId: ID, bookingType: 'ev', slotId: ID, vehicleId: ID, startTime: '2026-11-02T10:00:00Z', expectedEndTime: '2026-11-02T11:00:00Z' });
  ok(bookings.createBooking, { slotId: null, vehicleId: ID });
  bad(bookings.createBooking, { vehicleId: ID, bookingType: 'valet' });
  bad(bookings.createBooking, { vehicleId: ID, slotId: { $ne: null } });
  bad(bookings.createBooking, {});
  bad(bookings.listBookings, { page: '1; drop' });
});

test('vehicle input: strings stay strings so operators can’t sneak in; aliases reach the controller', () => {
  ok(vehicles.vehicleInput, { licensePlate: 'MH12AB1234', make: 'Tata', model: 'Nexon EV', fuelType: 'EV', modelYear: '2024', isDefault: true });
  ok(vehicles.vehicleInput, { fuelType: null, bodyStyle: '', modelYear: 2023 });
  bad(vehicles.vehicleInput, { licensePlate: { $regex: '.*' } });
  bad(vehicles.vehicleInput, { isDefault: 'yes' });
  bad(vehicles.vehicleId, { id: '../etc' });
});

test('location and slot input accept form strings and reject nested objects where values belong', () => {
  ok(locations.locationInput, { name: 'Moshi Plaza', latitude: '18.67', longitude: 73.84, vehicleTypes: ['car', 'ev'], pricing: { car: '40', ev: 60 }, capacity: { car: 20 }, address: { city: 'Pune', pincode: '411070' } });
  bad(locations.locationInput, { pricing: { car: { $gt: 0 } } });
  bad(locations.locationInput, { vehicleTypes: 'car' });
  ok(locations.slotInput, { slotNumber: 'EV01', prefix: 'EV', count: 4 });
  bad(locations.availabilityQuery, { startTime: 'soon' });
});

test('verification input: check names and location ids are constrained', () => {
  ok(verification.externalCheck, { kind: 'bank_account' });
  bad(verification.externalCheck, { kind: '../../admin' });
  ok(verification.documentUpload, { documentType: 'PAN_CARD', category: 'IDENTITY', consent: 'true' });
  bad(verification.parkingAuthorization, { locationId: 'abc' });
  bad(verification.externalCheckInput, { identifier: { $ne: '' } });
});
