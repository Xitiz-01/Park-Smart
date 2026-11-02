const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { parseEnv } = require('../src/config/env');
const { mongoHosts, refusal } = require('../scripts/seed');
const { app: workerApp } = require('../worker');

const config = (env) =>
  parseEnv({
    NODE_ENV: 'development',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/parksmart',
    SEED_PASSWORD: 'local-seed-pass',
    ...env,
  });

test('seed reads every host from a mongodb:// URI', () => {
  assert.deepEqual(mongoHosts('mongodb://mongo:27017/parksmart?replicaSet=rs0'), ['mongo']);
  assert.deepEqual(mongoHosts('mongodb://user:pw@127.0.0.1:27018,localhost:27019/db'), ['127.0.0.1', 'localhost']);
  assert.deepEqual(mongoHosts('mongodb://[::1]:27017/db'), ['::1']);
  assert.equal(mongoHosts('mongodb+srv://cluster0.example.mongodb.net/db'), null);
});

test('seed runs only against a local database outside production', () => {
  assert.equal(refusal(config({})), null);
  assert.equal(refusal(config({ MONGODB_URI: 'mongodb://mongo:27017/parksmart?replicaSet=rs0' })), null);
  assert.match(
    refusal(config({ MONGODB_URI: 'mongodb+srv://cluster0.example.mongodb.net/db' })),
    /not a local MongoDB/,
  );
  assert.match(
    refusal(config({ MONGODB_URI: 'mongodb://127.0.0.1:27017,db.example.com:27017/x' })),
    /not a local MongoDB/,
  );
  assert.match(refusal(config({ SEED_PASSWORD: '' })), /SEED_PASSWORD/);
  assert.match(
    refusal(config({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'x'.repeat(32), ADDRESS_SELECTION_SECRET: 'y' })),
    /production/,
  );
});

test('the worker serves health only', async () => {
  await request(workerApp).get('/health/live').expect(200, { status: 'ok' });
  // No MongoDB connection in unit tests, so the worker isn't ready.
  const ready = await request(workerApp).get('/health/ready').expect(503);
  assert.deepEqual(ready.body.checks, { mongo: 'down' });
  await request(workerApp).get('/api/bookings').expect(404);
  const live = await request(workerApp).get('/health/live');
  assert.equal(live.headers['x-powered-by'], undefined);
});

test('the worker port defaults apart from the API port', () => {
  const parsed = config({});
  assert.equal(parsed.port, 5000);
  assert.equal(parsed.workerPort, 5002);
  assert.equal(config({ WORKER_PORT: '6001' }).workerPort, 6001);
});
