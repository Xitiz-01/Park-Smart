const test = require('node:test');
const assert = require('node:assert/strict');

const { createRedisClient, firstConnection, pingClient, closeClient } = require('../src/platform/redis');
const { createCache } = require('../src/platform/cache');
const { createLogger } = require('../src/platform/logger');

const REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6390';
// Nothing listens here, so it stands in for Redis being down.
const DOWN_URL = 'redis://127.0.0.1:1';
const silent = createLogger({ level: 'silent' });
const prefix = `pstest${process.pid}`;

let client;

test.before(async () => {
  client = createRedisClient(REDIS_URL, { logger: silent, name: 'parksmart-test' });
  await firstConnection(client, 5000);
  assert.equal(client.status, 'ready', `Redis must be running at ${REDIS_URL}`);
});

test.after(async () => {
  const keys = await client.keys(`${prefix}:*`);
  if (keys.length) await client.del(...keys);
  await closeClient(client);
});

test('the client answers PING and the cache stores JSON with a TTL', async () => {
  assert.equal(await pingClient(client), true);
  const cache = createCache({ redis: client, prefix, logger: silent });
  const key = cache.key('location', 'abc');
  assert.equal(await cache.set(key, { name: 'FC Road', bays: 6 }, 30), true);
  assert.deepEqual(await cache.get(key), { name: 'FC Road', bays: 6 });
  const ttl = await client.ttl(key);
  assert.ok(ttl > 0 && ttl <= 30, `TTL is ${ttl}`);
  assert.equal(await cache.del(key), 1);
  assert.equal(await client.exists(key), 0);
});

test('50 concurrent misses on real Redis run the loader once', async () => {
  const cache = createCache({ redis: client, prefix, logger: silent });
  const key = cache.key('vehicle-catalog', 'makes');
  let loads = 0;
  const loader = async () => {
    loads += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return ['Tata Motors'];
  };
  await Promise.all(Array.from({ length: 50 }, () => cache.wrap(key, 60, loader)));
  assert.equal(loads, 1);
  assert.deepEqual(JSON.parse(await client.get(key)), ['Tata Motors']);
});

test('with Redis down the cache fails open quickly and readiness reports it', async () => {
  const down = createRedisClient(DOWN_URL, { logger: silent, name: 'parksmart-down' });
  try {
    await firstConnection(down, 200);
    assert.equal(await pingClient(down), false);
    const cache = createCache({ redis: down, prefix, logger: silent });
    const started = Date.now();
    const value = await cache.wrap(cache.key('location', 'abc'), 60, async () => 'from mongo');
    assert.equal(value, 'from mongo');
    assert.ok(Date.now() - started < 500, 'no waiting on a dead connection');
    assert.ok(cache.stats().errors >= 2);
  } finally {
    await closeClient(down);
  }
});

test('closing a client makes it report down', async () => {
  const extra = createRedisClient(REDIS_URL, { logger: silent, name: 'parksmart-close' });
  await firstConnection(extra, 5000);
  assert.equal(await pingClient(extra), true);
  await closeClient(extra);
  assert.equal(extra.status, 'end');
  assert.equal(await pingClient(extra), false);
  await closeClient(extra);
});
