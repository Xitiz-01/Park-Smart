const mongoose = require('mongoose');
const { getConfig } = require('../src/config/env');
const ParkingSlot = require('../models/ParkingSlot');

const migrate = async () => {
  await mongoose.connect(getConfig().mongodbUri);
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
