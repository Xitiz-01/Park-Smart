// The only module that reads process.env. Everything else asks for a
// validated, typed config object, so a missing or malformed variable stops
// the process at boot with one readable list instead of failing later.
const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

const TEST_MONGODB_URI = 'mongodb://127.0.0.1:27028/parksmart-test';
const list = (value) => String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
const flag = (fallback) => z.stringbool().default(fallback);
const optionalString = z.string().trim().optional().transform((value) => value || undefined);
const optionalUrl = optionalString.pipe(z.url().optional());

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    // Defaults: debug in development, silent under test, info in production.
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    SLOW_REQUEST_MS: z.coerce.number().int().min(1).default(1500),

    // Required everywhere except NODE_ENV=test, where the suites that need a
    // database set their own and pure unit tests need none.
    MONGODB_URI: optionalString.pipe(z.string().regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// URI').optional()),

    // Browser origins allowed to call the API with credentials. CLIENT_URL and
    // BETTER_AUTH_TRUSTED_ORIGINS are added to this list.
    CORS_ORIGINS: z.string().default('http://localhost:3000,https://park-smart-eight.vercel.app'),
    CLIENT_URL: optionalUrl,

    BETTER_AUTH_SECRET: optionalString,
    BETTER_AUTH_URL: optionalUrl,
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().default(''),
    BETTER_AUTH_CROSS_SITE_COOKIES: flag(false),
    BETTER_AUTH_MONGO_TRANSACTIONS: flag(false),

    // Signs the address picked in the location form. JWT_SECRET is the legacy name.
    ADDRESS_SELECTION_SECRET: optionalString,
    JWT_SECRET: optionalString,

    EXTERNAL_PARKING_CACHE_TTL_MS: z.coerce.number().int().min(0).default(120000),
    GEOCODING_PROVIDER: z.string().trim().toLowerCase().default('geoapify'),
    GEOCODING_API_KEY: optionalString,
    API_NINJAS_API_KEY: optionalString,

    VERIFICATION_STORAGE_PROVIDER: z.string().trim().toLowerCase().default('local'),
    VERIFICATION_STORAGE_LOCAL_PATH: optionalString,

    CASHFREE_VERIFY_ENABLED: flag(false),
    CASHFREE_CLIENT_ID: optionalString,
    CASHFREE_CLIENT_SECRET: optionalString,
    CASHFREE_VERIFY_BASE_URL: z.url().default('https://sandbox.cashfree.com/verification'),

    // Feature flags for work that lands in later phases. All off by default.
    CLERK_ENABLED: flag(false),
    PAYMENTS_ENABLED: flag(false),
    PASSES_ENABLED: flag(false),
  });

// Rules that depend on more than one variable. They read the raw strings so
// they're reported together with the per-variable problems above (zod skips
// refinements once a field has failed).
const crossFieldProblems = (source) => {
  const problems = [];
  const has = (key) => Boolean(String(source[key] ?? '').trim());
  const nodeEnv = String(source.NODE_ENV ?? '').trim() || 'development';
  if (!has('MONGODB_URI') && nodeEnv !== 'test') problems.push({ key: 'MONGODB_URI', message: 'is required' });
  if (nodeEnv === 'production') {
    if (String(source.BETTER_AUTH_SECRET ?? '').trim().length < 32) {
      problems.push({ key: 'BETTER_AUTH_SECRET', message: 'must be at least 32 characters in production' });
    }
    if (!has('ADDRESS_SELECTION_SECRET') && !has('JWT_SECRET')) {
      problems.push({ key: 'ADDRESS_SELECTION_SECRET', message: 'is required in production' });
    }
  }
  if (String(source.CASHFREE_VERIFY_ENABLED ?? '').trim().toLowerCase() === 'true') {
    for (const key of ['CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET']) {
      if (!has(key)) problems.push({ key, message: 'is required when CASHFREE_VERIFY_ENABLED=true' });
    }
  }
  return problems;
};

class EnvValidationError extends Error {
  /** @param {{ key: string, message: string }[]} problems */
  constructor(problems) {
    super(`Invalid environment configuration:\n${problems.map(({ key, message }) => `  - ${key}: ${message}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.problems = problems;
  }
}

const deepFreeze = (value) => {
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') deepFreeze(child);
  });
  return Object.freeze(value);
};

/**
 * @typedef {object} Config
 * @property {'development'|'test'|'production'} nodeEnv
 * @property {boolean} isProduction
 * @property {boolean} isTest
 * @property {number} port
 * @property {{ level: string, pretty: boolean, slowRequestMs: number }} log
 * @property {string} mongodbUri
 * @property {string[]} allowedOrigins browser origins for CORS, Socket.IO and Better Auth
 * @property {{ secret?: string, url: string, crossSiteCookies: boolean, mongoTransactions: boolean }} auth
 * @property {string|undefined} addressSelectionSecret
 * @property {number} externalParkingCacheTtlMs
 * @property {{ provider: string, apiKey?: string }} geocoding
 * @property {{ apiNinjasApiKey?: string }} vehicleCatalog
 * @property {{ provider: string, localPath?: string }} verificationStorage
 * @property {{ enabled: boolean, clientId?: string, clientSecret?: string, baseUrl: string }} cashfree
 * @property {{ clerk: boolean, payments: boolean, passes: boolean }} features
 */

/**
 * Validate an environment object and return the typed config.
 * Error messages name the variable and the rule, never the value.
 *
 * @param {Record<string, string|undefined>} source
 * @returns {Config}
 * @throws {EnvValidationError}
 */
function parseEnv(source) {
  const result = schema.safeParse(source);
  const problems = [
    ...(result.success ? [] : result.error.issues.map((issue) => ({ key: issue.path.join('.') || '(root)', message: issue.message }))),
    ...crossFieldProblems(source),
  ];
  if (problems.length) throw new EnvValidationError(problems);
  const env = result.data;
  return deepFreeze({
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    log: {
      level: env.LOG_LEVEL || { development: 'debug', test: 'silent', production: 'info' }[env.NODE_ENV],
      pretty: env.NODE_ENV === 'development',
      slowRequestMs: env.SLOW_REQUEST_MS,
    },
    mongodbUri: env.MONGODB_URI || TEST_MONGODB_URI,
    allowedOrigins: [...new Set([env.CLIENT_URL, ...list(env.CORS_ORIGINS), ...list(env.BETTER_AUTH_TRUSTED_ORIGINS)].filter(Boolean))],
    auth: {
      secret: env.BETTER_AUTH_SECRET,
      url: env.BETTER_AUTH_URL || `http://localhost:${env.PORT}`,
      crossSiteCookies: env.BETTER_AUTH_CROSS_SITE_COOKIES,
      mongoTransactions: env.BETTER_AUTH_MONGO_TRANSACTIONS,
    },
    addressSelectionSecret: env.ADDRESS_SELECTION_SECRET || env.JWT_SECRET,
    externalParkingCacheTtlMs: env.EXTERNAL_PARKING_CACHE_TTL_MS,
    geocoding: { provider: env.GEOCODING_PROVIDER, apiKey: env.GEOCODING_API_KEY },
    vehicleCatalog: { apiNinjasApiKey: env.API_NINJAS_API_KEY },
    verificationStorage: { provider: env.VERIFICATION_STORAGE_PROVIDER, localPath: env.VERIFICATION_STORAGE_LOCAL_PATH },
    cashfree: {
      enabled: env.CASHFREE_VERIFY_ENABLED,
      clientId: env.CASHFREE_CLIENT_ID,
      clientSecret: env.CASHFREE_CLIENT_SECRET,
      baseUrl: env.CASHFREE_VERIFY_BASE_URL.replace(/\/$/, ''),
    },
    features: { clerk: env.CLERK_ENABLED, payments: env.PAYMENTS_ENABLED, passes: env.PASSES_ENABLED },
  });
}

let cached;

/**
 * The process config: backend/.env (if present, never overriding real
 * variables) plus process.env, validated once and then cached.
 * @returns {Config}
 */
function getConfig() {
  if (!cached) {
    dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
    cached = parseEnv(process.env);
  }
  return cached;
}

/**
 * Better Auth identities promoted to super admin on sign-in. Read on every
 * call, not cached, so the bootstrap list can be set after boot (the
 * end-to-end test does this). Removed with Better Auth in Phase 4.
 * @returns {Set<string>}
 */
function bootstrapSuperAdminIds() {
  return new Set(list(process.env.BETTER_AUTH_SUPER_ADMIN_USER_IDS || process.env.BETTER_AUTH_ADMIN_USER_IDS));
}

module.exports = { getConfig, parseEnv, bootstrapSuperAdminIds, EnvValidationError };
