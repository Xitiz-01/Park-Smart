const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { parseEnv } = require('../src/config/env');
const { createLogger } = require('../src/platform/logger');
const { deprecatedUsage } = require('../src/platform/http/versioning');
const { buildOpenApiDocument } = require('../src/platform/openapi');

const silent = createLogger({ level: 'silent' });
const testApp = () => createApp({ config: parseEnv({ NODE_ENV: 'test' }), logger: silent });

// /api/slots/a/b matches no route, so it reaches the 404 without touching
// auth or the database, but still passes through the mount.
test('/api/v1 routes are current; /api routes still work but are marked deprecated', async () => {
  const app = testApp();
  const current = await request(app).get('/api/v1/slots/a/b');
  assert.equal(current.status, 404);
  assert.equal(current.headers.deprecation, undefined);

  const before = deprecatedUsage()['/api/slots'] || 0;
  const legacy = await request(app).get('/api/slots/a/b');
  assert.equal(legacy.status, 404);
  assert.equal(legacy.headers.deprecation, 'true');
  assert.equal(legacy.headers.link, '</api/v1/slots/a/b>; rel="successor-version"');
  assert.equal(deprecatedUsage()['/api/slots'], before + 1, 'each legacy use is counted');
});

test('the OpenAPI document is generated from the request schemas', () => {
  const doc = buildOpenApiDocument();
  assert.equal(doc.openapi, '3.1.0');
  const createBooking = doc.paths['/api/v1/bookings'].post;
  const schema = createBooking.requestBody.content['application/json'].schema;
  assert.deepEqual(schema.required, ['vehicleId']);
  assert.deepEqual(schema.properties.bookingType.enum, ['ev', 'regular']);
  const cancel = doc.paths['/api/v1/bookings/{id}/cancel'].put;
  assert.deepEqual(cancel.parameters.map((p) => [p.name, p.in, p.required]), [['id', 'path', true]]);
  const upload = doc.paths['/api/v1/vendor-verification/documents'].post.requestBody.content['multipart/form-data'].schema;
  assert.equal(upload.properties.document.format, 'binary');
  assert.deepEqual(doc.paths['/health/live'].get.security, [], 'health needs no session');
  assert.ok(doc.components.schemas.ErrorEnvelope);
  const ids = Object.values(doc.paths).flatMap((item) => Object.values(item).map((op) => op.operationId));
  assert.equal(new Set(ids).size, ids.length, 'operation ids are unique');
  assert.equal(doc.paths['/api/v1/vendors/parking-locations/{id}/slots'].post.operationId, 'postVendorsParkingLocationsByIdSlots');
});

test('the docs are served outside production only', async () => {
  const served = await request(testApp()).get('/api/docs');
  assert.equal(served.status, 200);
  assert.equal(served.body.info.title, 'ParkSmart API');

  const production = parseEnv({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://db/x', BETTER_AUTH_SECRET: 'x'.repeat(32), ADDRESS_SELECTION_SECRET: 'y' });
  const hidden = await request(createApp({ config: production, logger: silent })).get('/api/docs');
  assert.equal(hidden.status, 404);
});
