const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const ParkingLocation = require('../models/ParkingLocation');
const verificationProviders = require('../services/verificationProviders');
const { CashfreeVerificationProvider, ProviderUnavailableError } = verificationProviders;
const { VERIFICATION_PROVIDERS } = require('../constants/verification');
const { LocalPrivateStorage } = require('../services/storageService');
const { maskIdentifier, redactSensitive } = require('../services/redactionService');

test('Cashfree adapter normalizes documented PAN and GSTIN responses without retaining raw identifiers', async () => {
  const calls = [];
  const provider = new CashfreeVerificationProvider({
    enabled: true, clientId: 'test-id', clientSecret: 'test-secret', baseUrl: 'https://sandbox.cashfree.com/verification',
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/pan')) return new Response(JSON.stringify({ valid: true, reference_id: 91, registered_name: 'Sample Vendor', type: 'Individual', name_match_result: 'DIRECT_MATCH' }), { status: 200 });
      return new Response(JSON.stringify({ valid: true, reference_id: 92, legal_name_of_business: 'Sample Parking Private Limited', gstin_status: 'Active' }), { status: 200 });
    },
  });
  const pan = await provider.verifyPan({ identifier: 'ABCDE1234F', name: 'Sample Vendor' });
  const gstin = await provider.verifyGstin({ identifier: '27ABCDE1234F1Z5', businessName: 'Sample Parking' });
  assert.equal(pan.status, 'VERIFIED');
  assert.equal(pan.safeMetadata.maskedIdentifier.endsWith('234F'), true);
  assert.equal(JSON.stringify(pan).includes('ABCDE1234F'), false);
  assert.equal(gstin.status, 'VERIFIED');
  assert.deepEqual(calls.map((call) => call.url), ['https://sandbox.cashfree.com/verification/pan', 'https://sandbox.cashfree.com/verification/gstin']);
  assert.equal(calls[0].options.headers['x-client-secret'], 'test-secret');
});

test('Cashfree bank account check follows the Sync V2 contract and keeps only the last four digits', async () => {
  const calls = [];
  const responses = [
    { account_status: 'VALID', account_status_code: 'ACCOUNT_IS_VALID', name_match_result: 'DIRECT_MATCH', name_at_bank: 'SAMPLE PARKING PVT LTD', bank_name: 'HDFC Bank', reference_id: 3301 },
    { account_status: 'VALID', account_status_code: 'ACCOUNT_IS_VALID', name_match_result: 'POOR_PARTIAL_MATCH', name_at_bank: 'S P LTD', reference_id: 3302 },
    { account_status: 'INVALID', account_status_code: 'INVALID_ACCOUNT_FAIL', name_match_result: null, name_at_bank: null, reference_id: 3303 },
  ];
  const provider = new CashfreeVerificationProvider({
    enabled: true, clientId: 'test-id', clientSecret: 'test-secret', baseUrl: 'https://sandbox.cashfree.com/verification',
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(JSON.stringify(responses[calls.length - 1]), { status: 200 });
    },
  });
  const input = { accountNumber: '50100123456789', ifsc: 'HDFC0001234', name: 'Sample Parking Pvt Ltd' };
  const matched = await provider.verifyBankAccount(input);
  const weak = await provider.verifyBankAccount(input);
  const invalid = await provider.verifyBankAccount(input);

  assert.equal(calls[0].url, 'https://sandbox.cashfree.com/verification/bank-account/sync');
  assert.deepEqual(calls[0].body, { bank_account: '50100123456789', ifsc: 'HDFC0001234', name: 'Sample Parking Pvt Ltd' });
  assert.equal(matched.status, 'VERIFIED');
  assert.equal(matched.category, 'BANK');
  assert.equal(matched.documentType, 'BANK_ACCOUNT');
  assert.equal(weak.status, 'UNDER_REVIEW', 'a valid account with a weak name match goes to manual review');
  assert.equal(invalid.status, 'REJECTED');
  assert.equal(matched.safeMetadata.maskedIdentifier.endsWith('6789'), true);
  for (const result of [matched, weak, invalid]) {
    assert.equal(JSON.stringify(result).includes('50100123456789'), false, 'the full account number is never kept');
  }
});

test('external verification outage is normalized to a safe provider error', async () => {
  const provider = new CashfreeVerificationProvider({ enabled: true, clientId: 'id', clientSecret: 'secret', fetch: async () => { throw new Error('socket exposed internal detail'); } });
  await assert.rejects(() => provider.verifyPan({ identifier: 'ABCDE1234F', name: 'Vendor' }), (error) => {
    assert.ok(error instanceof ProviderUnavailableError);
    assert.equal(error.statusCode, 503);
    assert.equal(error.message.includes('socket'), false);
    return true;
  });
});

test('verification providers are manual review and Cashfree only', () => {
  assert.deepEqual([...VERIFICATION_PROVIDERS], ['MANUAL', 'CASHFREE']);
  assert.deepEqual(
    Object.keys(verificationProviders).filter((name) => name.endsWith('Provider')).sort(),
    ['CashfreeVerificationProvider', 'ManualVerificationProvider'],
  );
});

test('private local storage generates opaque keys and prevents path traversal', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'parksmart-verification-'));
  const storage = new LocalPrivateStorage(root);
  const key = await storage.put(Buffer.from('private-evidence'), { extension: 'pdf' });
  assert.equal(key.includes('original'), false);
  assert.equal((await storage.read(key)).toString(), 'private-evidence');
  await assert.rejects(() => storage.read('../outside'));
  await fs.rm(root, { recursive: true, force: true });
});

test('sensitive values are redacted and legacy active locations remain compatible', () => {
  assert.equal(maskIdentifier('ABCDE1234F'), '******234F');
  const safe = redactSensitive({ accessToken: 'token', nested: { clientSecret: 'secret', note: 'safe' }, pan: 'ABCDE1234F' });
  assert.deepEqual(safe, { accessToken: '[REDACTED]', nested: { clientSecret: '[REDACTED]', note: 'safe' }, pan: '[REDACTED]' });
  assert.equal(JSON.stringify(safe).includes('ABCDE1234F'), false);
  const draft = new ParkingLocation();
  const legacy = new ParkingLocation({ status: 'active' });
  assert.equal(draft.status, 'draft');
  assert.equal(legacy.status, 'active', 'existing explicitly active location status is preserved');
});
