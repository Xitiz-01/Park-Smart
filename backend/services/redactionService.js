const SENSITIVE_KEYS = /(token|secret|password|authorization|account.?number|aadhaar|pan$|document.?content)/i;

const maskIdentifier = (value) => {
  const clean = String(value || '').replace(/\s+/g, '');
  if (!clean) return '';
  if (clean.length <= 4) return '*'.repeat(clean.length);
  return `${'*'.repeat(Math.min(clean.length - 4, 8))}${clean.slice(-4)}`;
};

const redactSensitive = (value) => {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEYS.test(key) ? '[REDACTED]' : redactSensitive(item),
  ]));
};

module.exports = { maskIdentifier, redactSensitive };
