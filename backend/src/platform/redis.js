const Redis = require('ioredis');
const { getConfig } = require('../config/env');
const { logger: defaultLogger } = require('./logger');

const EVER_READY = Symbol('everReady');

/**
 * Create an ioredis client tuned for fail-fast use: while Redis is
 * unreachable, commands reject at once (no offline queue, one attempt)
 * instead of piling up, so callers can fall back. ioredis keeps reconnecting
 * in the background (exponential backoff up to 5 s). Only state changes are
 * logged, not every failed attempt.
 *
 * Queues (Phase 8) need the opposite settings and get their own connection.
 *
 * @param {string} url redis:// or rediss://
 * @param {{ logger?: import('pino').Logger, name?: string, options?: import('ioredis').RedisOptions }} [settings]
 * @returns {import('ioredis').Redis}
 */
function createRedisClient(url, { logger = defaultLogger, name = 'parksmart', options = {} } = {}) {
  const client = new Redis(url, {
    connectionName: name,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    ...options,
  });
  let up;
  client.on('ready', () => {
    client[EVER_READY] = true;
    if (up !== true) logger.info({ redis: name }, 'Redis ready');
    up = true;
  });
  client.on('error', (error) => {
    if (up !== false) logger.warn({ err: error, redis: name }, 'Redis unavailable; reconnecting in the background');
    up = false;
  });
  return client;
}

/**
 * Wait for a client's first connection, up to timeoutMs. Resolves at once
 * once the client has been ready before (during an outage callers should
 * fail fast, not wait) or when it is ready now.
 *
 * @param {import('ioredis').Redis} client
 * @param {number} timeoutMs
 */
function firstConnection(client, timeoutMs) {
  if (client[EVER_READY] || client.status === 'ready' || client.status === 'end') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      client.off('ready', done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    client.once('ready', done);
  });
}

/**
 * True when Redis answers PING within timeoutMs.
 * @param {import('ioredis').Redis | null} client
 * @param {number} [timeoutMs]
 */
async function pingClient(client, timeoutMs = 1000) {
  if (!client || client.status !== 'ready') return false;
  let timer;
  try {
    const reply = await Promise.race([
      client.ping(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('ping timed out')), timeoutMs);
      }),
    ]);
    return reply === 'PONG';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Close a client: QUIT (lets pending replies arrive), falling back to an
 * immediate disconnect when Redis can't be reached. Resolves once the
 * socket has closed (at most 2 s).
 * @param {import('ioredis').Redis | null} client
 */
async function closeClient(client) {
  if (!client || client.status === 'end') return;
  if (client.status === 'reconnecting' || client.status === 'wait') {
    // No socket open: this cancels the pending reconnect, and that's all
    // there is to close (ioredis emits no 'end' here).
    client.disconnect();
    return;
  }
  let timer;
  const ended = new Promise((resolve) => {
    client.once('end', resolve);
    timer = setTimeout(resolve, 2000);
  });
  if (client.status === 'ready') {
    await client.quit().catch(() => client.disconnect());
  } else {
    client.disconnect();
  }
  await ended;
  clearTimeout(timer);
}

let shared;

/**
 * The process-wide client for REDIS_URL, created on first use; null when
 * REDIS_URL isn't set (Redis is optional).
 * @returns {import('ioredis').Redis | null}
 */
function getRedis() {
  if (shared === undefined) {
    const { url } = getConfig().redis;
    shared = url ? createRedisClient(url) : null;
  }
  return shared;
}

const pingRedis = () => pingClient(getRedis());
const closeRedis = () => closeClient(shared ?? null);

module.exports = { createRedisClient, firstConnection, pingClient, closeClient, getRedis, pingRedis, closeRedis };
