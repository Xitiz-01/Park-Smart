const mongoose = require('mongoose');
const { getConfig } = require('../src/config/env');
const { logger } = require('../src/platform/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(getConfig().mongodbUri);
    logger.info({ host: conn.connection.host }, 'MongoDB connected');
  } catch (error) {
    logger.fatal({ err: error }, 'MongoDB connection failed');
    process.exit(1);
  }
};

module.exports = connectDB;
