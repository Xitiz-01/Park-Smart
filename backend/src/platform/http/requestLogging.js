const crypto = require('crypto');
const pinoHttp = require('pino-http');

// Accept a caller's request id only if it's short and plain, so it can't be
// used to inject into logs or response headers.
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Give every request an id (the caller's x-request-id when valid, otherwise a
 * new UUID), echo it in the X-Request-Id response header, and bind it to
 * req.log so every log line for the request carries it.
 *
 * @param {import('pino').Logger} logger
 */
function requestLogger(logger) {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}

/**
 * Warn about requests slower than thresholdMs, with the route and duration.
 * @param {number} thresholdMs
 */
function slowRequestWarning(thresholdMs) {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      if (durationMs > thresholdMs) {
        req.log.warn({ durationMs: Math.round(durationMs), thresholdMs, method: req.method, url: req.originalUrl }, 'slow request');
      }
    });
    next();
  };
}

module.exports = { requestLogger, slowRequestWarning, VALID_REQUEST_ID };
