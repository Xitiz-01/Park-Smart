const test = require('node:test');
const assert = require('node:assert/strict');

const { parseEnv, EnvValidationError } = require('../src/config/env');
const { normalizeClerkUser, signUpIntent } = require('../src/platform/auth/clerkUser');
const {
  createAuthProvider,
  createClerkAuthProvider,
  createFakeAuthProvider,
  sessionFromClaims,
} = require('../src/platform/auth/providers');

const base = { NODE_ENV: 'test' };
const problemsOf = (source) => {
  try {
    parseEnv(source);
    return [];
  } catch (error) {
    assert.ok(error instanceof EnvValidationError);
    return error.problems.map((problem) => `${problem.key}: ${problem.message}`);
  }
};

test('Clerk is off by default, and the config needs no Clerk variables', () => {
  const config = parseEnv(base);
  assert.equal(config.clerk.enabled, false);
  assert.equal(config.clerk.provider, 'clerk');
  assert.equal(createAuthProvider(config), null);
});

test('switching Clerk on requires its keys; the fake provider is refused in production', () => {
  assert.deepEqual(problemsOf({ ...base, CLERK_ENABLED: 'true' }), [
    'CLERK_SECRET_KEY: is required when CLERK_ENABLED=true',
    'CLERK_PUBLISHABLE_KEY: is required when CLERK_ENABLED=true',
  ]);
  assert.deepEqual(problemsOf({ ...base, CLERK_ENABLED: 'true', AUTH_PROVIDER: 'fake' }), []);
  const production = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://db.example/parksmart',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    ADDRESS_SELECTION_SECRET: 'address-secret',
  };
  assert.deepEqual(problemsOf({ ...production, AUTH_PROVIDER: 'fake' }), [
    'AUTH_PROVIDER: fake is for tests and CI only, never production',
  ]);
  assert.throws(() => createFakeAuthProvider({ nodeEnv: 'production' }), /never run in production/);
});

test('authorized parties default to the browser origins and can be set explicitly', () => {
  const defaults = parseEnv({ ...base, CLIENT_URL: 'https://app.example', CORS_ORIGINS: 'https://www.example' });
  assert.deepEqual(defaults.clerk.authorizedParties, ['https://app.example', 'https://www.example']);
  const explicit = parseEnv({ ...base, CLERK_AUTHORIZED_PARTIES: 'https://a.example, https://b.example' });
  assert.deepEqual(explicit.clerk.authorizedParties, ['https://a.example', 'https://b.example']);
  const pem = parseEnv({ ...base, CLERK_JWT_KEY: '-----BEGIN PUBLIC KEY-----\\nabc\\n-----END PUBLIC KEY-----' });
  assert.equal(pem.clerk.jwtKey, '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----');
});

test('only customer and vendor are honoured as sign-up intent', () => {
  assert.equal(signUpIntent('vendor'), 'vendor');
  assert.equal(signUpIntent('customer'), 'customer');
  for (const value of ['admin', 'super_admin', 'VENDOR', '', null, undefined, { role: 'admin' }, ['vendor']]) {
    assert.equal(signUpIntent(value), 'customer');
  }
});

test('SDK users and webhook payloads normalise to the same identity', () => {
  const fromSdk = normalizeClerkUser({
    id: 'user_1',
    emailAddresses: [
      { id: 'e0', emailAddress: 'old@example.com', verification: { status: 'verified' } },
      { id: 'e1', emailAddress: ' Asha@Example.COM ', verification: { status: 'verified' } },
    ],
    primaryEmailAddressId: 'e1',
    phoneNumbers: [{ id: 'p1', phoneNumber: '+919800000001' }],
    primaryPhoneNumberId: 'p1',
    firstName: 'Asha',
    lastName: 'Rao',
    unsafeMetadata: { intendedRole: 'vendor' },
    updatedAt: 1700000000000,
  });
  const fromWebhook = normalizeClerkUser({
    id: 'user_1',
    email_addresses: [{ id: 'e1', email_address: 'asha@example.com', verification: { status: 'verified' } }],
    primary_email_address_id: 'e1',
    phone_numbers: [{ id: 'p1', phone_number: '+919800000001' }],
    primary_phone_number_id: 'p1',
    first_name: 'Asha',
    last_name: 'Rao',
    unsafe_metadata: { intendedRole: 'vendor' },
    updated_at: 1700000000000,
  });
  const expected = {
    id: 'user_1',
    email: 'asha@example.com',
    emailVerified: true,
    name: 'Asha Rao',
    phone: '+919800000001',
    intendedRole: 'vendor',
    updatedAt: 1700000000000,
  };
  assert.deepEqual(fromSdk, expected);
  assert.deepEqual(fromWebhook, expected);

  const bare = normalizeClerkUser({
    id: 'user_2',
    email_addresses: [{ id: 'e', email_address: 'x@example.com', verification: { status: 'unverified' } }],
  });
  assert.equal(bare.emailVerified, false);
  assert.equal(bare.name, undefined);
  assert.equal(bare.intendedRole, 'customer');
  assert.throws(() => normalizeClerkUser({}), /needs an id/);
});

test('session claims: pending sessions and claims without a subject are signed out', () => {
  assert.deepEqual(sessionFromClaims({ sub: 'user_1', sid: 'sess_1', sts: 'active' }), {
    userId: 'user_1',
    sessionId: 'sess_1',
  });
  assert.equal(sessionFromClaims({ sub: 'user_1', sts: 'pending' }), null);
  assert.equal(sessionFromClaims({ sid: 'sess_1' }), null);
  assert.equal(sessionFromClaims(null), null);
});

test('the fake provider only accepts tokens it issued, and forgets signed-out ones', async () => {
  const fake = createFakeAuthProvider({ nodeEnv: 'test' });
  fake.addUser({ id: 'user_1', emailAddresses: [] });
  const token = fake.signIn('user_1');
  assert.deepEqual((await fake.verifySessionToken(token)).userId, 'user_1');
  assert.equal(await fake.verifySessionToken('fake_made-up'), null);
  assert.equal(await fake.verifySessionToken(fake.signIn('user_1', { pending: true })), null);
  fake.signOut(token);
  assert.equal(await fake.verifySessionToken(token), null);
  await assert.rejects(fake.getUser('user_missing'), (error) => error.status === 404);
});

test('the Clerk provider answers null for a malformed token without calling Clerk', async () => {
  const provider = createClerkAuthProvider({
    // Placeholders: a malformed token is refused before any key is used.
    secretKey: 'placeholder',
    authorizedParties: ['https://app.example'],
  });
  assert.equal(provider.name, 'clerk');
  assert.equal(await provider.verifySessionToken('not-a-jwt'), null);
});
