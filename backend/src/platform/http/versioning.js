// Routes are served at /api/v1/*. The unversioned /api/* paths stay as a
// deprecated alias until the frontend has moved (removed in Phase 14). Each
// use is counted per path prefix and logged the first time and every 100th.
const usage = new Map();

/**
 * Middleware for a deprecated mount: marks the response and counts the hit.
 * @param {string} legacyPrefix e.g. "/api/bookings"
 * @param {string} successorPrefix e.g. "/api/v1/bookings"
 */
function deprecatedAlias(legacyPrefix, successorPrefix) {
  return (req, res, next) => {
    const count = (usage.get(legacyPrefix) || 0) + 1;
    usage.set(legacyPrefix, count);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', `<${successorPrefix}${req.url === '/' ? '' : req.url}>; rel="successor-version"`);
    if (count === 1 || count % 100 === 0) {
      req.log?.info({ legacyPrefix, successorPrefix, count }, 'deprecated unversioned API path used');
    }
    next();
  };
}

/** Hits per deprecated prefix since the process started. */
const deprecatedUsage = () => Object.fromEntries(usage);

module.exports = { deprecatedAlias, deprecatedUsage };
