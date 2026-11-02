const helmet = require('helmet');
const hpp = require('hpp');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const { RateLimitError } = require('../errors');

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
 * In-memory rate limiter answering with the standard 429 envelope. A Redis
 * store replaces the memory store once Redis exists (Phase 3/8), so limits
 * hold across instances.
 *
 * @param {{ windowMs: number, limit: number, message: string }} options
 */
function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => next(new RateLimitError(message)),
  });
}

/**
 * The hardening middleware, in the order app.js mounts it.
 * @param {import('../../config/env').Config['http']} http
 */
function securityMiddleware(http) {
  const { windowMs, max, authMax } = http.rateLimit;
  return {
    headers: helmet(),
    compression: compression(),
    apiRateLimit: limiter({ windowMs, limit: max, message: 'Too many requests. Try again in a few minutes.' }),
    authRateLimit: limiter({ windowMs, limit: authMax, message: 'Too many sign-in attempts. Try again in a few minutes.' }),
    parameterPollution: hpp(),
    sanitizeInput,
  };
}

module.exports = { securityMiddleware, stripMongoOperators, AUTH_RATE_LIMITED_PATHS };
