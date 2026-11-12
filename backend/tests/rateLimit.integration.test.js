const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { parseEnv } = require('../src/config/env');
const { createLogger } = require('../src/platform/logger');
const { createRedisClient, firstConnection, closeClient } = require('../src/platform/redis');

const REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6390';
const silent = createLogger({ level: 'silent' });
const clients = [];

const client = async (url = REDIS_URL, wait = 5000) => {
  const redis = createRedisClient(url, { logger: silent, name: 'parksmart-rate-limit-test' });
  clients.push(redis);
  await firstConnection(redis, wait);
  return redis;
};

const appFor = (redis, keyPrefix, logger = silent) =>
  createApp({
    config: parseEnv({ NODE_ENV: 'test', RATE_LIMIT_MAX: '3', REDIS_KEY_PREFIX: keyPrefix }),
    logger,
    healthChecks: { mongo: async () => true },
    redis,
  });

test.after(async () => {
  const [first] = clients;
  const keys = await first.keys('rltest*');
  if (keys.length) await first.del(...keys);
  await Promise.all(clients.map(closeClient));
});

test('two instances sharing Redis share one budget', async () => {
  const prefix = `rltest${process.pid}a`;
  const a = appFor(await client(), prefix);
  const b = appFor(await client(), prefix);

  const statuses = [];
  for (const app of [a, b, a]) statuses.push((await request(app).get('/api')).status);
  assert.deepEqual(statuses, [200, 200, 200]);

  const limited = await request(b).get('/api');
  assert.equal(limited.status, 429, 'the fourth request is over the limit on either instance');
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.match(limited.headers['ratelimit-policy'], /q=3; w=900/);

  const [key] = await clients[0].keys(`${prefix}:v1:rate-limit:api:*`);
  assert.ok(key, 'counted under <prefix>:v1:rate-limit:api:<ip>');
  assert.equal(await clients[0].get(key), '4');
});

test('with Redis down, requests pass and one alert is logged', async () => {
  const lines = [];
  const logger = createLogger({ level: 'error' }, { write: (line) => lines.push(JSON.parse(line)) });
  const app = appFor(await client('redis://127.0.0.1:1', 200), `rltest${process.pid}b`, logger);

  const started = Date.now();
  for (let i = 0; i < 5; i += 1) assert.equal((await request(app).get('/api')).status, 200);
  assert.ok(Date.now() - started < 1000, 'only the first command waits for a connection');
  const alerts = lines.filter((line) => line.alert === 'rate-limit-store');
  assert.equal(alerts.length, 1, 'later failures are counted, not logged');
});
