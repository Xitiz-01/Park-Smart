const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const ParkingLocation = require('../models/ParkingLocation');
const { CashfreeVerificationProvider, DigiLockerProvider, ProviderUnavailableError } = require('../services/verificationProviders');
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

test('external verification outage is normalized to a safe provider error', async () => {
  const provider = new CashfreeVerificationProvider({ enabled: true, clientId: 'id', clientSecret: 'secret', fetch: async () => { throw new Error('socket exposed internal detail'); } });
  await assert.rejects(() => provider.verifyPan({ identifier: 'ABCDE1234F', name: 'Vendor' }), (error) => {
    assert.ok(error instanceof ProviderUnavailableError);
    assert.equal(error.statusCode, 503);
    assert.equal(error.message.includes('socket'), false);
    return true;
  });
});

test('DigiLocker adapter uses unpredictable state, stable hashing, and exact callback binding', () => {
  const first = DigiLockerProvider.generateState();
  const second = DigiLockerProvider.generateState();
  assert.notEqual(first, second);
  assert.equal(DigiLockerProvider.hashState(first), DigiLockerProvider.hashState(first));
  assert.notEqual(DigiLockerProvider.hashState(first), DigiLockerProvider.hashState(second));
  const provider = new DigiLockerProvider({
    enabled: true, clientId: 'requester-id', clientSecret: 'secret',
    redirectUri: 'https://api.parksmart.live/api/vendor-verification/digilocker/callback',
    authorizationUrl: 'https://example.test/oauth2/authorize', tokenUrl: 'https://example.test/oauth2/token', documentsUrl: 'https://example.test/documents',
  });
  const url = new URL(provider.createAuthorizationUrl(first));
  assert.equal(url.searchParams.get('state'), first);
  assert.equal(url.searchParams.get('redirect_uri'), 'https://api.parksmart.live/api/vendor-verification/digilocker/callback');
  assert.equal(new DigiLockerProvider({ enabled: false }).isConfigured(), false);
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
