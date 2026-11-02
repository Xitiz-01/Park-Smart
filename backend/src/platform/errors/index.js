/**
 * Errors with a stable, machine-readable code. Throw these from new code;
 * the error middleware turns them into the JSON envelope.
 */
class AppError extends Error {
  /**
   * @param {string} message safe to show to the client
   * @param {{ status?: number, code?: string, details?: unknown, cause?: unknown }} [options]
   */
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const define = (status, code, fallbackMessage) => class extends AppError {
  constructor(message = fallbackMessage, options = {}) {
    super(message, { status, code, ...options });
  }
};

class ValidationError extends define(400, 'VALIDATION_FAILED', 'The request is not valid') {}
class UnauthorizedError extends define(401, 'UNAUTHENTICATED', 'Sign in to continue') {}
class ForbiddenError extends define(403, 'FORBIDDEN', "You don't have access to this") {}
class NotFoundError extends define(404, 'NOT_FOUND', 'Not found') {}
class ConflictError extends define(409, 'CONFLICT', 'This conflicts with the current state') {}
class PayloadTooLargeError extends define(413, 'PAYLOAD_TOO_LARGE', 'The request is too large') {}
class RateLimitError extends define(429, 'RATE_LIMITED', 'Too many requests. Try again later.') {}
class ServiceUnavailableError extends define(503, 'SERVICE_UNAVAILABLE', 'This service is temporarily unavailable') {}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  RateLimitError,
  ServiceUnavailableError,
};
