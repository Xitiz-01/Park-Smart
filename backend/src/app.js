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

// Every resource mounted under /api/v1 (and its deprecated /api alias).
const V1_RESOURCES = [
  'account',
  'slots',
  'bookings',
  'admin',
  'vehicles',
  'vehicle-catalog',
  'vendors',
  'vendor-verification',
  'parking-locations',
  'location',
];

/**
 * Build the ParkSmart Express app. It opens no sockets and connects to no
 * database, so tests can drive it directly; server.js adds the HTTP server,
 * Socket.IO and the MongoDB connection.
 *
 * @param {{
 *   config?: import('./config/env').Config,
 *   logger?: import('pino').Logger,
 *   healthChecks?: Record<string, () => Promise<boolean>>,
 * }} [options]
 * @returns {import('express').Express}
 */
function createApp({ config = getConfig(), logger = defaultLogger, healthChecks = { mongo: pingMongo } } = {}) {
  const app = express();
  const security = securityMiddleware(config.http);
  app.set('trust proxy', config.http.trustProxy);

  app.use(requestLogger(logger));
  app.use(slowRequestWarning(config.log.slowRequestMs));
  app.use(security.headers);
  app.use('/health', healthRouter(healthChecks));
  app.use(cors({
    origin: config.allowedOrigins,
    credentials: true,
  }));
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
  // Routes live under /api/v1. The same router stays mounted at /api as a
  // deprecated alias until the frontend moves over (Phase 14). Better Auth
  // keeps /api/auth until Clerk replaces it. The mounts are spelled out (not
  // looped) so static analysis can see that the /api rate limit above covers
  // every route. forwardAsyncErrors sends rejected promises from async
  // handlers to the error middleware.
  const v1 = express.Router();
  v1.use('/account', require('../routes/accountRoutes'));
  v1.use('/slots', require('../routes/slotRoutes'));
  v1.use('/bookings', require('../routes/bookingRoutes'));
  v1.use('/admin', require('../routes/adminRoutes'));
  v1.use('/vehicles', require('../routes/vehicleRoutes'));
  v1.use('/vehicle-catalog', require('../routes/vehicleCatalogRoutes'));
  v1.use('/vendors', require('../routes/vendorRoutes'));
  v1.use('/vendor-verification', require('../routes/vendorVerificationRoutes'));
  v1.use('/parking-locations', require('../routes/parkingLocationRoutes'));
  v1.use('/location', require('../routes/locationRoutes'));
  forwardAsyncErrors(v1);
  app.use('/api/v1', v1);
  app.use('/api', deprecatedAlias(V1_RESOURCES), v1);

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

module.exports = { createApp, V1_RESOURCES };
