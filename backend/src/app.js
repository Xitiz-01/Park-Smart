const express = require('express');
const cors = require('cors');

const { betterAuthHandler } = require('../auth/betterAuthBridge');
const { getConfig } = require('./config/env');
const { logger: defaultLogger } = require('./platform/logger');
const { requestLogger, slowRequestWarning } = require('./platform/http/requestLogging');
const { errorHandler, notFoundHandler } = require('./platform/http/errorHandler');
const { forwardAsyncErrors } = require('./platform/http/asyncRoutes');

/**
 * Build the ParkSmart Express app. It opens no sockets and connects to no
 * database, so tests can drive it directly; server.js adds the HTTP server,
 * Socket.IO and the MongoDB connection.
 *
 * @param {{ allowedOrigins: string[], logger?: import('pino').Logger }} options
 * @returns {import('express').Express}
 */
function createApp({ allowedOrigins, logger = defaultLogger }) {
  const app = express();

  app.use(requestLogger(logger));
  app.use(slowRequestWarning(getConfig().log.slowRequestMs));

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));
  // Better Auth must receive the untouched request body. Keep this mount before
  // express.json() and express.urlencoded().
  app.all('/api/auth/*', betterAuthHandler);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.get('/api', (req, res) => {
    res.send('API is working');
  });
  // Routes. forwardAsyncErrors sends rejected promises from async handlers
  // to the error middleware instead of leaving them unhandled.
  const routes = {
    '/api/account': require('../routes/accountRoutes'),
    '/api/slots': require('../routes/slotRoutes'),
    '/api/bookings': require('../routes/bookingRoutes'),
    '/api/admin': require('../routes/adminRoutes'),
    '/api/vehicles': require('../routes/vehicleRoutes'),
    '/api/vehicle-catalog': require('../routes/vehicleCatalogRoutes'),
    '/api/vendors': require('../routes/vendorRoutes'),
    '/api/vendor-verification': require('../routes/vendorVerificationRoutes'),
    '/api/parking-locations': require('../routes/parkingLocationRoutes'),
    '/api/location': require('../routes/locationRoutes'),
  };
  Object.entries(routes).forEach(([path, router]) => app.use(path, forwardAsyncErrors(router)));

  // Health check
  app.get('/', (req, res) => {
    res.json({ message: 'Parking System API is running' });
  });
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
