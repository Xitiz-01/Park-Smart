const test = require('node:test');
const assert = require('node:assert/strict');

const TEST_DB_NAME = 'parksmart-seed-test';
const mongoBase = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27028';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = `${mongoBase.replace(/\/$/, '')}/${TEST_DB_NAME}`;
process.env.BETTER_AUTH_SECRET = 'parksmart-better-auth-test-secret-32-characters-minimum';
process.env.SEED_PASSWORD = 'seed-integration-pass';

const mongoose = require('mongoose');
const { seed, closeConnections } = require('../scripts/seed');

test.after(async () => {
  await mongoose.connection.db?.dropDatabase();
  await closeConnections();
});

test('seed creates accounts that can sign in, plus the domain data', async () => {
  // Like a running API: its indexes already exist when the reset drops them.
  await mongoose.connect(process.env.MONGODB_URI);
  await require('../models/ParkingLocation').init();
  await seed(['--reset']);
  const { db } = mongoose.connection;

  const users = await db
    .collection('users')
    .find({}, { projection: { email: 1, role: 1 } })
    .sort({ email: 1 })
    .toArray();
  assert.deepEqual(
    users.map(({ email, role }) => [email, role]),
    [
      ['admin@parksmart.test', 'admin'],
      ['applicant@parksmart.test', 'customer'],
      ['customer@parksmart.test', 'customer'],
      ['vendor@parksmart.test', 'vendor'],
    ],
  );
  const admin = await db.collection('user').findOne({ email: 'admin@parksmart.test' });
  assert.equal(admin.role, 'admin');

  assert.equal(await db.collection('vendorprofiles').countDocuments({ verificationStatus: 'approved' }), 1);
  assert.equal(await db.collection('vendorprofiles').countDocuments({ verificationStatus: 'pending' }), 1);
  assert.equal(await db.collection('parkinglocations').countDocuments({ status: 'active' }), 2);
  assert.equal(await db.collection('parkinglocations').countDocuments({ status: 'draft' }), 1);
  assert.equal(await db.collection('parkingslots').countDocuments({ type: 'ev' }), 6);
  assert.equal(await db.collection('vehicles').countDocuments(), 2);
  // The reset drops indexes too; nearby search needs the 2dsphere one back.
  const indexes = await db.collection('parkinglocations').indexes();
  assert.ok(
    indexes.some((index) => index.key.location === '2dsphere'),
    'the geo index is rebuilt after a reset',
  );
  // Bookings are left to the app, so the reservation ledger stays untouched.
  assert.equal(await db.collection('bookings').countDocuments(), 0);

  const { auth } = await import('../auth/betterAuth.mjs');
  const signedIn = await auth.api.signInEmail({
    body: { email: 'vendor@parksmart.test', password: 'seed-integration-pass' },
  });
  assert.ok(signedIn.token);
});

test('seed leaves a database with users alone', async () => {
  await seed(['--if-empty']);
  assert.equal(await mongoose.connection.db.collection('users').countDocuments(), 4);
  await assert.rejects(seed([]), /already has users/);
});
