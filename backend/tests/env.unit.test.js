const test = require('node:test');
const assert = require('node:assert/strict');

const { parseEnv, EnvValidationError, bootstrapSuperAdminIds } = require('../src/config/env');

const base = { NODE_ENV: 'development', MONGODB_URI: 'mongodb://127.0.0.1:27017/parksmart' };
const problemsFor = (source) => {
  try {
    parseEnv(source);
  } catch (error) {
    assert.ok(error instanceof EnvValidationError);
    return error.problems;
  }
  assert.fail('expected the environment to be rejected');
};

test('defaults give a working development config', () => {
  const config = parseEnv(base);
  assert.equal(config.port, 5000);
  assert.equal(config.isProduction, false);
  assert.equal(config.auth.url, 'http://localhost:5000');
  assert.equal(config.externalParkingCacheTtlMs, 120000);
  assert.deepEqual(config.features, { clerk: false, payments: false, passes: false });
  assert.deepEqual(config.allowedOrigins, ['http://localhost:3000', 'https://park-smart-eight.vercel.app']);
  assert.ok(Object.isFrozen(config.cashfree), 'config is read-only');
});

test('typed values are coerced and origins merged without duplicates', () => {
  const config = parseEnv({
    ...base,
    PORT: '5001',
    CLIENT_URL: 'https://app.example.com',
    CORS_ORIGINS: 'https://app.example.com, http://localhost:3000',
    BETTER_AUTH_TRUSTED_ORIGINS: 'https://admin.example.com',
    BETTER_AUTH_CROSS_SITE_COOKIES: 'true',
    PAYMENTS_ENABLED: 'true',
    JWT_SECRET: 'legacy-secret',
  });
  assert.equal(config.port, 5001);
  assert.deepEqual(config.allowedOrigins, ['https://app.example.com', 'http://localhost:3000', 'https://admin.example.com']);
  assert.equal(config.auth.crossSiteCookies, true);
  assert.equal(config.features.payments, true);
  assert.equal(config.addressSelectionSecret, 'legacy-secret', 'JWT_SECRET is still honoured');
});

test('every problem is reported at once, by name, without echoing values', () => {
  const problems = problemsFor({ NODE_ENV: 'production', PORT: 'eighty', MONGODB_URI: 'postgres://secret-host/db', BETTER_AUTH_SECRET: 'short' });
  const keys = problems.map((problem) => problem.key).sort();
  assert.deepEqual(keys, ['ADDRESS_SELECTION_SECRET', 'BETTER_AUTH_SECRET', 'MONGODB_URI', 'PORT']);
  const message = new EnvValidationError(problems).message;
  assert.match(message, /Invalid environment configuration/);
  assert.equal(message.includes('secret-host'), false);
  assert.equal(message.includes('short'), false);
});

test('MONGODB_URI is required outside tests, and Cashfree needs credentials when enabled', () => {
  assert.deepEqual(problemsFor({ NODE_ENV: 'development' }).map((p) => p.key), ['MONGODB_URI']);
  assert.equal(parseEnv({ NODE_ENV: 'test' }).mongodbUri, 'mongodb://127.0.0.1:27028/parksmart-test');
  assert.deepEqual(
    problemsFor({ ...base, CASHFREE_VERIFY_ENABLED: 'true' }).map((p) => p.key).sort(),
    ['CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET'],
  );
  assert.deepEqual(problemsFor({ ...base, PAYMENTS_ENABLED: 'maybe' }).map((p) => p.key), ['PAYMENTS_ENABLED']);
});

test('the bootstrap super-admin list is read when asked, not cached', () => {
  const previous = process.env.BETTER_AUTH_SUPER_ADMIN_USER_IDS;
  process.env.BETTER_AUTH_SUPER_ADMIN_USER_IDS = 'a, b';
  assert.deepEqual([...bootstrapSuperAdminIds()], ['a', 'b']);
  process.env.BETTER_AUTH_SUPER_ADMIN_USER_IDS = 'c';
  assert.deepEqual([...bootstrapSuperAdminIds()], ['c']);
  if (previous === undefined) delete process.env.BETTER_AUTH_SUPER_ADMIN_USER_IDS;
  else process.env.BETTER_AUTH_SUPER_ADMIN_USER_IDS = previous;
});
