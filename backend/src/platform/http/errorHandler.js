const mongoose = require('mongoose');
const { ZodError } = require('zod');
const { AppError } = require('../errors');

const CODE_FOR_STATUS = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

const issuesFrom = (zodError) => zodError.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

/**
 * Map any thrown value to { status, code, message, details }. Only messages
 * written for clients pass through; everything unexpected becomes a generic
 * 500 so internals never leak.
 *
 * @param {unknown} err
 * @returns {{ status: number, code: string, message: string, details?: unknown }}
 */
function describeError(err) {
  if (err instanceof AppError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }
  if (err instanceof ZodError) {
    return { status: 400, code: 'VALIDATION_FAILED', message: 'The request is not valid', details: issuesFrom(err) };
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((item) => ({ path: item.path, message: item.message }));
    return { status: 400, code: 'VALIDATION_FAILED', message: 'The request is not valid', details };
  }
  if (err instanceof mongoose.Error.CastError) {
    return { status: 400, code: 'INVALID_ID', message: `Invalid ${err.path}` };
  }
  if (err?.code === 11000) {
    return { status: 409, code: 'DUPLICATE', message: 'A record with these details already exists', details: { fields: Object.keys(err.keyPattern || {}) } };
  }
  if (err?.name === 'TokenExpiredError') return { status: 401, code: 'TOKEN_EXPIRED', message: 'This link or token has expired' };
  if (err?.name === 'JsonWebTokenError' || err?.name === 'NotBeforeError') {
    return { status: 401, code: 'INVALID_TOKEN', message: 'This link or token is not valid' };
  }
  if (err?.name === 'MulterError') {
    return err.code === 'LIMIT_FILE_SIZE'
      ? { status: 413, code: 'FILE_TOO_LARGE', message: 'Document must be 5 MB or smaller' }
      : { status: 400, code: 'UPLOAD_REJECTED', message: err.message };
  }
  if (err?.type === 'entity.parse.failed') return { status: 400, code: 'INVALID_JSON', message: 'The request body is not valid JSON' };
  if (err?.type === 'entity.too.large') return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large' };
  // Older code signals client-facing errors with err.statusCode and a safe message.
  const legacyStatus = Number(err?.statusCode);
  if (legacyStatus >= 400 && legacyStatus < 600) {
    return { status: legacyStatus, code: CODE_FOR_STATUS[legacyStatus] || 'REQUEST_FAILED', message: err.message || 'Request could not be completed' };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Internal Server Error' };
}

/**
 * The single error middleware. Responds with
 * { success: false, message, error: { code, message, details?, requestId } }.
 * `success` and `message` keep the shape the frontend already reads.
 */
function errorHandler(err, req, res, next) {
  const { status, code, message, details } = describeError(err);
  if (status >= 500) {
    res.err = err;
    req.log?.error({ err, code }, 'request failed');
  } else {
    req.log?.debug({ code, message }, 'request rejected');
  }
  if (res.headersSent) return next(err);
  return res.status(status).json({
    success: false,
    message,
    error: { code, message, ...(details === undefined ? {} : { details }), requestId: req.id },
  });
}

/** JSON 404 for unknown API routes. */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: { code: 'NOT_FOUND', message: 'Route not found', requestId: req.id },
  });
}

module.exports = { describeError, errorHandler, notFoundHandler };
