const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { removeDigiLockerData } = require('../scripts/removeDigiLockerData');

const mongoBase = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27028';
const quiet = { log() {} };

test('DigiLocker clean-up reports leftovers and drops only the OAuth state collection', async (t) => {
  const client = await MongoClient.connect(mongoBase);
  const db = client.db('parksmart-digilocker-cleanup-test');
  t.after(async () => { await db.dropDatabase(); await client.close(); });
  await db.dropDatabase();

  // Nothing there: a dry run and an apply are both no-ops.
  assert.equal((await removeDigiLockerData({ db, logger: quiet })).needsReview, 0);
  assert.equal((await removeDigiLockerData({ db, apply: true, logger: quiet })).droppedStateCollection, false);

  // Only expired OAuth state left: apply drops that collection.
  await db.collection('verificationoauthstates').insertOne({ provider: 'DIGILOCKER', stateHash: 'x' });
  await db.collection('verificationdocuments').insertOne({ provider: 'MANUAL', documentType: 'PAN' });
  const dry = await removeDigiLockerData({ db, logger: quiet });
  assert.equal(dry.oauthStates, 1);
  assert.equal(dry.droppedStateCollection, false, 'a dry run changes nothing');
  const applied = await removeDigiLockerData({ db, apply: true, logger: quiet });
  assert.equal(applied.droppedStateCollection, true);
  assert.equal((await db.listCollections({ name: 'verificationoauthstates' }).toArray()).length, 0);
  assert.equal(await db.collection('verificationdocuments').countDocuments(), 1, 'manual evidence is untouched');

  // Evidence recorded through DigiLocker blocks apply and is never rewritten.
  await db.collection('verificationdocuments').insertOne({ provider: 'DIGILOCKER', documentType: 'PAN' });
  await db.collection('vendorverifications').insertOne({ provider: 'MANUAL', consents: [{ provider: 'DIGILOCKER' }] });
  await assert.rejects(removeDigiLockerData({ db, apply: true, logger: quiet }), /manual decision/);
  assert.equal(await db.collection('verificationdocuments').countDocuments({ provider: 'DIGILOCKER' }), 1);
  const report = await removeDigiLockerData({ db, logger: quiet });
  assert.equal(report.documents, 1);
  assert.equal(report.verifications, 1);
});
