const test = require('node:test');
const assert = require('node:assert/strict');

const TEST_DB_NAME = 'parksmart-clerk-webhook-test';
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
const ClerkWebhookEvent = require('../models/ClerkWebhookEvent');
const { SIGNING_SECRET, clerkUser, event, signedDelivery, webhookUser } = require('./helpers/clerk');

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

const deliver = (delivery, target = app) => {
  let call = request(target).post('/api/v1/webhooks/clerk');
  for (const [name, value] of Object.entries(delivery.headers)) call = call.set(name, value);
  return call.send(delivery.body);
};

test.before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await mongoose.connection.syncIndexes();
});

test.beforeEach(async () => {
  await Promise.all([User.deleteMany({}), ClerkWebhookEvent.deleteMany({})]);
  fake = createFakeAuthProvider({ nodeEnv: 'test', webhookSigningSecret: SIGNING_SECRET });
  app = createApp({ config, healthChecks, redis: null, authProvider: fake });
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await closeBetterAuth();
});

test('webhook: answers 503 while Clerk is off or has no signing secret', async () => {
  const delivery = signedDelivery(event('user.created', webhookUser(clerkUser('user_off'))));
  const off = createApp({
    config: parseEnv({ NODE_ENV: 'test', MONGODB_URI: process.env.MONGODB_URI }),
    healthChecks,
    redis: null,
  });
  assert.equal((await deliver(delivery, off)).status, 503);
  const noSecret = createApp({
    config: parseEnv({
      NODE_ENV: 'test',
      MONGODB_URI: process.env.MONGODB_URI,
      CLERK_ENABLED: 'true',
      AUTH_PROVIDER: 'fake',
    }),
    healthChecks,
    redis: null,
    authProvider: fake,
  });
  assert.equal((await deliver(delivery, noSecret)).status, 503);
  assert.equal(await User.countDocuments({ clerkId: 'user_off' }), 0);
});

test('webhook: user.created provisions once per delivery id; bad signatures and replays are rejected', async () => {
  const raw = clerkUser('user_hook', { intendedRole: 'vendor', updatedAt: 2000 });
  const delivery = signedDelivery(event('user.created', webhookUser(raw)), { id: 'msg_created' });

  const first = await deliver(delivery);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { received: true });
  const user = await User.findOne({ clerkId: 'user_hook' }).lean();
  assert.deepEqual(user.onboarding, { intendedRole: 'vendor', state: 'vendor_applicant' });
  assert.equal(user.clerkUpdatedAt.getTime(), 2000);

  const again = await deliver(delivery);
  assert.deepEqual(again.body, { received: true, duplicate: true });
  assert.equal(fake.metadataUpdates.length, 1, 'a repeated delivery is not applied again');
  assert.equal(await ClerkWebhookEvent.countDocuments({ svixId: 'msg_created' }), 1);

  const tampered = signedDelivery(event('user.created', webhookUser(raw)), { id: 'msg_tampered' });
  tampered.body = tampered.body.replace('vendor', 'admin');
  assert.equal((await deliver(tampered)).status, 400);

  const wrongKey = signedDelivery(event('user.created', webhookUser(raw)), {
    secret: `whsec_${Buffer.from('another-key').toString('base64')}`,
  });
  assert.equal((await deliver(wrongKey)).status, 400);

  const stale = signedDelivery(event('user.created', webhookUser(raw)), {
    id: 'msg_replayed',
    timestamp: Math.floor(Date.now() / 1000) - 10 * 60,
  });
  assert.equal((await deliver(stale)).status, 400, 'a delivery older than five minutes is a replay');
  assert.equal(await ClerkWebhookEvent.countDocuments({ svixId: 'msg_replayed' }), 0);

  const unsigned = await request(app)
    .post('/api/v1/webhooks/clerk')
    .set('content-type', 'application/json')
    .send(delivery.body);
  assert.equal(unsigned.status, 400);
});
test('webhook: updates apply in Clerk order, deletes deactivate for good, other events are acknowledged', async () => {
  const created = clerkUser('user_order', { updatedAt: 1000 });
  await deliver(signedDelivery(event('user.created', webhookUser(created))));

  const newer = clerkUser('user_order', { email: 'renamed@example.com', updatedAt: 3000, firstName: 'New' });
  const older = clerkUser('user_order', { email: 'older@example.com', updatedAt: 2000, firstName: 'Old' });
  assert.equal((await deliver(signedDelivery(event('user.updated', webhookUser(newer))))).status, 200);
  assert.equal((await deliver(signedDelivery(event('user.updated', webhookUser(older))))).status, 200);
  let user = await User.findOne({ clerkId: 'user_order' }).lean();
  assert.equal(user.email, 'renamed@example.com', 'an older update arriving late changes nothing');
  assert.equal(user.name, 'New user_order');
  assert.equal(user.role, 'customer', 'updates never touch the role');

  const deletedAt = Date.now();
  const deletion = await deliver(
    signedDelivery(event('user.deleted', { id: 'user_order', deleted: true, object: 'user' }, deletedAt)),
  );
  assert.equal(deletion.status, 200);
  user = await User.findOne({ clerkId: 'user_order' }).lean();
  assert.equal(user.isActive, false);
  assert.equal(user.clerkDeletedAt.getTime(), deletedAt);

  const late = clerkUser('user_order', { email: 'late@example.com', updatedAt: 9000 });
  await deliver(signedDelivery(event('user.updated', webhookUser(late))));
  user = await User.findOne({ clerkId: 'user_order' }).lean();
  assert.equal(user.isActive, false);
  assert.equal(user.email, 'renamed@example.com');

  const session = await deliver(signedDelivery(event('session.created', { id: 'sess_1' })));
  assert.deepEqual(session.body, { received: true, ignored: 'session.created' });
});
test('webhook: an identity conflict is acknowledged so Svix stops retrying; other failures are retried', async () => {
  await User.create({ name: 'Dev', email: 'dev@example.com', phone: '9800000002' });
  const conflict = await deliver(
    signedDelivery(
      event('user.created', webhookUser(clerkUser('user_dev', { email: 'dev@example.com', verified: false }))),
    ),
  );
  assert.deepEqual(conflict.body, { received: true, skipped: true });

  const failing = signedDelivery(event('user.created', webhookUser(clerkUser('user_fail'))), { id: 'msg_fail' });
  fake.updatePublicMetadata = async () => {};
  const original = User.findOneAndUpdate;
  User.findOneAndUpdate = () => {
    throw new Error('database unavailable');
  };
  try {
    assert.equal((await deliver(failing)).status, 500);
  } finally {
    User.findOneAndUpdate = original;
  }
  assert.equal(await ClerkWebhookEvent.countDocuments({ svixId: 'msg_fail' }), 0, 'the retry is applied');
  assert.equal((await deliver(failing)).status, 200);
  assert.equal(await User.countDocuments({ clerkId: 'user_fail' }), 1);
});
