# Local development

The whole stack runs in Docker with one command. You need Docker Desktop (or another Docker engine with Compose v2) and nothing else; Node is only needed to run the frontend dev server or the tests outside Docker.

## Start

```bash
cp .env.example .env
docker compose up --build --wait
```

Or `make up`, which creates `.env` if it's missing. The first build takes a few minutes; later starts take about 40 seconds. When the command returns, every service is healthy:

| Service | URL (127.0.0.1 only) | What it is |
|---|---|---|
| `web` | http://localhost:8080 | The production frontend build behind nginx, which proxies `/api` and `/socket.io` to the API |
| `api` | http://localhost:5001 | The Express API (`node server.js`); `/health/ready`, `/api/docs` |
| `worker` | (internal, port 5002) | The worker process (`node worker.js`): health only until the Phase 8 queues |
| `mongo` | `mongodb://127.0.0.1:27018/parksmart?directConnection=true` | MongoDB 8.0 (override with `MONGO_IMAGE`), single-node replica set `rs0` |
| `redis` | `redis://127.0.0.1:6380` | Redis 8 with append-only persistence |
| `seed` | (runs once and exits) | Seeds an empty database |

Ports avoid the defaults (27017, 6379, 5000) so the stack runs next to a local MongoDB, Redis or macOS AirPlay. Change them in `.env`.

Sign in at http://localhost:8080 with one of the seeded accounts. The password is `SEED_PASSWORD` in `.env`.

| Account | Role | Lands on |
|---|---|---|
| `customer@parksmart.test` | customer, with a petrol and an electric car | `/dashboard` |
| `vendor@parksmart.test` | approved vendor: two published locations (one with six EV bays, EV04 in maintenance) and a draft | `/vendor` |
| `admin@parksmart.test` | admin | `/admin` |
| `applicant@parksmart.test` | customer with a pending vendor application | `/vendor/status` |

There are no seeded bookings: make them through the app, so the reservation ledger only holds entries the booking code wrote.

## Everyday commands

| `make` | Plain Compose | Does |
|---|---|---|
| `make up` | `docker compose up --build --detach --wait` | Build and start, wait until healthy |
| `make logs` | `docker compose logs --follow api worker` | Follow the backend logs |
| `make ps` | `docker compose ps` | Service status and health |
| `make down` | `docker compose --profile tools down` | Stop (tools too); data is kept in volumes |
| `make seed` | `docker compose run --rm seed node scripts/seed.js` | Seed (refuses if there are users) |
| `make reset-db` | `docker compose run --rm seed node scripts/seed.js --reset` | Drop the database and seed again |
| `make test` | see the Makefile | Backend tests in a container against the stack's MongoDB |
| `make tools` | `docker compose --profile tools up --detach --wait` | Add mongo-express (http://localhost:8081, user `TOOLS_USERNAME` / `TOOLS_PASSWORD`) and Redis Insight (http://localhost:5540) |
| `make up-prod` | `docker compose -f docker-compose.yml up --build --detach --wait` | Same stack with the production images (what CI's `compose-smoke` runs) |
| `make clean` | `docker compose --profile tools down --volumes` | Stop and delete all local data |

## Hot reload

`docker-compose.override.yml` is applied automatically. It runs the API, worker and seed from the image's `dev` stage with `./backend` mounted, under nodemon: save a backend file and the process restarts. The container keeps its own Linux `node_modules`; after changing `backend/package.json`, rebuild with `make up`.

For frontend work, run Vite on your machine against the containerised API. Vite proxies to `http://localhost:5001` by default, which is the stack's API port:

```bash
cd frontend && npm ci && npm run dev    # http://localhost:3000
```

`http://localhost:3000` is already an allowed origin in the stack.

## Seeding rules

`scripts/seed.js` (`npm run seed` in `backend/`) creates the accounts through Better Auth's real sign-up, then the vendor, locations, bays and vehicles. It refuses to run when:

- `NODE_ENV` is `production`,
- `MONGODB_URI` names any host other than `localhost`, `127.0.0.1`, `::1` or the compose `mongo` service (so never Atlas),
- `SEED_PASSWORD` isn't set, or
- the database already has users (`--if-empty` turns that into a no-op; `--reset` drops the database first).

## Running the backend outside Docker

Point `backend/.env` at the stack's databases and run the API with Node 26:

```bash
MONGODB_URI=mongodb://127.0.0.1:27018/parksmart?directConnection=true
REDIS_URL=redis://127.0.0.1:6380
```

`directConnection=true` matters: the replica set member calls itself `mongo:27017`, which only resolves inside Docker. Stop the `api` container first (`docker compose stop api`) or change `PORT`, and keep `PORT=5001` if you want the Vite proxy to reach it.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `required variable BETTER_AUTH_SECRET is missing a value` | No `.env`. Run `cp .env.example .env` (or `make up`). |
| `Bind for 127.0.0.1:8080 failed: port is already allocated` | Something else uses the port. Change `WEB_PORT` (or `API_PORT`, `MONGO_PORT`, `REDIS_PORT`) in `.env`. |
| `docker compose up --wait` ends with `seed exited with code 1` | `docker compose logs seed`. Usually a database with users plus a plain `seed` call; the stack itself uses `--if-empty`. |
| `mongo` stays `starting` | First boot initiates the replica set; give it 30 s. `docker compose logs mongo`. If the volume came from another replica set config, `make clean` and start again. |
| `mongo` exits at once with "Linux kernel versions 6.19 and newer has a known incompatibility" | MongoDB 8 doesn't run on Linux 6.19+ yet ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)). Docker Desktop's VM kernel is older, so this hits Linux hosts. Until a fixed 8.0 release exists, set `MONGO_IMAGE=mongo:7.0` in `.env` (the app needs nothing newer). CI's `compose-smoke` does the same, because GitHub's runners have such a kernel. |
| `/health/ready` says `degraded` with `redis: down` | Redis is unreachable. The API keeps serving (cache misses, rate limits not enforced). `docker compose start redis`; it reconnects by itself. |
| `MongoServerSelectionError` from a tool on your machine | Add `directConnection=true` to the URI (see above). |
| Sign-in works on :3000 but not on :8080 (or the reverse) | Both origins must be in `CORS_ORIGINS`; compose sets `http://localhost:${WEB_PORT}` and `http://localhost:3000`. If you changed `WEB_PORT`, restart with `make up`. |
| Changes to `backend/package.json` don't show up | The container has its own `node_modules`. `make up` rebuilds the dev image. |
| Hot reload doesn't trigger | nodemon polls (`--legacy-watch`), so edits from any editor are seen within a second or two. Check `make logs` for a crash on restart. |
