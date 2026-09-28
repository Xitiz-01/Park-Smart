const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Vehicle = require('../models/Vehicle');
const { normalizeFuelType } = require('../utils/vehicleClassification');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = new Set(process.argv.slice(2));
const getArg = (prefix) => process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);

const migrateVehicleFuelTypes = async ({ collection = Vehicle.collection, apply = false, logger = console } = {}) => {
  const vehicles = await collection.find({}).toArray();
  const operations = [];
  let conflicts = 0;

  for (const vehicle of vehicles) {
    if (String(vehicle.vehicleType || '').trim().toLowerCase() !== 'ev') continue;
    const fuelType = normalizeFuelType(vehicle.fuelType);
    if (fuelType && fuelType !== 'electric') {
      // Do not overwrite an explicit, contradictory fuel classification.
      conflicts += 1;
      continue;
    }
    operations.push({
      updateOne: {
        filter: { _id: vehicle._id, vehicleType: vehicle.vehicleType },
        update: { $set: { vehicleType: 'car', fuelType: 'electric', updatedAt: new Date() } },
      },
    });
  }

  let migrated = operations.length;
  if (apply && operations.length) {
    const result = await collection.bulkWrite(operations, { ordered: false });
    migrated = result.modifiedCount;
  }
  const report = {
    scanned: vehicles.length,
    migrated,
    skipped: vehicles.length - operations.length,
    conflicts,
    applied: apply,
  };
  logger.log(JSON.stringify(report, null, 2));
  return report;
};

const databaseNameFromUri = (uri) => {
  const pathName = new URL(uri).pathname.replace(/^\//, '').split('?')[0];
  if (!pathName) throw new Error('MONGODB_URI must include an explicit database name');
  return pathName;
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const apply = args.has('--apply');
  const expectedDb = getArg('--confirm-db=');
  const databaseName = databaseNameFromUri(process.env.MONGODB_URI);
  if (apply && (!expectedDb || expectedDb !== databaseName)) {
    throw new Error(`Refusing writes. Re-run with --apply --confirm-db=${databaseName}`);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: inspecting vehicle classifications in ${databaseName}`);
  const report = await migrateVehicleFuelTypes({ apply });
  if (report.conflicts) {
    console.warn(`${report.conflicts} legacy EV record(s) had a contradictory explicit fuelType and were left unchanged for manual review.`);
  }
  if (!apply) console.log(`No data changed. To apply: npm run migrate:vehicle-fuel-type -- --apply --confirm-db=${databaseName}`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch(async (error) => {
    console.error(`Vehicle fuel type migration failed: ${error.message}`);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { migrateVehicleFuelTypes, databaseNameFromUri };
