const express = require('express');
const cors = require('cors');

const { betterAuthHandler } = require('../auth/betterAuthBridge');
const { getConfig } = require('./config/env');
const { logger: defaultLogger } = require('./platform/logger');
const { requestLogger, slowRequestWarning } = require('./platform/http/requestLogging');
const { errorHandler, notFoundHandler } = require('./platform/http/errorHandler');
const { forwardAsyncErrors } = require('./platform/http/asyncRoutes');
const { securityMiddleware, AUTH_RATE_LIMITED_PATHS } = require('./platform/http/security');
const { deprecatedAlias } = require('./platform/http/versioning');
const { buildOpenApiDocument } = require('./platform/openapi');
const { healthRouter } = require('./platform/health');
const { pingMongo } = require('./platform/db');
const { getRedis, pingRedis } = require('./platform/redis');

/**
 * MongoDB is critical. Redis, when configured, is reported but not
 * critical: the cache and rate limits fail open, so the API still serves
 * without it. Queues make it critical for the worker in Phase 8.
 * @param {import('./config/env').Config} config
 */
const defaultHealthChecks = (config) => ({
  mongo: pingMongo,
  ...(config.redis.url && { redis: { check: pingRedis, critical: false } }),
});

/**
 * Build the ParkSmart Express app. It opens no sockets and connects to no
 * database, so tests can drive it directly; server.js adds the HTTP server,
 * Socket.IO and the MongoDB connection.
 *
 * @param {{
 *   config?: import('./config/env').Config,
 *   logger?: import('pino').Logger,
 *   healthChecks?: Parameters<typeof healthRouter>[0],
 *   redis?: import('ioredis').Redis | null,
 * }} [options]
 * @returns {import('express').Express}
 */
function createApp({
  config = getConfig(),
  logger = defaultLogger,
  healthChecks = defaultHealthChecks(config),
  redis = config.redis.url ? getRedis() : null,
} = {}) {
  const app = express();
  const security = securityMiddleware(config.http, { redis, keyPrefix: config.redis.keyPrefix, logger });
  app.set('trust proxy', config.http.trustProxy);

  app.use(requestLogger(logger));
  app.use(slowRequestWarning(config.log.slowRequestMs));
  app.use(security.headers);
  app.use('/health', healthRouter(healthChecks));
  app.use(
    cors({
      origin: config.allowedOrigins,
      credentials: true,
    }),
  );
  app.use(security.compression);
  app.use('/api', security.apiRateLimit);
  app.use(AUTH_RATE_LIMITED_PATHS, security.authRateLimit);
  // Better Auth must receive the untouched request body. Keep this mount before
  // express.json() and express.urlencoded().
  app.all('/api/auth/*', betterAuthHandler);
  app.use(express.json({ limit: config.http.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.http.jsonBodyLimit }));
  app.use(security.parameterPollution);
  app.use(security.sanitizeInput);
  app.get('/api', (req, res) => {
    res.send('API is working');
  });
  // Routes live under /api/v1. The same routers stay mounted at /api as a
  // deprecated alias until the frontend moves over (Phase 14). Better Auth
  // keeps /api/auth until Clerk replaces it. forwardAsyncErrors sends
  // rejected promises from async handlers to the error middleware.
  const routes = {
    account: require('../routes/accountRoutes'),
    slots: require('../routes/slotRoutes'),
    bookings: require('../routes/bookingRoutes'),
    admin: require('../routes/adminRoutes'),
    vehicles: require('../routes/vehicleRoutes'),
    'vehicle-catalog': require('../routes/vehicleCatalogRoutes'),
    vendors: require('../routes/vendorRoutes'),
    'vendor-verification': require('../routes/vendorVerificationRoutes'),
    'parking-locations': require('../routes/parkingLocationRoutes'),
    location: require('../routes/locationRoutes'),
  };
  Object.entries(routes).forEach(([name, router]) => {
    forwardAsyncErrors(router);
    app.use(`/api/v1/${name}`, router);
    app.use(`/api/${name}`, deprecatedAlias(`/api/${name}`, `/api/v1/${name}`), router);
  });

  if (!config.isProduction) {
    const openApiDocument = buildOpenApiDocument();
    app.get('/api/docs', (req, res) => res.json(openApiDocument));
  }

  // Health check
  app.get('/', (req, res) => {
    res.json({ message: 'Parking System API is running' });
  });
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
