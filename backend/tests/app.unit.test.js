const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');

test('the app factory builds a working app without a server or database', async () => {
  const app = createApp({ allowedOrigins: ['http://localhost:3000'] });
  const root = await request(app).get('/');
  assert.equal(root.status, 200);
  assert.deepEqual(root.body, { message: 'Parking System API is running' });

  const api = await request(app).get('/api').set('Origin', 'http://localhost:3000');
  assert.equal(api.status, 200);
  assert.equal(api.headers['access-control-allow-origin'], 'http://localhost:3000');
});
