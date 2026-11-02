const pino = require('pino');
const { getConfig } = require('../config/env');

// Never logged: credentials, session material and identity numbers. Paths
// cover log calls that pass these at the top level or one object deep, plus
// the request and response headers pino-http records.
const SENSITIVE_KEYS = [
  'password', 'currentPassword', 'newPassword', 'token', 'accessToken', 'refreshToken', 'idToken',
  'secret', 'clientSecret', 'apiKey', 'authorization', 'cookie',
  'pan', 'gstin', 'aadhaar', 'accountNumber', 'bankAccount', 'bank_account', 'identifier',
];
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((key) => `*.${key}`),
];

const canPrettyPrint = () => {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
};

/**
 * Create a pino logger. JSON lines in production and tests; pretty output in
 * development when pino-pretty is installed.
 *
 * @param {{ level: string, pretty?: boolean }} options
 * @param {import('pino').DestinationStream} [stream] where to write (tests pass one)
 * @returns {import('pino').Logger}
 */
function createLogger({ level, pretty = false }, stream) {
  const options = {
    level,
    base: { service: 'parksmart-api' },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  };
  if (!stream && pretty && canPrettyPrint()) {
    options.transport = { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service' } };
  }
  return stream ? pino(options, stream) : pino(options);
}

const logger = createLogger(getConfig().log);

module.exports = { createLogger, logger, REDACT_PATHS };
