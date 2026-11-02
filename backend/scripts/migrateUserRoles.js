const mongoose = require('mongoose');
const { getConfig } = require('../src/config/env');
const User = require('../models/User');

const migrate = async () => {
  await mongoose.connect(getConfig().mongodbUri);
  const result = await User.updateMany(
    { $or: [{ role: { $exists: false } }, { role: null }, { role: '' }] },
    { $set: { role: 'customer' } }
  );
  console.log(`User role migration complete: ${result.modifiedCount} account(s) updated`);
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(`User role migration failed: ${error.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
