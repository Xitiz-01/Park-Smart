const mongoose = require('mongoose');
const { getConfig } = require('../config/env');
const { logger: defaultLogger } = require('./logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run connect() until it succeeds, waiting longer after each failure
 * (initialDelayMs, doubling, capped at maxDelayMs). Throws the last error
 * once the attempts are used up.
 *
 * @param {() => Promise<unknown>} connect
 * @param {{ attempts?: number, initialDelayMs?: number, maxDelayMs?: number, logger?: import('pino').Logger, wait?: (ms: number) => Promise<void> }} [options]
 */
async function connectWithRetry(connect, { attempts = 6, initialDelayMs = 500, maxDelayMs = 8000, logger = defaultLogger, wait = sleep } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await connect();
    } catch (error) {
      if (attempt >= attempts) throw error;
      const delayMs = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      logger.warn({ err: error, attempt, attempts, delayMs }, 'connection failed, retrying');
      await wait(delayMs);
    }
  }
}

/** Connect Mongoose to MONGODB_URI, retrying with backoff. */
async function connectMongo({ logger = defaultLogger } = {}) {
  const connection = await connectWithRetry(
    () => mongoose.connect(getConfig().mongodbUri, { serverSelectionTimeoutMS: 5000 }),
    { logger },
  );
  logger.info({ host: connection.connection.host }, 'MongoDB connected');
  return connection;
}

const disconnectMongo = () => mongoose.disconnect();

/**
 * True when MongoDB answers a ping within timeoutMs.
 * @param {number} [timeoutMs]
 */
async function pingMongo(timeoutMs = 1500) {
  if (mongoose.connection.readyState !== 1) return false;
  let timer;
  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ping timed out')), timeoutMs); }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { connectWithRetry, connectMongo, disconnectMongo, pingMongo };
