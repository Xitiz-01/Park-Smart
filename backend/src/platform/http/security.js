const helmet = require('helmet');
const hpp = require('hpp');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { RateLimitError } = require('../errors');
const { firstConnection } = require('../redis');
const { logger: defaultLogger } = require('../logger');

// Credential endpoints get their own, tighter budget.
const AUTH_RATE_LIMITED_PATHS = ['/api/auth/sign-in', '/api/auth/sign-up'];

/**
 * Remove keys that MongoDB would read as operators or paths ("$gt",
 * "a.b") from parsed input, in place, at any depth. Request schemas already
 * reject objects where scalars belong; this covers every other endpoint.
 */
function stripMongoOperators(value) {
  if (Array.isArray(value)) {
    value.forEach(stripMongoOperators);
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) delete value[key];
      else stripMongoOperators(value[key]);
    }
  }
  return value;
}

function sanitizeInput(req, res, next) {
  ['body', 'query', 'params'].forEach((part) => stripMongoOperators(req[part]));
  next();
}

/**
 * The rate limiter's logger. Store errors are logged as alerts (requests
 * pass unlimited while the store is down), at most once per intervalMs with
 * a count of the ones held back, so an outage doesn't flood the logs.
 *
 * @param {import('pino').Logger} logger
 * @param {{ intervalMs?: number, now?: () => number }} [options]
 */
function rateLimitLogger(logger, { intervalMs = 60_000, now = Date.now } = {}) {
  let lastLogged = -Infinity;
  let suppressed = 0;
  return {
    warn: (error) => logger.warn({ err: error }, 'rate limiter warning'),
    error: (error, message = 'rate limiter error') => {
      if (now() - lastLogged < intervalMs) {
        suppressed += 1;
        return;
      }
      logger.error({ err: error, alert: 'rate-limit-store', suppressed }, message);
      lastLogged = now();
      suppressed = 0;
    },
  };
}

/**
 * Redis store for one limiter. Each limiter needs its own key prefix, or
 * they'd count into the same keys. The store's first command (loading its
 * script at boot) waits up to 500 ms for the connection; after that every
 * command fails fast while Redis is down.
 *
 * @param {import('ioredis').Redis} redis
 * @param {string} prefix
 */
function redisStore(redis, prefix) {
  let connected;
  return new RedisStore({
    prefix,
    sendCommand: async (command, ...args) => {
      connected ??= firstConnection(redis, 500);
      await connected;
      return redis.call(command, ...args);
    },
  });
}

/**
 * A rate limiter answering with the standard 429 envelope. With Redis the
 * counts are shared by every instance; without it they're per instance, in
 * memory. If the Redis store fails, requests pass (fail open) and an alert
 * is logged: a Redis outage must not take the API down with it.
 *
 * @param {{ windowMs: number, limit: number, message: string, store?: import('express-rate-limit').Store, logger: ReturnType<typeof rateLimitLogger> }} options
 */
function limiter({ windowMs, limit, message, store, logger }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store,
    passOnStoreError: true,
    logger,
    handler: (req, res, next) => next(new RateLimitError(message)),
  });
}

/**
 * The hardening middleware, in the order app.js mounts it.
 * @param {import('../../config/env').Config['http']} http
 * @param {{ redis?: import('ioredis').Redis | null, keyPrefix?: string, logger?: import('pino').Logger }} [options]
 */
function securityMiddleware(http, { redis = null, keyPrefix = 'ps', logger = defaultLogger } = {}) {
  const { windowMs, max, authMax } = http.rateLimit;
  const limiterLogger = rateLimitLogger(logger);
  const store = (name) => (redis ? redisStore(redis, `${keyPrefix}:v1:rate-limit:${name}:`) : undefined);
  return {
    headers: helmet(),
    compression: compression(),
    apiRateLimit: limiter({
      windowMs,
      limit: max,
      message: 'Too many requests. Try again in a few minutes.',
      store: store('api'),
      logger: limiterLogger,
    }),
    authRateLimit: limiter({
      windowMs,
      limit: authMax,
      message: 'Too many sign-in attempts. Try again in a few minutes.',
      store: store('auth'),
      logger: limiterLogger,
    }),
    parameterPollution: hpp(),
    sanitizeInput,
  };
}

module.exports = { securityMiddleware, stripMongoOperators, rateLimitLogger, AUTH_RATE_LIMITED_PATHS };
