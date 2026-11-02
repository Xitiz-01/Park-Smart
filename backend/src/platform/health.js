const express = require('express');

/**
 * /health/live: the process is up and serving.
 * /health/ready: the dependencies it needs are reachable. No authentication
 * and nothing sensitive: just each check's name and up/down.
 *
 * A check is either a function (critical: down means 503, so the load
 * balancer stops sending traffic) or { check, critical: false } for a
 * dependency the process can run without (down reports "degraded" with 200).
 *
 * @param {Record<string, (() => Promise<boolean>) | { check: () => Promise<boolean>, critical?: boolean }>} checks
 */
function healthRouter(checks) {
  const entries = Object.entries(checks).map(([name, value]) =>
    typeof value === 'function' ? { name, check: value, critical: true } : { name, critical: true, ...value },
  );
  const router = express.Router();
  router.get('/live', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });
  router.get('/ready', async (req, res) => {
    const results = await Promise.all(entries.map(({ check }) => check().catch(() => false)));
    const report = Object.fromEntries(entries.map(({ name }, index) => [name, results[index] ? 'up' : 'down']));
    const ready = entries.every(({ critical }, index) => !critical || results[index]);
    const status = !ready ? 'unavailable' : results.every(Boolean) ? 'ok' : 'degraded';
    res
      .set('Cache-Control', 'no-store')
      .status(ready ? 200 : 503)
      .json({ status, checks: report });
  });
  return router;
}

module.exports = { healthRouter };
