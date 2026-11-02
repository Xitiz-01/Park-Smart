const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { databaseNameFromUri } = require('./migrateVehicleFuelType');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = new Set(process.argv.slice(2));
const getArg = (prefix) => process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);

const PROVIDER = 'DIGILOCKER';
const STATE_COLLECTION = 'verificationoauthstates';

/**
 * DigiLocker was removed as a verification provider. This finds anything it
 * left behind and, with apply, drops the now-unused OAuth state collection.
 * Evidence, consents or audit entries recorded through DigiLocker are never
 * rewritten or deleted here: they are reported for a human decision, and the
 * script refuses to apply while any exist (the provider enum no longer
 * accepts them, so those records need a deliberate fix).
 *
 * @param {{ db: import('mongodb').Db, apply?: boolean, logger?: Console }} options
 */
const removeDigiLockerData = async ({ db, apply = false, logger = console }) => {
  const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  const count = async (name, filter) => (collections.has(name) ? db.collection(name).countDocuments(filter) : 0);

  const report = {
    oauthStates: await count(STATE_COLLECTION, {}),
    documents: await count('verificationdocuments', { provider: PROVIDER }),
    audits: await count('verificationaudits', { provider: PROVIDER }),
    verifications: await count('vendorverifications', { $or: [{ provider: PROVIDER }, { 'consents.provider': PROVIDER }] }),
    droppedStateCollection: false,
    applied: apply,
  };
  report.needsReview = report.documents + report.audits + report.verifications;

  if (apply) {
    if (report.needsReview) {
      throw Object.assign(new Error(`${report.needsReview} DigiLocker evidence, audit or consent record(s) need a manual decision before applying`), { report });
    }
    if (collections.has(STATE_COLLECTION)) {
      await db.collection(STATE_COLLECTION).drop();
      report.droppedStateCollection = true;
    }
  }
  logger.log(JSON.stringify(report, null, 2));
  return report;
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
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: looking for DigiLocker leftovers in ${databaseName}`);
  await removeDigiLockerData({ db: mongoose.connection.db, apply });
  if (!apply) console.log(`No data changed. To apply: npm run migrate:remove-digilocker -- --apply --confirm-db=${databaseName}`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch(async (error) => {
    console.error(`DigiLocker clean-up failed: ${error.message}`);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { removeDigiLockerData };
