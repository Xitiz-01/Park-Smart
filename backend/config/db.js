const mongoose = require('mongoose');
const { getConfig } = require('../src/config/env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(getConfig().mongodbUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
