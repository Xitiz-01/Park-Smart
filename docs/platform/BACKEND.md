# Backend platform

The shared infrastructure every backend module uses. Added in Phase 2; the domain code (controllers, models, services) moves into `src/modules/` in Phase 7.

## Layout

```
backend/
  server.js                  HTTP server, Socket.IO, MongoDB connection, signals (the process entry point)
  src/
    app.js                   createApp({ config, logger, healthChecks }): the Express app, no listeners
    config/env.js            the only reader of process.env; zod-validated, frozen config
    schemas/                 zod request schemas (bookings, vehicles, parking locations, verification)
    platform/
      logger.js              pino logger with redaction
      errors/                AppError and its subclasses
      db.js                  MongoDB connect with retry, disconnect, ping
      health.js              /health/live and /health/ready
      lifecycle.js           graceful shutdown and process error policy
      openapi.js             OpenAPI 3.1 document built from the schemas
      http/
        requestLogging.js    request ids, request logs, slow-request warnings
        security.js          helmet, compression, rate limits, hpp, input sanitising
        validate.js          validate({ params, query, body })
        errorHandler.js      the error middleware and JSON 404
        asyncRoutes.js       forwards rejected async handlers to the error middleware
        versioning.js        /api deprecation headers and counters
  auth/ controllers/ middleware/ models/ routes/ services/ ...   existing domain code
```

## Configuration

`src/config/env.js` validates every variable once at boot, reading `backend/.env` first (real environment variables win). A bad environment stops the server with one list:

```
Invalid environment configuration:
  - MONGODB_URI: must be a mongodb:// or mongodb+srv:// URI
  - BETTER_AUTH_SECRET: must be at least 32 characters in production
```

Messages name the variable and the rule, never the value. Code asks for `getConfig()` (typed, frozen) instead of reading `process.env`. Every variable, with defaults, is listed in `backend/.env.example`. The rules that matter most:

| Variable | Rule |
|---|---|
| `MONGODB_URI` | required, except under `NODE_ENV=test` (defaults to `mongodb://127.0.0.1:27028/parksmart-test`) |
| `BETTER_AUTH_SECRET` | 32+ characters in production |
| `ADDRESS_SELECTION_SECRET` | required in production (`JWT_SECRET` still accepted) |
| `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET` | required when `CASHFREE_VERIFY_ENABLED=true` |
| `CORS_ORIGINS` | defaults to the origins that used to be hard-coded |
| `TRUST_PROXY` | defaults to `1` in production, `loopback` elsewhere |
| `CLERK_ENABLED`, `PAYMENTS_ENABLED`, `PASSES_ENABLED` | feature flags, all `false` |

## Requests

Middleware order in `createApp`: request id and logging → slow-request warning → security headers → `/health` → CORS → compression → `/api` rate limit → sign-in/sign-up rate limit → Better Auth (`/api/auth/*`, needs the raw body) → JSON and form parsing (`JSON_BODY_LIMIT`) → hpp → input sanitising → routes → JSON 404 for `/api` → error middleware.

- **Request ids.** Each request gets the caller's `X-Request-Id` if it's 1–128 plain characters, otherwise a new UUID. It's returned in `X-Request-Id`, bound to `req.log`, and included in error bodies.
- **Logging.** Use `req.log` inside a request and `logger` from `src/platform/logger.js` elsewhere, never `console`. JSON in production, pretty in development, silent in tests (`LOG_LEVEL` overrides). Credentials, cookies, tokens, PAN, GSTIN, Aadhaar and bank fields are redacted. Requests slower than `SLOW_REQUEST_MS` log a warning; health probes aren't logged.
- **Rate limits.** Per IP: `RATE_LIMIT_MAX` (600) requests per `RATE_LIMIT_WINDOW_MS` (15 minutes) on `/api`, and `AUTH_RATE_LIMIT_MAX` (30) sign-in/sign-up attempts. The store is in memory, so limits are per instance until Redis (Phase 3/8). Behind a proxy, `TRUST_PROXY` must be right or every client shares one bucket.
- **Input sanitising.** Keys starting with `$` or containing `.` are removed from body, query and params.

## Validation

```js
const { validate } = require('../src/platform/http/validate');
const schemas = require('../src/schemas/bookings');

router.post('/', protect, validate({ body: schemas.createBooking }), createBooking);
router.get('/:id', protect, validate({ params: schemas.bookingId }), getBookingById);
```

Put `validate` after authentication (unauthenticated callers get 401, not 400) and, for uploads, after Multer. Schemas check type and size. Business rules stay in the service or controller. `z.looseObject` keeps unknown fields so existing clients keep working. Schemas so far: bookings, vehicles, vendor parking locations and slots, vendor booking check-in/out, verification uploads and checks. The rest come in Phase 7.

## Errors

Throw an `AppError` subclass from new code:

```js
const { NotFoundError, ConflictError } = require('../src/platform/errors');
throw new NotFoundError('Booking not found');
throw new ConflictError('This EV bay is already reserved', { details: { slotId } });
```

Every error leaves as:

```json
{
  "success": false,
  "message": "Booking not found",
  "error": { "code": "NOT_FOUND", "message": "Booking not found", "requestId": "…" }
}
```

`success` and `message` keep the shape the frontend reads today. The error middleware also maps zod errors (400 `VALIDATION_FAILED`, with `details`), Mongoose validation (400) and cast errors (400 `INVALID_ID`), duplicate keys (409 `DUPLICATE`), JWT errors (401), Multer limits (413 `FILE_TOO_LARGE`), bad or oversized JSON (400 `INVALID_JSON`, 413), and older errors that set `statusCode`. Anything else is a 500 `INTERNAL_ERROR` with a generic message; the stack is logged, never sent.

Async route handlers don't need wrapping: `forwardAsyncErrors` wraps every mounted router, so a rejected promise reaches the error middleware.

## Versions and docs

Routes are served at `/api/v1/*`. The unversioned `/api/*` paths still work: they answer with `Deprecation: true` and a `Link` to the `/api/v1` path, and each use is counted and logged. They're removed in Phase 14 after the frontend moves. Better Auth stays at `/api/auth/*` until Clerk replaces it.

The OpenAPI 3.1 document is generated from the request schemas and served at `GET /api/docs` outside production. Paste it into any OpenAPI viewer, or run `npx @redocly/cli lint` on it.

## Health and lifecycle

- `GET /health/live`: 200 while the process serves requests. Use it as the liveness probe.
- `GET /health/ready`: 200 when every dependency check passes, otherwise 503 with `{ status, checks: { mongo: "up" | "down" } }`. Use it as the readiness probe.
- On boot, MongoDB is retried with backoff (0.5 s doubling to 8 s, six attempts) before the process gives up.
- SIGTERM or SIGINT: stop accepting connections, drain, close Socket.IO, MongoDB and Better Auth, then exit 0. A shutdown that takes more than 10 seconds is forced to exit 1.
- An unhandled rejection or uncaught exception is logged and shuts the process down with exit code 1 so the host restarts it.

## Testing

`createApp()` needs no server or database, so most platform tests use supertest against it (`tests/*.unit.test.js`). `npm run test:unit` runs them with no MongoDB. `npm run test:integration` runs the end-to-end suites against a replica set (see [CI_CD.md](CI_CD.md)).
