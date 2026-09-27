const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { migrateExistingUsers } = require('../services/betterAuthMigration');

dotenv.config();

const run = async () => {
  const apply = process.argv.includes('--apply');
  const confirmedDatabase = process.argv
    .find((arg) => arg.startsWith('--confirm-db='))
    ?.slice('--confirm-db='.length);

  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const databaseName = mongoose.connection.name;

  if (apply && confirmedDatabase !== databaseName) {
    throw new Error(`Refusing to write: pass --confirm-db=${databaseName} after verifying the target database`);
  }

  console.log(`Better Auth user migration: ${apply ? 'APPLY' : 'DRY RUN'} on database "${databaseName}"`);
  const summary = await migrateExistingUsers({ db: mongoose.connection.db, dryRun: !apply });
  console.log('Migration summary:', summary);
  if (!apply) {
    console.log(`No data changed. Re-run with --apply --confirm-db=${databaseName} after reviewing this output.`);
  }
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
