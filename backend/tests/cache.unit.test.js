const test = require('node:test');
const assert = require('node:assert/strict');

const { createCache } = require('../src/platform/cache');
const { createLogger } = require('../src/platform/logger');

const silent = createLogger({ level: 'silent' });

/** An in-memory stand-in for the ioredis calls the cache makes. */
function fakeRedis() {
  const store = new Map();
  const calls = { get: 0, set: 0, del: 0 };
  return {
    store,
    calls,
    async get(key) {
      calls.get += 1;
      return store.has(key) ? store.get(key).value : null;
    },
    async set(key, value, mode, ttl) {
      calls.set += 1;
      assert.equal(mode, 'EX');
      store.set(key, { value, ttl });
      return 'OK';
    },
    async del(...keys) {
      calls.del += 1;
      return keys.filter((key) => store.delete(key)).length;
    },
  };
}

/** A client whose every command fails, like ioredis with Redis down. */
const brokenRedis = () => {
  const fail = async () => {
    throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
  };
  return { get: fail, set: fail, del: fail };
};

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('keys follow <prefix>:v<version>:<domain>:<id>', () => {
  const cache = createCache({ redis: null, prefix: 'ps', logger: silent });
  assert.equal(cache.key('vehicle-catalog', 'makes'), 'ps:v1:vehicle-catalog:makes');
  assert.equal(cache.key('location', '6ae7727f', 'detail', { version: 3 }), 'ps:v3:location:6ae7727f:detail');
  assert.equal(cache.key('discovery', 18.52, 73.84), 'ps:v1:discovery:18.52:73.84');
  assert.throws(() => cache.key('Vehicle', 'x'), /domain/);
  assert.throws(() => cache.key('vehicle'), /at least one id/);
  assert.throws(() => cache.key('vehicle', 'a b'), /segment "a b"/);
  assert.throws(() => cache.key('vehicle', 'a:b'), /segment/);
  assert.throws(() => cache.key('vehicle', 'x', { version: 0 }), /version/);
});

test('get, set and del round-trip JSON with a TTL', async () => {
  const redis = fakeRedis();
  const cache = createCache({ redis, logger: silent });
  const key = cache.key('location', 'abc');
  assert.equal(await cache.get(key), undefined);
  assert.equal(await cache.set(key, { name: 'FC Road', evBays: 6, tags: ['covered'] }, 60), true);
  assert.equal(redis.store.get(key).ttl, 60);
  assert.deepEqual(await cache.get(key), { name: 'FC Road', evBays: 6, tags: ['covered'] });
  assert.equal(await cache.del(key), 1);
  assert.equal(await cache.get(key), undefined);
  assert.deepEqual(cache.stats(), { enabled: true, hits: 1, misses: 2, sets: 1, errors: 0, loads: 0, sharedLoads: 0 });
  await assert.rejects(cache.set(key, 1, 0), /TTL/);
  await assert.rejects(cache.set(key, 1, 1.5), /TTL/);
  await assert.rejects(cache.set(key, undefined, 10), /undefined/);
});

test('wrap loads once for 50 concurrent misses (single flight), then serves from cache', async () => {
  const redis = fakeRedis();
  const cache = createCache({ redis, logger: silent });
  const key = cache.key('vehicle-catalog', 'makes');
  let loads = 0;
  const loader = async () => {
    loads += 1;
    await tick();
    return ['Tata Motors', 'Maruti Suzuki'];
  };

  const results = await Promise.all(Array.from({ length: 50 }, () => cache.wrap(key, 300, loader)));
  assert.equal(loads, 1);
  assert.equal(redis.calls.get, 1, 'one lookup for the whole burst');
  assert.ok(results.every((value) => value.length === 2));
  assert.equal(cache.stats().sharedLoads, 49);

  assert.deepEqual(await cache.wrap(key, 300, loader), ['Tata Motors', 'Maruti Suzuki']);
  assert.equal(loads, 1, 'second call is a hit');
});

test('wrap does not cache loader errors or undefined', async () => {
  const redis = fakeRedis();
  const cache = createCache({ redis, logger: silent });
  const key = cache.key('location', 'missing');

  await assert.rejects(
    cache.wrap(key, 60, async () => {
      throw new Error('MongoDB timed out');
    }),
    /MongoDB timed out/,
  );
  assert.equal(redis.store.size, 0);
  assert.equal(await cache.wrap(key, 60, async () => 'recovered'), 'recovered');

  const other = cache.key('location', 'nothing');
  assert.equal(await cache.wrap(other, 60, async () => undefined), undefined);
  assert.equal(redis.store.has(other), false);
});

test('Redis failures fail open: the loader answers, errors are counted and logged once', async () => {
  const lines = [];
  const logger = createLogger({ level: 'warn' }, { write: (line) => lines.push(JSON.parse(line)) });
  const cache = createCache({ redis: brokenRedis(), logger });
  const key = cache.key('location', 'abc');
  let loads = 0;

  for (let i = 0; i < 3; i += 1) {
    assert.equal(await cache.wrap(key, 60, async () => ++loads), loads);
  }
  assert.equal(loads, 3);
  assert.equal(await cache.del(key), 0);
  const stats = cache.stats();
  assert.equal(stats.errors, 7, '3 gets + 3 sets + 1 del');
  assert.equal(stats.hits, 0);
  assert.equal(lines.filter((line) => line.msg.startsWith('cache unavailable')).length, 1);
});

test('the cache logs when Redis comes back', async () => {
  const lines = [];
  const logger = createLogger({ level: 'info' }, { write: (line) => lines.push(JSON.parse(line)) });
  const redis = fakeRedis();
  const realGet = redis.get;
  redis.get = brokenRedis().get;
  const cache = createCache({ redis, logger });
  const key = cache.key('location', 'abc');
  await cache.get(key);
  redis.get = realGet;
  await cache.get(key);
  assert.deepEqual(
    lines.map((line) => line.msg),
    ['cache unavailable; falling back to the source', 'cache available again'],
  );
});

test('an unreadable entry is a miss and is removed', async () => {
  const redis = fakeRedis();
  const cache = createCache({ redis, logger: silent });
  const key = cache.key('location', 'abc');
  redis.store.set(key, { value: '{not json', ttl: 60 });
  assert.equal(await cache.get(key), undefined);
  await tick();
  assert.equal(redis.store.has(key), false);
  assert.equal(cache.stats().errors, 1);
});

test('without Redis every read is a miss, but loads are still shared', async () => {
  const cache = createCache({ redis: null, logger: silent });
  const key = cache.key('vehicle-catalog', 'makes');
  let loads = 0;
  const loader = async () => {
    loads += 1;
    await tick();
    return 'value';
  };
  await Promise.all([cache.wrap(key, 60, loader), cache.wrap(key, 60, loader)]);
  assert.equal(loads, 1);
  assert.equal(await cache.wrap(key, 60, loader), 'value');
  assert.equal(loads, 2, 'nothing is stored without Redis');
  assert.equal(await cache.set(key, 'x', 60), false);
  assert.equal(await cache.del(key), 0);
  assert.equal(cache.stats().enabled, false);
});

test('the metrics hook sees each event with its key family, and its errors are contained', async () => {
  const events = [];
  const cache = createCache({
    redis: fakeRedis(),
    logger: silent,
    onEvent: (event, { domain }) => {
      events.push(`${event}:${domain}`);
      if (event === 'hit') throw new Error('metrics backend down');
    },
  });
  const key = cache.key('vehicle-catalog', 'makes');
  await cache.wrap(key, 60, async () => 1);
  assert.equal(await cache.wrap(key, 60, async () => 2), 1);
  assert.deepEqual(events, [
    'miss:vehicle-catalog',
    'load:vehicle-catalog',
    'set:vehicle-catalog',
    'hit:vehicle-catalog',
  ]);
});
