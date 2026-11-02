const { getConfig } = require('../../config/env');
const { logger: defaultLogger } = require('../logger');
const { getRedis } = require('../redis');

const SEGMENT = /^[A-Za-z0-9_.@-]+$/;
const DOMAIN = /^[a-z0-9-]+$/;

/** JSON in, JSON out. Dates come back as ISO strings; undefined isn't cacheable. */
const serialize = (value) => {
  if (value === undefined) throw new TypeError('undefined cannot be cached');
  return JSON.stringify(value);
};
const deserialize = (text) => JSON.parse(text);

/**
 * A cache-aside helper over Redis.
 *
 * Keys follow `<prefix>:v<version>:<domain>:<id...>` (for example
 * `ps:v1:vehicle-catalog:makes`). Bump the version when a cached shape
 * changes, so old entries are simply never read again and expire.
 *
 * Failure policy: the cache fails OPEN. When Redis is unset, down or slow,
 * reads are misses and writes are skipped, and the loader (MongoDB) answers.
 * Each failure is counted; the first after a healthy period is logged.
 * Never use this for anything that must be correct (locks, idempotency,
 * money): those need Redis or MongoDB to succeed, not a fallback.
 *
 * @param {{
 *   redis: import('ioredis').Redis | null,
 *   prefix?: string,
 *   logger?: import('pino').Logger,
 *   onEvent?: (event: 'hit'|'miss'|'set'|'error'|'load', detail: { domain: string, key: string }) => void,
 * }} options onEvent is the metrics hook (counters per key family, Phase 9).
 */
function createCache({ redis, prefix = 'ps', logger = defaultLogger, onEvent = () => {} }) {
  const counts = { hits: 0, misses: 0, sets: 0, errors: 0, loads: 0, sharedLoads: 0 };
  const inFlight = new Map();
  let failing = false;

  const domainOf = (key) => key.split(':')[2] ?? 'unknown';
  const emit = (event, key) => {
    try {
      onEvent(event, { domain: domainOf(key), key });
    } catch (error) {
      logger.warn({ err: error }, 'cache metrics hook failed');
    }
  };
  const failed = (error, key, operation) => {
    counts.errors += 1;
    emit('error', key);
    if (!failing) logger.warn({ err: error, key, operation }, 'cache unavailable; falling back to the source');
    failing = true;
  };
  const succeeded = () => {
    if (failing) logger.info('cache available again');
    failing = false;
  };

  /**
   * @param {string} domain lowercase key family, e.g. "vehicle-catalog"
   * @param {...(string|number)} id one or more segments
   * @param {{ version?: number }} [options] pass last
   */
  function key(domain, ...rest) {
    const options = rest.length && typeof rest[rest.length - 1] === 'object' ? rest.pop() : {};
    const version = options.version ?? 1;
    if (!DOMAIN.test(domain))
      throw new TypeError(`cache domain "${domain}" must be lowercase letters, digits or dashes`);
    if (!Number.isInteger(version) || version < 1) throw new TypeError('cache key version must be a positive integer');
    if (!rest.length) throw new TypeError('a cache key needs at least one id segment');
    const segments = rest.map(String);
    const bad = segments.find((segment) => !SEGMENT.test(segment));
    if (bad !== undefined) throw new TypeError(`cache key segment "${bad}" has characters outside [A-Za-z0-9_.@-]`);
    return [prefix, `v${version}`, domain, ...segments].join(':');
  }

  /** The cached value, or undefined on a miss or any failure. */
  async function get(cacheKey) {
    if (!redis) {
      counts.misses += 1;
      emit('miss', cacheKey);
      return undefined;
    }
    let text;
    try {
      text = await redis.get(cacheKey);
      succeeded();
    } catch (error) {
      failed(error, cacheKey, 'get');
      counts.misses += 1;
      emit('miss', cacheKey);
      return undefined;
    }
    if (text === null) {
      counts.misses += 1;
      emit('miss', cacheKey);
      return undefined;
    }
    try {
      const value = deserialize(text);
      counts.hits += 1;
      emit('hit', cacheKey);
      return value;
    } catch (error) {
      // Unreadable entry: drop it and treat as a miss.
      failed(error, cacheKey, 'parse');
      redis.del(cacheKey).catch(() => {});
      counts.misses += 1;
      emit('miss', cacheKey);
      return undefined;
    }
  }

  /** Store value for ttlSeconds. Failures are swallowed (and counted). */
  async function set(cacheKey, value, ttlSeconds) {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1)
      throw new TypeError('cache TTL must be a positive whole number of seconds');
    const text = serialize(value);
    if (!redis) return false;
    try {
      await redis.set(cacheKey, text, 'EX', ttlSeconds);
      succeeded();
      counts.sets += 1;
      emit('set', cacheKey);
      return true;
    } catch (error) {
      failed(error, cacheKey, 'set');
      return false;
    }
  }

  /** Remove entries (explicit invalidation). Failures are counted, not thrown. */
  async function del(...cacheKeys) {
    if (!redis || !cacheKeys.length) return 0;
    try {
      const removed = await redis.del(...cacheKeys);
      succeeded();
      return removed;
    } catch (error) {
      failed(error, cacheKeys[0], 'del');
      return 0;
    }
  }

  /**
   * Cache-aside: return the cached value, or run loader once, cache its
   * result for ttlSeconds and return it. Concurrent calls for the same key
   * in this process share one lookup and one loader call (single flight), so
   * a hot key expiring doesn't send a burst of identical queries to MongoDB.
   * Loader errors propagate and are not cached; undefined results aren't cached.
   *
   * @template T
   * @param {string} cacheKey
   * @param {number} ttlSeconds
   * @param {() => Promise<T>} loader
   * @returns {Promise<T>}
   */
  async function wrap(cacheKey, ttlSeconds, loader) {
    const pending = inFlight.get(cacheKey);
    if (pending) {
      counts.sharedLoads += 1;
      return pending;
    }
    const load = (async () => {
      const cached = await get(cacheKey);
      if (cached !== undefined) return cached;
      counts.loads += 1;
      emit('load', cacheKey);
      const value = await loader();
      if (value !== undefined) await set(cacheKey, value, ttlSeconds);
      return value;
    })();
    inFlight.set(cacheKey, load);
    try {
      return await load;
    } finally {
      inFlight.delete(cacheKey);
    }
  }

  const stats = () => ({ enabled: Boolean(redis), ...counts });

  return { key, get, set, del, wrap, stats };
}

let shared;

/** The process-wide cache over REDIS_URL (a pass-through when it isn't set). */
function getCache() {
  shared ??= createCache({ redis: getRedis(), prefix: getConfig().redis.keyPrefix });
  return shared;
}

module.exports = { createCache, getCache, serialize, deserialize };
