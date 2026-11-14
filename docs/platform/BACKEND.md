# Backend platform

The shared infrastructure every backend module uses. Added in Phase 2; the domain code (controllers, models, services) moves into `src/modules/` in Phase 7.

## Layout

```
backend/
  server.js                  HTTP server, Socket.IO, MongoDB connection, signals (the API process)
  worker.js                  the worker process: /health on WORKER_PORT; queue processors from Phase 8
  Dockerfile                 one image for both processes (see LOCAL_DEV.md for the compose stack)
  src/
    app.js                   createApp({ config, logger, healthChecks, redis }): the Express app, no listeners
    config/env.js            the only reader of process.env; zod-validated, frozen config
    schemas/                 zod request schemas (bookings, vehicles, parking locations, verification)
    platform/
      logger.js              pino logger with redaction
      errors/                AppError and its subclasses
      db.js                  MongoDB connect with retry, disconnect, ping
      redis.js               the shared ioredis client (optional), ping, close
      cache/                 cache-aside helper: versioned keys, TTL, single flight, fail open
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
  scripts/seed.js            local seed data (refuses production and remote databases)
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
| `REDIS_URL` | optional; `redis://` or `rediss://`. Unset: no shared cache, rate limits per instance |
| `REDIS_KEY_PREFIX` | first segment of every Redis key, default `ps` |
| `WORKER_PORT` | the worker's health port, default 5002 |
| `SEED_PASSWORD` | password for the local seed accounts; seeding only |
| `CLERK_ENABLED` | `false`. When `true` (with `AUTH_PROVIDER=clerk`), `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` are required; see [AUTH.md](AUTH.md) |
| `AUTH_PROVIDER` | `clerk` (default) or `fake`; `fake` is refused in production |
| `CLERK_JWT_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `CLERK_AUTHORIZED_PARTIES` | optional; the webhook answers 503 without its signing secret; authorized parties default to the CORS origins |
| `PAYMENTS_ENABLED`, `PASSES_ENABLED` | feature flags, both `false` |

## Requests

Middleware order in `createApp`: request id and logging → slow-request warning → security headers → `/health` → CORS → compression → `/api` rate limit → sign-in/sign-up rate limit → Better Auth (`/api/auth/*`, needs the raw body) → JSON and form parsing (`JSON_BODY_LIMIT`) → hpp → input sanitising → routes → JSON 404 for `/api` → error middleware.

- **Request ids.** Each request gets the caller's `X-Request-Id` if it's 1–128 plain characters, otherwise a new UUID. It's returned in `X-Request-Id`, bound to `req.log`, and included in error bodies.
- **Logging.** Use `req.log` inside a request and `logger` from `src/platform/logger.js` elsewhere, never `console`. JSON in production, pretty in development, silent in tests (`LOG_LEVEL` overrides). Credentials, cookies, tokens, PAN, GSTIN, Aadhaar and bank fields are redacted. Requests slower than `SLOW_REQUEST_MS` log a warning; health probes aren't logged.
- **Rate limits.** Per IP: `RATE_LIMIT_MAX` (600) requests per `RATE_LIMIT_WINDOW_MS` (15 minutes) on `/api`, and `AUTH_RATE_LIMIT_MAX` (30) sign-in/sign-up attempts. With `REDIS_URL` the counts live in Redis (`<prefix>:v1:rate-limit:api:<ip>` and `…:auth:<ip>`), so every instance shares one budget; without it they're in memory, per instance. If Redis fails, requests pass unlimited and an alert is logged (see below). Behind a proxy, `TRUST_PROXY` must be right or every client shares one bucket.
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

## Redis and the cache

Redis is optional. `src/platform/redis.js` holds one client per process (`getRedis()`, null without `REDIS_URL`). It fails fast while Redis is down (no offline queue, one attempt per command), reconnects in the background with backoff, logs only when its state changes, and is closed on shutdown.

```js
const { getCache } = require('../src/platform/cache');
const cache = getCache();

const key = cache.key('location', locationId, 'detail');          // ps:v1:location:<id>:detail
const location = await cache.wrap(key, 300, () => loadLocation(locationId));
await cache.del(key);                                               // after an edit or publish
```

- **Keys** are `<prefix>:v<version>:<domain>:<id…>`. Bump `version` (`cache.key('location', id, { version: 2 })`) when a cached shape changes; old entries are never read again and expire.
- **Every entry has a TTL** and an explicit invalidation trigger. The key families arrive in Phase 8 and are listed in `CACHING.md` then.
- **Single flight:** concurrent `wrap()` calls for one key in a process share one Redis lookup and one loader call, so a hot key expiring doesn't stampede MongoDB.
- **Values are JSON.** Dates come back as ISO strings; `undefined` and loader errors are never cached.
- **Metrics:** `cache.stats()` gives hits, misses, sets, errors and loads; `createCache({ onEvent })` is the hook Phase 9 wires to metrics.

### Degradation policy

| What uses Redis | When Redis is down or slow |
|---|---|
| Cache | Fails **open**: reads are misses, writes are skipped, MongoDB answers. Errors are counted; the first after a healthy spell is logged. |
| Rate limits | Fail **open**: requests pass unlimited. An error tagged `alert: "rate-limit-store"` is logged at most once a minute, with the count held back. |
| `/health/ready` | Redis is reported but not critical: `{ "status": "degraded", "checks": { "mongo": "up", "redis": "down" } }` with 200, so instances stay in the load balancer. |
| Locks, idempotency, anything about money (Phase 8+) | Never degrade silently: they need Redis or MongoDB to succeed, or the request fails. They don't use the cache helper. When queues depend on Redis (Phase 8), it becomes critical for the worker's readiness. |

### Redis in production

Production runs without Redis today: Render has no `REDIS_URL`, so every boot logs `REDIS_URL is not set: no shared cache, and rate limits are counted per instance`. With one instance that changes nothing users see. Add Redis before running a second instance, and before Phase 8 (queues and the Socket.IO adapter need it):

1. Create it in the same region as the API. On Render: **New → Key Value**, a paid plan for persistence, and copy its **Internal Key Value URL** (`redis://red-…:6379`, reachable only from Render services). Outside Render, a managed Redis 7+ with TLS (`rediss://…`) works the same way.
2. Set `REDIS_URL` on the API service (and on the worker once it's deployed). Leave `REDIS_KEY_PREFIX` unset unless two environments share one Redis.
3. After the redeploy, `GET /health/ready` lists `"redis": "up"`, the boot warning is gone, and the `RateLimit` header counts the same on every instance.

Set an eviction policy of `noeviction` once queues use it (Phase 8); until then the default is fine, since every cache entry has a TTL.

## Health and lifecycle

- `GET /health/live`: 200 while the process serves requests. Use it as the liveness probe.
- `GET /health/ready`: 200 when every critical check passes, otherwise 503, with `{ status: "ok" | "degraded" | "unavailable", checks: { mongo, redis } }`. MongoDB is critical; Redis (listed only when configured) isn't. Use it as the readiness probe. The worker serves the same two endpoints on `WORKER_PORT`.
- On boot, MongoDB is retried with backoff (0.5 s doubling to 8 s, six attempts) before the process gives up.
- SIGTERM or SIGINT: stop accepting connections, drain, close Socket.IO, MongoDB, Redis and Better Auth, then exit 0. In Docker, tini passes the signal to node. A shutdown that takes more than 10 seconds is forced to exit 1.
- An unhandled rejection or uncaught exception is logged and shuts the process down with exit code 1 so the host restarts it.

## Testing

`createApp()` needs no server or database, so most platform tests use supertest against it (`tests/*.unit.test.js`). `npm run test:unit` runs them with no MongoDB or Redis. `npm run test:integration` runs the end-to-end suites against a replica set (`TEST_MONGODB_URI`) and Redis (`TEST_REDIS_URL`, default `redis://127.0.0.1:6390`); see [CI_CD.md](CI_CD.md), or `make test` against the compose stack ([LOCAL_DEV.md](LOCAL_DEV.md)).
