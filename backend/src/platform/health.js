const express = require('express');

/**
 * /health/live: the process is up and serving.
 * /health/ready: every dependency check passes (MongoDB now; Redis and the
 * queue join in Phase 3). No authentication and nothing sensitive: just
 * each check's name and up/down.
 *
 * @param {Record<string, () => Promise<boolean>>} checks
 */
function healthRouter(checks) {
  const router = express.Router();
  router.get('/live', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });
  router.get('/ready', async (req, res) => {
    const names = Object.keys(checks);
    const results = await Promise.all(names.map((name) => checks[name]().catch(() => false)));
    const report = Object.fromEntries(names.map((name, index) => [name, results[index] ? 'up' : 'down']));
    const ready = results.every(Boolean);
    res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable', checks: report });
  });
  return router;
}

module.exports = { healthRouter };
