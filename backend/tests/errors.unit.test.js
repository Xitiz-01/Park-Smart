const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const request = require('supertest');

const { NotFoundError, ConflictError, ValidationError } = require('../src/platform/errors');
const { describeError, errorHandler } = require('../src/platform/http/errorHandler');
const { forwardAsyncErrors } = require('../src/platform/http/asyncRoutes');
const { requestLogger } = require('../src/platform/http/requestLogging');
const { createLogger } = require('../src/platform/logger');
const { createApp } = require('../src/app');

const silent = createLogger({ level: 'silent' });

test('known errors map to stable codes and client-safe messages', () => {
  const zodError = z.object({ plate: z.string() }).safeParse({}).error;
  const castError = new mongoose.Error.CastError('ObjectId', 'nope', '_id');
  const invalidDoc = new mongoose.Document({}, new mongoose.Schema({ name: { type: String, required: true } })).validateSync();
  let expired;
  try { jwt.verify(jwt.sign({}, 's', { expiresIn: -1 }), 's'); } catch (error) { expired = error; }

  const cases = [
    [new NotFoundError('Booking not found'), 404, 'NOT_FOUND', 'Booking not found'],
    [new ConflictError('Slot already taken', { details: { slotId: 'A1' } }), 409, 'CONFLICT', 'Slot already taken'],
    [zodError, 400, 'VALIDATION_FAILED', 'The request is not valid'],
    [invalidDoc, 400, 'VALIDATION_FAILED', 'The request is not valid'],
    [castError, 400, 'INVALID_ID', 'Invalid _id'],
    [Object.assign(new Error('E11000'), { code: 11000, keyPattern: { email: 1 } }), 409, 'DUPLICATE', 'A record with these details already exists'],
    [expired, 401, 'TOKEN_EXPIRED', 'This link or token has expired'],
    [Object.assign(new Error('jwt malformed'), { name: 'JsonWebTokenError' }), 401, 'INVALID_TOKEN', 'This link or token is not valid'],
    [Object.assign(new Error('File too large'), { name: 'MulterError', code: 'LIMIT_FILE_SIZE' }), 413, 'FILE_TOO_LARGE', 'Document must be 5 MB or smaller'],
    [Object.assign(new Error('Unexpected field'), { name: 'MulterError', code: 'LIMIT_UNEXPECTED_FILE' }), 400, 'UPLOAD_REJECTED', 'Unexpected field'],
    [Object.assign(new Error('Geocoding is not configured'), { statusCode: 503 }), 503, 'SERVICE_UNAVAILABLE', 'Geocoding is not configured'],
    [new Error('connection string mongodb://user:pass@host leaked'), 500, 'INTERNAL_ERROR', 'Internal Server Error'],
  ];
  for (const [error, status, code, message] of cases) {
    const described = describeError(error);
    assert.deepEqual([described.status, described.code, described.message], [status, code, message], `${error.name}: ${error.message}`);
  }
  assert.deepEqual(describeError(zodError).details, [{ path: 'plate', message: 'Invalid input: expected string, received undefined' }]);
  assert.deepEqual(describeError(cases[5][0]).details, { fields: ['email'] });
});

test('errors reach the client as one envelope with the request id, never a stack', async () => {
  const app = express();
  app.use(requestLogger(silent), express.json());
  const router = express.Router();
  router.get('/missing', () => { throw new NotFoundError('Booking not found'); });
  router.get('/async-crash', async () => { throw new Error('secret internals'); });
  router.post('/validate', async () => { throw new ValidationError('Check the form', { details: [{ path: 'plate', message: 'Required' }] }); });
  app.use('/api', forwardAsyncErrors(router));
  app.use(errorHandler);

  const missing = await request(app).get('/api/missing');
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, {
    success: false,
    message: 'Booking not found',
    error: { code: 'NOT_FOUND', message: 'Booking not found', requestId: missing.headers['x-request-id'] },
  });

  const crash = await request(app).get('/api/async-crash');
  assert.equal(crash.status, 500, 'a rejected async handler becomes a 500, not a crash');
  assert.equal(crash.body.error.code, 'INTERNAL_ERROR');
  assert.equal(JSON.stringify(crash.body).includes('secret internals'), false);
  assert.equal('stack' in crash.body, false);

  const invalid = await request(app).post('/api/validate').send({});
  assert.deepEqual(invalid.body.error.details, [{ path: 'plate', message: 'Required' }]);

  const badJson = await request(app).post('/api/validate').set('Content-Type', 'application/json').send('{"plate":');
  assert.equal(badJson.status, 400);
  assert.equal(badJson.body.error.code, 'INVALID_JSON');
});

test('async errors are forwarded from routers nested inside routers', async () => {
  const inner = express.Router();
  inner.get('/deep', async () => { throw new ConflictError('Already booked'); });
  const outer = express.Router();
  outer.use((req, res, next) => next());
  outer.use('/inner', inner);
  const app = express();
  app.use('/api', forwardAsyncErrors(outer));
  app.use(errorHandler);
  const response = await request(app).get('/api/inner/deep');
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CONFLICT');
});

test('unknown API routes get a JSON 404', async () => {
  const app = createApp({ logger: silent });
  const response = await request(app).get('/api/no-such-thing');
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
  assert.equal(response.body.error.requestId, response.headers['x-request-id']);
});
