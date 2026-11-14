const test = require('node:test');
const assert = require('node:assert/strict');

const TEST_DB_NAME = 'parksmart-clerk-test';
const mongoBase = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27028';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = `${mongoBase.replace(/\/$/, '')}/${TEST_DB_NAME}`;
process.env.BETTER_AUTH_SECRET = 'parksmart-better-auth-test-secret-32-characters-minimum';

const mongoose = require('mongoose');
const request = require('supertest');
const { parseEnv } = require('../src/config/env');
const { createApp } = require('../src/app');
const { createFakeAuthProvider } = require('../src/platform/auth/providers');
const { closeBetterAuth } = require('../auth/betterAuthBridge');
const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const { SIGNING_SECRET, clerkUser } = require('./helpers/clerk');

const config = parseEnv({
  NODE_ENV: 'test',
  MONGODB_URI: process.env.MONGODB_URI,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  CLERK_ENABLED: 'true',
  AUTH_PROVIDER: 'fake',
  CLERK_WEBHOOK_SIGNING_SECRET: SIGNING_SECRET,
});
const healthChecks = { mongo: async () => true };

let fake;
let app;

const profile = (token) => request(app).get('/api/v1/account/profile').set('Authorization', `Bearer ${token}`);

test.before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await mongoose.connection.syncIndexes();
});

test.beforeEach(async () => {
  await Promise.all([User.deleteMany({}), VendorProfile.deleteMany({})]);
  fake = createFakeAuthProvider({ nodeEnv: 'test', webhookSigningSecret: SIGNING_SECRET });
  app = createApp({ config, healthChecks, redis: null, authProvider: fake });
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await closeBetterAuth();
});

test('a first request with a Clerk token provisions a customer and mirrors the role to Clerk', async () => {
  fake.addUser(clerkUser('user_new', { intendedRole: 'customer' }));
  const response = await profile(fake.signIn('user_new'));
  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, 'user_new@example.com');
  assert.equal(response.body.user.role, 'customer');

  const user = await User.findOne({ clerkId: 'user_new' }).lean();
  assert.equal(user.name, 'Test user_new');
  assert.equal(user.emailVerified, true);
  assert.deepEqual(user.onboarding, { intendedRole: 'customer', state: 'complete' });
  assert.equal(user.phone, undefined, 'Clerk sign-ups may have no phone yet');
  assert.deepEqual(fake.metadataUpdates, [
    { userId: 'user_new', publicMetadata: { role: 'customer', onboardingState: 'complete', intendedRole: 'customer' } },
  ]);

  // Later requests read MongoDB only; nothing new is mirrored.
  assert.equal((await profile(fake.signIn('user_new'))).status, 200);
  assert.equal(fake.metadataUpdates.length, 1);
});
test('intendedRole=admin is ignored; a vendor sign-up starts as an applicant, not a vendor', async () => {
  fake.addUser(clerkUser('user_sneaky', { intendedRole: 'admin' }));
  fake.addUser(clerkUser('user_operator', { intendedRole: 'vendor' }));

  assert.equal((await profile(fake.signIn('user_sneaky'))).body.user.role, 'customer');
  const sneaky = await User.findOne({ clerkId: 'user_sneaky' }).lean();
  assert.deepEqual(sneaky.onboarding, { intendedRole: 'customer', state: 'complete' });

  const operatorToken = fake.signIn('user_operator');
  assert.equal((await profile(operatorToken)).body.user.role, 'customer');
  const operator = await User.findOne({ clerkId: 'user_operator' }).lean();
  assert.deepEqual(operator.onboarding, { intendedRole: 'vendor', state: 'vendor_applicant' });
  assert.deepEqual(fake.metadataUpdates.at(-1).publicMetadata, {
    role: 'customer',
    onboardingState: 'vendor_applicant',
    intendedRole: 'vendor',
  });
  // Vendor tools still need an approved vendor, exactly as before.
  const dashboard = await request(app).get('/api/v1/vendors/dashboard').set('Authorization', `Bearer ${operatorToken}`);
  assert.equal(dashboard.status, 403);
});
test('simultaneous first requests create exactly one user', async () => {
  fake.addUser(clerkUser('user_race'));
  const tokens = Array.from({ length: 12 }, () => fake.signIn('user_race'));
  const responses = await Promise.all(tokens.map(profile));
  assert.deepEqual(
    responses.map((response) => response.status),
    tokens.map(() => 200),
  );
  assert.equal(await User.countDocuments({ clerkId: 'user_race' }), 1);
  assert.equal(new Set(responses.map((response) => response.body.user._id || response.body.user.id)).size, 1);
});
test('an existing account is linked by verified email and keeps its role; an unverified email is refused', async () => {
  await User.create({
    authUserId: 'ba_admin',
    name: 'Admin',
    email: 'admin@example.com',
    phone: '9800000000',
    role: 'admin',
  });
  fake.addUser(clerkUser('user_admin', { email: 'Admin@Example.com', intendedRole: 'customer' }));
  const linked = await profile(fake.signIn('user_admin'));
  assert.equal(linked.status, 200);
  assert.equal(linked.body.user.role, 'admin');
  const admin = await User.findOne({ email: 'admin@example.com' }).lean();
  assert.equal(admin.clerkId, 'user_admin');
  assert.equal(admin.authUserId, 'ba_admin', 'the Better Auth link stays until Better Auth is removed');
  assert.equal(fake.metadataUpdates.at(-1).publicMetadata.role, 'admin');

  await User.create({ name: 'Cara', email: 'cara@example.com', phone: '9800000001' });
  fake.addUser(clerkUser('user_cara', { email: 'cara@example.com', verified: false }));
  const refused = await profile(fake.signIn('user_cara'));
  assert.equal(refused.status, 403);
  assert.match(refused.body.message, /verify your email/i);
  assert.equal((await User.findOne({ email: 'cara@example.com' }).lean()).clerkId, undefined);

  // One account can't be claimed by a second Clerk user.
  fake.addUser(clerkUser('user_admin_2', { email: 'admin@example.com' }));
  assert.equal((await profile(fake.signIn('user_admin_2'))).status, 403);
});
test('suspended accounts are refused; bad or missing tokens are 401 and never fall back to cookies', async () => {
  fake.addUser(clerkUser('user_suspended'));
  const token = fake.signIn('user_suspended');
  assert.equal((await profile(token)).status, 200);
  await User.updateOne({ clerkId: 'user_suspended' }, { isActive: false });
  assert.equal((await profile(token)).status, 403);

  assert.equal((await request(app).get('/api/v1/account/profile')).status, 401);
  assert.equal((await profile('fake_not-issued')).status, 401);
  assert.equal((await profile(fake.signIn('user_suspended', { pending: true }))).status, 401);
});
test('with Clerk switched off, a Bearer token is ignored and Better Auth decides as before', async () => {
  fake.addUser(clerkUser('user_off'));
  const token = fake.signIn('user_off');
  const off = createApp({
    config: parseEnv({ NODE_ENV: 'test', MONGODB_URI: process.env.MONGODB_URI }),
    healthChecks,
    redis: null,
  });
  const response = await request(off).get('/api/v1/account/profile').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 401);
  assert.equal(await User.countDocuments({ clerkId: 'user_off' }), 0);
});
test('a lookup failure at Clerk is a 503, and a user Clerk no longer has is signed out', async () => {
  fake.addUser(clerkUser('user_flaky'));
  const token = fake.signIn('user_flaky');
  fake.getUser = async () => {
    throw Object.assign(new Error('Clerk is down'), { status: 502 });
  };
  const down = await profile(token);
  assert.equal(down.status, 503);
  assert.equal(down.body.error.code, 'SERVICE_UNAVAILABLE');
  fake.getUser = async () => {
    throw Object.assign(new Error('Not found'), { status: 404 });
  };
  assert.equal((await profile(token)).status, 401);
});
