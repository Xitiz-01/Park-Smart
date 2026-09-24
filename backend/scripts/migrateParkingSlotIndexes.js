const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ParkingSlot = require('../models/ParkingSlot');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const migrate = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  const indexes = await ParkingSlot.collection.indexes();
  if (indexes.some((index) => index.name === 'slotNumber_1')) {
    await ParkingSlot.collection.dropIndex('slotNumber_1');
    console.log('Removed legacy global slot-number uniqueness index');
  }
  await ParkingSlot.syncIndexes();
  console.log('Parking slot location-scoped indexes are ready');
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(`Parking slot index migration failed: ${error.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
