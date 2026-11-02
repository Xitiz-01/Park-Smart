// Routes are served at /api/v1/*. The unversioned /api/* paths stay as a
// deprecated alias until the frontend has moved (removed in Phase 14). Each
// use is counted per path prefix and logged the first time and every 100th.
const usage = new Map();

/**
 * Middleware for the deprecated /api mount: for a request to one of the
 * versioned resources (/api/<resource>/...), marks the response with the
 * /api/v1 successor and counts the hit. Other paths pass through untouched.
 * @param {string[]} resources e.g. ["bookings", "slots"]
 */
function deprecatedAlias(resources) {
  const known = new Set(resources);
  return (req, res, next) => {
    const resource = req.path.split('/')[1];
    if (!known.has(resource)) return next();
    const legacyPrefix = `/api/${resource}`;
    const count = (usage.get(legacyPrefix) || 0) + 1;
    usage.set(legacyPrefix, count);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', `</api/v1${req.url}>; rel="successor-version"`);
    if (count === 1 || count % 100 === 0) {
      req.log?.info({ legacyPrefix, successorPrefix: `/api/v1/${resource}`, count }, 'deprecated unversioned API path used');
    }
    return next();
  };
}

/** Hits per deprecated prefix since the process started. */
const deprecatedUsage = () => Object.fromEntries(usage);

module.exports = { deprecatedAlias, deprecatedUsage };
