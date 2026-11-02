const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { parseEnv } = require('../src/config/env');
const { createLogger } = require('../src/platform/logger');
const express = require('express');
const { securityMiddleware, stripMongoOperators, AUTH_RATE_LIMITED_PATHS } = require('../src/platform/http/security');
const { errorHandler } = require('../src/platform/http/errorHandler');

const silent = createLogger({ level: 'silent' });
const appWith = (env = {}) => createApp({ config: parseEnv({ NODE_ENV: 'test', CORS_ORIGINS: 'https://app.example.com', ...env }), logger: silent });

test('security headers are set and the framework is not advertised', async () => {
  const response = await request(appWith()).get('/api');
  assert.equal(response.headers['x-powered-by'], undefined);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.ok(response.headers['content-security-policy']);
  assert.ok(response.headers['strict-transport-security']);
});

test('CORS allows only the configured origins', async () => {
  const app = appWith();
  const allowed = await request(app).get('/api').set('Origin', 'https://app.example.com');
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://app.example.com');
  assert.equal(allowed.headers['access-control-allow-credentials'], 'true');
  const blocked = await request(app).get('/api').set('Origin', 'https://evil.example.net');
  assert.equal(blocked.headers['access-control-allow-origin'], undefined);
});

test('the API rate limit answers 429 with the error envelope once spent', async () => {
  const app = appWith({ RATE_LIMIT_MAX: '2' });
  assert.equal((await request(app).get('/api')).status, 200);
  assert.equal((await request(app).get('/api')).status, 200);
  const limited = await request(app).get('/api');
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.ok(limited.headers.ratelimit, 'standard RateLimit header is sent');
});

test('sign-in and sign-up have their own, tighter limit', async () => {
  // Same paths and limiter app.js mounts, in front of a stub instead of
  // Better Auth, so the test needs no database.
  const { http } = parseEnv({ NODE_ENV: 'test', AUTH_RATE_LIMIT_MAX: '1' });
  const app = express();
  app.use(AUTH_RATE_LIMITED_PATHS, securityMiddleware(http).authRateLimit);
  app.all('/api/auth/*', (req, res) => res.json({ reached: 'auth' }));
  app.use(errorHandler);
  assert.equal((await request(app).post('/api/auth/sign-in/email')).status, 200);
  const limited = await request(app).post('/api/auth/sign-up/email');
  assert.equal(limited.status, 429);
  assert.match(limited.body.message, /sign-in attempts/);
  assert.equal((await request(app).get('/api/auth/get-session')).status, 200, 'session checks are not counted');
});

test('oversized JSON bodies are refused', async () => {
  const app = appWith({ JSON_BODY_LIMIT: '1kb' });
  const response = await request(app).post('/api/bookings').set('Content-Type', 'application/json').send(JSON.stringify({ note: 'x'.repeat(2048) }));
  assert.equal(response.status, 413);
  assert.equal(response.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('operator and dotted keys are removed from input at any depth', () => {
  const input = { email: 'a@example.com', password: { $ne: '' }, filters: [{ 'owner.role': 'admin', city: 'Pune' }], $where: 'sleep(1000)' };
  assert.deepEqual(stripMongoOperators(input), { email: 'a@example.com', password: {}, filters: [{ city: 'Pune' }] });
});

test('trust proxy follows the environment: one hop in production, loopback elsewhere', () => {
  const production = { NODE_ENV: 'production', MONGODB_URI: 'mongodb://db/x', BETTER_AUTH_SECRET: 'x'.repeat(32), ADDRESS_SELECTION_SECRET: 'y' };
  assert.equal(parseEnv(production).http.trustProxy, 1);
  assert.equal(parseEnv({ ...production, TRUST_PROXY: '2' }).http.trustProxy, 2);
  assert.equal(parseEnv({ NODE_ENV: 'test' }).http.trustProxy, 'loopback');
  assert.equal(parseEnv({ NODE_ENV: 'test', TRUST_PROXY: 'false' }).http.trustProxy, false);
});
