const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const migrate = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
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
