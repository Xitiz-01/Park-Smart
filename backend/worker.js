// The background worker process. Same image as the API, started with
// `node worker.js`. It owns no HTTP API: only /health on WORKER_PORT, so the
// container platform can probe it. Queue processors (hold expiry, webhooks,
// settlements) register here from Phase 8; until then it connects, reports
// ready and shuts down cleanly, and has no jobs to run.
const http = require('http');
const express = require('express');
const { getConfig, EnvValidationError } = require('./src/config/env');

let config;
try {
  config = getConfig();
} catch (error) {
  if (error instanceof EnvValidationError && require.main === module) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
const { logger: rootLogger } = require('./src/platform/logger');
const { connectMongo, disconnectMongo, pingMongo } = require('./src/platform/db');
const { getRedis, pingRedis, closeRedis } = require('./src/platform/redis');
const { healthRouter } = require('./src/platform/health');
const { createShutdown, installProcessHandlers } = require('./src/platform/lifecycle');

const logger = rootLogger.child({ process: 'worker' });

/** Job processors, by queue name. Empty until the queues land (Phase 8). */
const processors = {};

const app = express();
app.disable('x-powered-by');
// Redis isn't critical yet: no queue runs on it until Phase 8.
app.use(
  '/health',
  healthRouter({ mongo: pingMongo, ...(config.redis.url && { redis: { check: pingRedis, critical: false } }) }),
);
app.use((req, res) => res.status(404).json({ status: 'not_found' }));
const server = http.createServer(app);

if (require.main === module) {
  const shutdown = createShutdown({
    server,
    logger,
    closers: [
      { name: 'mongodb', close: disconnectMongo },
      { name: 'redis', close: closeRedis },
    ],
  });
  installProcessHandlers({ shutdown, logger });

  getRedis();
  connectMongo({ logger })
    .then(() => {
      server.listen(config.workerPort, () => {
        logger.info({ port: config.workerPort, queues: Object.keys(processors) }, 'worker ready');
      });
    })
    .catch((error) => {
      logger.fatal({ err: error }, 'could not connect to MongoDB; giving up');
      process.exit(1);
    });
}

module.exports = { app, server, processors };
