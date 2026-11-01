const express = require('express');
const cors = require('cors');

const { betterAuthHandler } = require('../auth/betterAuthBridge');
const { getConfig } = require('./config/env');
const { logger: defaultLogger } = require('./platform/logger');
const { requestLogger, slowRequestWarning } = require('./platform/http/requestLogging');

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
  // Routes
  app.use('/api/account', require('../routes/accountRoutes'));
  app.use('/api/slots', require('../routes/slotRoutes'));
  app.use('/api/bookings', require('../routes/bookingRoutes'));
  app.use('/api/admin', require('../routes/adminRoutes'));
  app.use('/api/vehicles', require('../routes/vehicleRoutes'));
  app.use('/api/vehicle-catalog', require('../routes/vehicleCatalogRoutes'));
  app.use('/api/vendors', require('../routes/vendorRoutes'));
  app.use('/api/vendor-verification', require('../routes/vendorVerificationRoutes'));
  app.use('/api/parking-locations', require('../routes/parkingLocationRoutes'));
  app.use('/api/location', require('../routes/locationRoutes'));

  // Health check
  app.get('/', (req, res) => {
    res.json({ message: 'Parking System API is running' });
  });
  // Error handler. Express only treats a four-parameter function as one, so
  // _next stays even though it isn't called.
  app.use((err, req, res, _next) => {
    const isUploadError = err.name === 'MulterError';
    const statusCode = err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 413 : isUploadError ? 400 : 500);
    const safeMessage = err.code === 'LIMIT_FILE_SIZE'
      ? 'Document must be 5 MB or smaller'
      : statusCode >= 500 && !err.statusCode
        ? 'Internal Server Error'
        : (err.message || 'Request could not be completed');
    res.status(statusCode).json({
      success: false,
      message: safeMessage,
      stack: getConfig().nodeEnv === 'development' ? err.stack : undefined,
    });
  });

  return app;
}

module.exports = { createApp };
