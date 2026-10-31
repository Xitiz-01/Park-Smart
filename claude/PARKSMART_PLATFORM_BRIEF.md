# ParkSmart — Platform Brief
### CI/CD → Clerk → Role-aware flows → Production backend → Razorpay & settlements

> **For Claude Code.** Read this whole file before touching anything. You are working in the existing ParkSmart repo (`frontend/` = Vite + React + Tailwind + shadcn after the redesign, `backend/` = Node/Express/MongoDB). The frontend redesign is finished. This brief turns ParkSmart from a basic MERN app into a production-grade platform, in **18 time-boxed phases** (0–14, plus 6B, 13B and 13C). Phases 6B (Logo.dev vehicle branding) and 13B/13C (parking passes, behind a feature flag) are additions; the microservices question is answered in §2.4 — **do not split into microservices**; build a modular monolith with enforced boundaries instead.

---

## 0. Ground rules (apply to every phase)

### 0.1 Quality and scope
1. **Time-box: every phase must fit in ≤ 2 hours of work.** If your own estimate for a phase exceeds that, split it, finish the first half with a proper commit, and tell me. Splitting is allowed; cutting corners is not. Every phase ships with tests, docs and a clean build.
2. **Verify, don't recall.** Clerk, Razorpay, BullMQ, Vercel and GitHub Actions change often. Before using any third-party API, read its *current* official docs (WebFetch/WebSearch) and follow them. If something here contradicts the docs, follow the docs and tell me.
3. **No fake functionality.** No simulated success paths in production code. Test doubles live only in test code or behind an adapter that is hard-disabled when `NODE_ENV=production`.
4. **Stay in JavaScript** (ESM or CJS — match what the backend already uses). Use JSDoc on public service functions. No TypeScript migration.
5. **Preserve behaviour and contracts** unless a phase explicitly changes them. Existing tests must keep passing; never delete a test to make it pass. Keep the CI job names `frontend-ci` and `backend-ci`.
6. **Preserve the do-not-break domain rules:** `fuelType === "electric"` ⇒ exact EV-slot booking, everything else capacity-based; the atomic reservation ledger; `payoutEligible = overallStatus === VERIFIED && bankStatus === VERIFIED`; the verification status vocabulary; the publish gate (verified vendor + verified authorisation for that exact location); Socket.IO `availability:changed` semantics.
7. **Secrets:** never commit secrets, never print them, never put them in logs. `.env.example` lists every variable with a comment. CI must pass with **no real third-party credentials** (mock the providers).
8. **Don't invent product features** that aren't in this brief. Anything ambiguous goes into the phase report as an open question.

### 0.2 Git, commits and the push protocol

**Branching.** One branch per phase: `platform/pN-short-name`, created from an up-to-date `main`. If I haven't merged the previous phase yet, stack on it and tell me. Never commit to `main`. Never merge. **Never run `git push` yourself** — you only tell me when to push (below).

**Commits.**
- Conventional Commits (`feat(scope):`, `fix:`, `refactor:`, `test:`, `chore:`, `ci:`, `docs:`, `build:`).
- **One logical change per commit**; every commit builds and passes its tests. Each new feature and each significant refactor gets its own commit. Do not batch a phase into one commit.
- No `--no-verify`. No amending or rewriting commits that I've already pushed. No force-push.
- Commits are authored by my configured git identity.

**NO AI ATTRIBUTION — ZERO TOLERANCE.** Commit messages and PR text must never contain `Co-Authored-By: Claude`, `Co-Authored-By: …anthropic…`, `Generated with Claude Code`, a `Claude-Session:` trailer, a claude.ai session URL, or any mention of Claude/Anthropic as author. Enforce this three ways (set up in Phase 0, verify after every commit):
1. **Settings (project `.claude/settings.json`, committed):**
   ```json
   { "attribution": { "commit": "", "pr": "", "sessionUrl": false } }
   ```
   (`includeCoAuthoredBy` is deprecated — don't use both. Check the current Claude Code settings reference for the exact keys; at least one release has still appended a `Claude-Session:` trailer despite empty attribution, which is why layers 2 and 3 exist.)
2. **Local `commit-msg` hook** (Husky or `.githooks/` with `core.hooksPath`) that **strips or rejects** any line matching, case-insensitively: `^co-authored-by:.*(claude|anthropic)`, `^claude-session:`, `generated with.*claude`, `claude\.ai/code`. Genuine human co-authors are not touched.
3. **CI job `commit-hygiene`** (added in Phase 1) that scans every commit in a PR with the same patterns and fails on a match.

After **every** commit run: `git log -1 --format=%B | grep -iE "co-authored|claude|anthropic|session" || echo CLEAN`. If it isn't `CLEAN`, fix it before moving on (unpushed commits only).

**Push checkpoints.** Print this block whenever a push is due, then **stop and wait for my "pushed"**:

```
🔔 PUSH CHECKPOINT <n> — <phase / what's inside>
  1. git status                      → must be clean
  2. git log --oneline origin/<branch>..HEAD      (or main..HEAD if new branch)
  3. git log origin/<branch>..HEAD --format=%B | grep -iE "co-authored|claude|anthropic|session" || echo CLEAN
  4. git push -u origin <branch>
Then: open a PR into main titled "<…>"; CI must be green before merge.
```
Push checkpoints happen **(a)** after every 2–4 feature commits that leave the branch green, and **(b)** at the end of every phase. A phase with a single checkpoint at the very end is too coarse — add mid-phase ones.

### 0.3 Per-phase deliverable (end of every phase)
Short and concrete: what changed · tests added and results (frontend/backend) · build result · migrations or env vars added · docs updated · deviations and why · bugs noticed but deliberately not fixed · open questions · commit hashes · `git status` · confirmation that `main` is untouched · the **PUSH CHECKPOINT** block.

---

## 1. Phase map

| # | Phase | Branch | Gate before next phase |
|---|---|---|---|
| 0 | Pre-flight audit + guardrails | `platform/p0-preflight` | I approve audit + decisions in §2 |
| 1 | CI/CD refinement | `platform/p1-ci-cd` | CI green on a PR; branch-protection checklist handed to me |
| 2 | Backend platform skeleton | `platform/p2-backend-skeleton` | All old tests green on the new skeleton |
| 3 | Docker, local infra, Redis foundation | `platform/p3-docker-infra` | `docker compose up` gives a working full stack from scratch |
| 4 | Clerk — backend | `platform/p4-clerk-backend` | Auth integration tests green with the fake provider |
| 5 | Clerk — frontend + role choice at sign-up | `platform/p5-clerk-frontend` | Sign up / in works for all three role paths locally |
| 6 | User flows & role-aware UX + e2e | `platform/p6-user-flows` | Playwright suite per role green |
| 6B | Logo.dev vehicle branding (≤ 1.5 h) | `platform/p6b-logo-dev` | Logos render in every vehicle surface; fallbacks verified; no secret key in the bundle |
| 7 | Data layer & domain modules | `platform/p7-data-layer` | Migrations apply cleanly on a copy of real-shaped data |
| 8 | Redis caching, queues, realtime scaling | `platform/p8-redis-queues` | Two API replicas behave correctly behind Socket.IO |
| 9 | Observability, resilience, storage, load test | `platform/p9-prod-readiness` | k6 results recorded; chaos checks pass |
| 10 | Payments I — money model, ledger, booking-payment state machine | `platform/p10-payments-domain` | **I approve the money design doc** |
| 11 | Payments II — Razorpay Checkout, webhooks, refunds | `platform/p11-razorpay` | Test-mode payment + refund works end-to-end |
| 12 | Settlements engine + payout script | `platform/p12-settlements` | Dry-run and apply verified on seeded data |
| 13 | Finance UIs (customer receipt, vendor earnings, admin console) | `platform/p13-finance-ui` | Click-through for all three roles |
| 13B | *(optional, flag `PASSES_ENABLED`)* Parking passes — backend | `platform/p13b-passes-backend` | **I approve the pass design addendum**; money maths tests green |
| 13C | *(optional)* Parking passes — UI | `platform/p13c-passes-ui` | Buy → use → expire → refund clicked through |
| 14 | Final hardening, docs, release | `platform/p14-release` | Definition of Done (§12) |

Phases 1–3 deliberately come *before* Clerk and the money work so every later change lands inside a tested, containerised, CI-gated structure. (I reordered the original list for that reason: the Clerk and Razorpay code should be written once, into the final backend structure.)

13B/13C are **optional**: they depend on the ledger, settlements and finance UI, so nothing earlier depends on them and I can skip them without affecting Phase 14. Phase 6B is small and independent of the backend work.

---

## 2. Cross-cutting decisions (confirm in Phase 0, then treat as fixed)

### 2.1 Roles and onboarding
- Roles: `customer`, `vendor`, `admin`, `super_admin`. MongoDB is the **source of truth** for role and status; Clerk `publicMetadata` only mirrors it for UI routing and is never trusted for authorisation.
- **Role is chosen at sign-up** ("I want to park" / "I operate parking"). Customers never see any "Become a vendor" prompt anywhere in the signed-in app. Default policy: no self-service customer→vendor upgrade; an admin can change a role. (If I later want a hidden `/partners` entry, it's a separate decision.)
- Sign-up intent is passed as Clerk `unsafeMetadata.intendedRole` and is **client-controlled, therefore untrusted**: the backend may only honour `customer` or `vendor`. `admin`/`super_admin` are granted **only** by a server-side script (`npm run admin:grant`) or by an existing super-admin in the admin UI.
- Vendor lifecycle: `applicant → verification in progress → verified → may publish locations → payout-eligible when bank verified`.

### 2.2 Money model (finalised in Phase 10; defaults here)
- All amounts are **integer paise**. No floats anywhere in money paths.
- `gross` = what the customer pays. `commission = round_half_up(gross × commissionBps / 10000)`. `commissionBps` is a platform setting with optional per-vendor and per-location override; **no default value is hard-coded in code** — it comes from a settings document seeded by a documented script.
- Tax on commission (GST etc.) is a **configurable line item that defaults to off**, flagged in the docs as "confirm tax treatment with an accountant". Don't hard-code tax rates.
- Gateway fees are borne by the platform by default (configurable).
- `vendorPayable = gross − commission (− any commission tax charged to vendor)`.
- Cancellation/refund policy is configuration (time windows → refund %), not code constants.
- The **ledger is append-only and double-entry**; balances are derived, never stored as a mutable number that can drift.

### 2.3 Target backend architecture
```
backend/src/
  config/        zod-validated env, feature flags
  modules/<domain>/   routes → controller → service → repository (+ schemas, tests)
  platform/      logger, errors, http (middleware), cache, queue, storage, auth, payments, observability
  jobs/          queue workers (hold expiry, webhook processing, settlements, reconcile)
  scripts/       one-off/ops CLIs (migrations, admin:grant, settlement:*)
  server.js / worker.js   (API process and worker process, same image)
```
Strangler approach: new infrastructure first, then migrate modules over (Phases 2 and 7). API versioned as `/api/v1`; keep `/api` as a deprecated alias until the frontend is fully moved, then remove it in Phase 14.

### 2.5 Database — decision: stay on MongoDB (Atlas in production)
**Do not migrate to Postgres/Supabase or any other database, and don't reopen this decision.** MongoDB as a **replica set** (local compose and Atlas) provides the multi-document transactions, unique and TTL indexes, and `2dsphere` geo queries this plan needs. Integrity for money comes from: integer paise, an append-only balanced ledger written inside transactions, unique indexes for idempotency, schema-level immutability, and the `ledger:reconcile` script. Keep data access behind repositories (Phase 7) so the choice stays reversible, but don't build abstractions for a hypothetical swap.

### 2.4 Service boundaries — decision: modular monolith, NOT microservices
**Do not split the backend into microservices.** Reasons (put these in `SERVICE_BOUNDARIES.md`): one developer and one team; booking + reservation ledger + payment + ledger posting need **atomic multi-document Mongo transactions**, which a split would replace with sagas/outbox and eventual consistency for no benefit; every extra service adds deployment, networking, tracing, versioning and on-call cost; current scale doesn't need independent scaling.

What we do instead — get the *benefits* of boundaries without the cost:
- **Two deployable processes from one image:** `api` and `worker` (Phase 3), plus the Socket.IO layer made horizontally scalable via the Redis adapter (Phase 8).
- **Enforced module boundaries:** each `modules/<domain>` exposes only a public `index.js`; other modules may import only that (no reaching into another module's repository/models). Enforce with `dependency-cruiser` or `eslint-plugin-boundaries` as a CI check (Phase 7).
- **Domain events via a transactional outbox** (Phase 8): modules communicate cross-domain through events, not direct calls, wherever they don't need a transaction.
- **Documented extraction criteria and order** (Phase 14): split a module out only when a concrete trigger appears — independent scaling need, a second team owning it, or failure isolation. The most likely first candidates are the **webhook/notification worker** and the **realtime gateway** (both already separable). Payments/ledger/booking stay together.

---

## PHASE 0 — Pre-flight audit and guardrails (≤ 1 h, read-mostly)
**Goal:** know exactly what exists, put the guardrails in place, and get my decisions.

1. Read: `README.md`, `.github/workflows/*`, root and per-package `package.json`, `backend/server.js`, `backend/routes/*`, `controllers/*`, `models/*`, `middleware/*`, `services/*`, `scripts/*`, `frontend/src/lib/*`, `services/api.js`, `context/AuthContext*`, `lib/authClient*`, all existing tests. Open the files; don't grep-and-guess.
2. Report **repository state**: which branches exist and what is merged — specifically `feature/vendor-verification` (Phase 5A, DigiLocker removal still pending?) and `feature/frontend-redesign`. Propose the safest merge order into `main` (5A correction → redesign → this work). **Do not merge anything.**
3. Run baseline: frontend `npm ci && npm test && npm run build`; backend `npm ci && npm run test:integration`. Record results and build size.
4. Set up the **no-AI-attribution guardrails** from §0.2 (settings, commit-msg hook, `scripts/check-commit-clean.sh`). Scan all *unpushed* local commits on every branch for forbidden trailers and list any hits. For already-pushed commits, just report; rewriting pushed history needs my explicit decision.
5. Inventory: every route + role guard; every place the current auth (Better Auth) is touched (backend and frontend); every Socket.IO event; every env var; every `window.confirm`-style or legacy leftover you notice; a list of backend smells (no validation layer, fat controllers, in-memory caches, single-instance assumptions, local-disk storage, missing indexes, N+1 queries, missing pagination).
6. Write `docs/platform/AUDIT.md` (findings, risks, the confirmed phase plan with your time estimates) and `docs/platform/DECISIONS.md` listing the decisions needed from me:
   - Backend hosting target (Render / Railway / Fly.io / VPS / other) and the managed services for Mongo (Atlas?) and Redis (Upstash/Redis Cloud/…).
   - Default commission model and cancellation/refund windows.
   - Whether Razorpay **Route** is activated on my account (it has eligibility/KYC requirements and RBI compliance rules — read their Route FAQ) or I'm in plain test mode.
   - Customer→vendor upgrade policy (§2.1 default stands unless I say otherwise).
   - Email provider for transactional mail (booking confirmations, pass reminders) — or explicitly out of scope.
   - Logo.dev: do I have an account, a publishable key and a secret key? (Free plan = attribution link required for commercial use.)
   - Parking passes: do I want Phases 13B/13C at all, and should v1 include a daily time window?
7. Commit docs + guardrails (`chore: add commit hygiene guardrails`, `docs: platform audit and decisions`). **Stop. Wait for approval.**

---

## PHASE 1 — CI/CD refinement (≤ 2 h)
**Goal:** a pipeline that is fast, strict, secure, and tells a developer exactly what broke.

**Workflow design**
- Keep job names `frontend-ci` and `backend-ci`. Add: `commit-hygiene`, `security`, `e2e` (placeholder until Phase 6), and an aggregate `ci-gate` job that depends on all required jobs (gives me a single required check).
- Triggers: `pull_request` and `push` to `main`. **Do not use workflow-level `paths:` filters** on required checks (a skipped required check blocks merges); use in-job change detection if you want to skip heavy steps.
- `concurrency` group per ref with `cancel-in-progress` for PRs. `permissions:` least-privilege at workflow level (`contents: read`), elevated per job only where needed. Node version from `.nvmrc` (Node 20 → confirm LTS status). Cache npm. Pin third-party actions to a full commit SHA with a comment of the version, and let Dependabot update them.
- Fork-safe: no secrets required for PR jobs.

**Backend job:** `npm ci` → lint → unit tests → integration tests against a **Mongo replica set** and Redis (service containers or `mongodb-memory-server` in replset mode — GitHub service containers can't init a replset on their own, so pick the approach that's reliable and document it) → coverage report as an artifact → fail under an initial threshold you set from the measured baseline and then ratchet.

**Frontend job:** `npm ci` → lint → Vitest → build → bundle-size budget (e.g. `size-limit`; set budgets from the measured baseline, not a guess) → upload build artifact.

**Security job:** `npm audit --omit=dev` failing on high/critical (with a documented allow-list file for accepted advisories), `gitleaks` secret scan, GitHub **CodeQL** (JavaScript), `dependency-review-action` on PRs.

**commit-hygiene job:** `commitlint` (conventional commits) + the forbidden-AI-trailer scan from §0.2 on every commit in the PR range.

**Repo hygiene files:** `.github/dependabot.yml` (weekly, grouped, npm + actions + docker), `CODEOWNERS`, PR template (checklist: tests, migrations, env vars, docs, screenshots), issue templates, `.nvmrc`, `.editorconfig`, ESLint + Prettier configs for both packages, Husky + lint-staged (pre-commit: lint/format changed files; commit-msg: hygiene).

**CD scaffolding (don't deploy anywhere yet):**
- `release.yml` skeleton: on tag `v*` → build, run tests, create GitHub Release notes (`release-please` or `git-cliff` — pick one and justify).
- GitHub **Environments** `staging` and `production` documented with required reviewers and the secrets each needs. Document that Vercel handles frontend preview/production deploys and which env vars it needs (`VITE_*`, with the legacy `REACT_APP_*` names still honoured).
- Docker build/push/scan jobs are added in Phase 3; the actual backend deploy job in Phase 14 once I've chosen a host.

**Deliverables:** workflows, configs, `docs/platform/CI_CD.md` (pipeline diagram, how to run every check locally, how to add a required check), and a **branch-protection checklist** for me (required checks: `ci-gate` + the named jobs, require PR, linear or merge-commit policy, dismiss stale approvals, no force-push to `main`).

**Tests/Gate:** open a throwaway PR (don't push without my checkpoint) and demonstrate each job's failure mode: break a test, add a fake secret, add a forbidden trailer — confirm each is caught — then revert.

**Commits:** `ci: harden workflows and add ci-gate` · `ci: add security scanning` · `ci: add commit hygiene job` · `chore: add lint, format and git hooks` · `ci: add release workflow skeleton` · `docs: document CI/CD`. **Push checkpoints:** after the first three; at the end.

---

## PHASE 2 — Backend platform skeleton (≤ 2 h)
**Goal:** the shared infrastructure every module will use. Behaviour of existing endpoints does not change.

1. **Config:** `config/env.js` validates all env with zod at boot; fail fast with a readable list of what's missing; typed accessors; no `process.env` outside this file. Feature flags (`PAYMENTS_ENABLED`, `CLERK_ENABLED`, etc.) live here.
2. **Logging:** `pino` with request-id correlation (`x-request-id` in/out), `redact` for auth headers, cookies, tokens, PAN/GSTIN/bank/account fields. Pretty in dev, JSON in prod. Replace `console.*`.
3. **Errors:** `AppError` hierarchy with stable machine-readable `code`s, one error-handling middleware, consistent JSON envelope `{ error: { code, message, details?, requestId } }`, no stack traces to clients, map Mongoose/Mongo/zod/JWT/Multer errors to proper 4xx. Wrap async handlers.
4. **Validation:** zod request validation middleware (`body`, `query`, `params`); add schemas to the highest-risk endpoints now (bookings, locations, vehicles, verification uploads), remaining endpoints in Phase 7.
5. **HTTP hardening:** `helmet`, strict CORS allow-list from env, JSON body size limits, `express-mongo-sanitize` (or equivalent), `hpp`, compression, `trust proxy` configured for the chosen host, global + per-route rate limiting (in-memory store for now; Redis store in Phase 3/8), slow-request logging.
6. **Versioning & docs:** mount routes at `/api/v1` and keep `/api` as a deprecated alias (log a deprecation counter). Generate **OpenAPI 3** from the zod schemas (or maintain `openapi.yaml`) served at `/api/docs` in non-production.
7. **Health:** `/health/live` (process up) and `/health/ready` (Mongo, later Redis/queue) — unauthenticated, no sensitive data.
8. **Lifecycle:** graceful shutdown (SIGTERM: stop accepting, drain, close Socket.IO, Mongo, Redis), unhandled-rejection/uncaught-exception policy, boot-time Mongo connection with retry/backoff.
9. Split `server.js` into `app.js` (pure Express app factory, testable with supertest) and `server.js` (listen).

**Tests:** env validation failures, error-envelope mapping, validation middleware, health endpoints, request-id propagation, rate-limit behaviour, graceful shutdown (unit-level). **All existing backend tests must pass unchanged.**

**Commits (one each):** config · logging · error model · validation middleware · security middleware · versioning + OpenAPI · health + lifecycle · app/server split. **Push checkpoint** after the first four and at the end.

---

## PHASE 3 — Docker, local infra, Redis foundation (≤ 2 h)
**Goal:** `docker compose up` gives anyone the whole stack; images are production-ready.

1. `backend/Dockerfile`: multi-stage, `node:20-alpine` (or current LTS), non-root user, `npm ci --omit=dev`, `tini`/init, healthcheck hitting `/health/live`, small final image, `.dockerignore`. Same image runs `server.js` (API) or `worker.js` (workers) via command.
2. `frontend/Dockerfile` optional (static build behind nginx) for local parity — Vercel remains the production frontend host.
3. `docker-compose.yml` (+ `docker-compose.override.yml` for dev hot-reload): `api`, `worker`, `mongo` as a **single-node replica set with an init/healthcheck** (transactions need it), `redis` with persistence, `mongo-express`/`redis-insight` under an optional `tools` profile, MinIO under an optional `storage` profile (used in Phase 9). Named volumes, healthchecks, `depends_on: condition: service_healthy`, env from `.env`.
4. `Makefile` or npm scripts: `up`, `down`, `logs`, `seed`, `test`, `reset-db`.
5. **Redis foundation (`platform/cache`, `platform/redis`):** one connection factory (ioredis), key-prefix + versioned-key convention (`ps:v1:<domain>:<id>`), cache-aside helper with TTL, **single-flight stampede protection**, JSON serialisation helpers, metrics hooks. **Degradation policy (document it):** cache failures fail *open* (fall through to Mongo, log, count); rate-limit store failures fail open with an alert log; anything needing correctness (locks, idempotency for money) never silently degrades.
6. Switch the rate limiter to the Redis store. Add Redis to `/health/ready`.
7. CI additions: a `docker` job that builds the backend image, runs Trivy (fail on fixable high/critical), and — on `main` only — pushes to GHCR tagged with the git SHA and `latest`. A compose smoke test job: `compose up -d --wait` → hit `/health/ready` → `compose down`.
8. `.env.example` files updated; `docs/platform/LOCAL_DEV.md` (one-command start, seeding, troubleshooting).

**Tests/Gate:** from a fresh clone: `cp .env.example .env && docker compose up --wait` → API ready, seeded data present, frontend can log in against it.

**Commits:** `build: add backend Dockerfile` · `build: add compose stack with mongo replset and redis` · `feat(platform): redis client and cache helpers` · `feat(platform): redis-backed rate limiting` · `ci: docker build, scan and compose smoke` · `docs: local development guide`. **Push checkpoints:** after the compose stack works; at the end.

---

## PHASE 4 — Clerk, backend (≤ 2 h)
**Goal:** Clerk is the identity provider; MongoDB remains the authority on roles/status.

Read the current Clerk Express SDK docs first. Key facts to honour: use `clerkMiddleware()` + `getAuth()` for API routes and return proper **401/403 JSON yourself** — don't use `requireAuth()` (it redirects, which is wrong for an API); set `authorizedParties` to the frontend origins.

1. **Auth provider abstraction** (`platform/auth`): an `AuthProvider` interface (`authenticate(req)`, `verifyToken(token)`) with `ClerkAuthProvider` (real) and `FakeAuthProvider` (tests/CI only; throws at boot if `NODE_ENV=production`). CI never needs real Clerk keys.
2. **User model:** add `clerkId` (unique, indexed), keep `email`, `role`, `status` (`active | suspended`), `emailVerified`, `onboarding` state. Provision-on-first-request (`findOrCreateByClerkId`) plus **webhook sync** (`/api/v1/webhooks/clerk`): verify Svix signature on the **raw body**, handle `user.created/updated/deleted`, idempotent via stored event id.
3. **Role assignment at first sync:** read `unsafeMetadata.intendedRole`; accept only `customer` or `vendor`; anything else → `customer`. Vendors start as `applicant` (existing `approvedVendor` gate semantics preserved). Mirror `role` + `onboardingState` back to Clerk `publicMetadata` using the backend SDK.
4. **Middleware:** `authenticate` (401 if no session), `loadUser` (resolve Mongo user, 403 if suspended), `authorize({ roles, permissions })` (reuse the existing permission table incl. `verification:review`). Replace the old session middleware everywhere via the strangler approach; keep route-level role semantics identical. Add `GET /api/v1/me` returning the authoritative profile (role, status, vendor onboarding state, payout-eligibility flags).
5. **Socket.IO auth:** require a Clerk session token in the handshake (`auth.token`), verify it with the backend SDK, join user/role/location rooms server-side. Unauthenticated sockets may only receive what's already public (if discovery is public today, keep that explicit and rate-limited).
6. **Ops scripts:** `npm run admin:grant -- --email … --role admin|super_admin` (dry-run default; `--apply`), updates Mongo and Clerk metadata, audit-logged. `npm run auth:migrate-better-auth` (dry-run default, `--apply --confirm-db=<name>`): match legacy users by email, link `clerkId`, and import users into Clerk. Check whether Clerk's user-import supports the legacy password-hash scheme; if not, import without passwords and have users sign in via email code / reset. For dev data, document the "wipe and reseed" alternative.
7. Remove Better Auth from the backend only after the new path passes tests — separate commit.
8. Env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `CLERK_AUTHORIZED_PARTIES` (+ `AUTH_PROVIDER=clerk|fake`).

**Tests:** role matrix (customer/vendor/admin/super_admin × protected routes), suspended user, unauthenticated, `intendedRole=admin` rejected, webhook signature + idempotency + replay, provisioning race (two simultaneous first requests → one user), socket handshake auth, migration script dry-run/apply.

**Commits:** `feat(auth): provider abstraction and fake provider` · `feat(auth): clerk middleware and user provisioning` · `feat(auth): clerk webhook sync` · `feat(auth): authorization middleware and /me` · `feat(realtime): authenticated socket handshake` · `feat(ops): admin grant and legacy-auth migration scripts` · `refactor(auth): remove better-auth from backend`. **Push checkpoints:** after webhook sync; at the end.

---

## PHASE 5 — Clerk, frontend + role choice at sign-up (≤ 2 h)
**Goal:** sign-up/sign-in on Clerk, styled with the existing design tokens, with role choice as part of sign-up.

1. `@clerk/clerk-react` in `main.jsx` (`ClerkProvider` with `VITE_CLERK_PUBLISHABLE_KEY`; `appearance` mapped to our CSS tokens, light + dark). Remove the better-auth client and `lib/authClient`.
2. **`/register` flow:** step 1 — two role cards ("I want to find parking" / "I operate parking"), keyboard accessible, explained in one line each; step 2 — Clerk sign-up with the choice passed as `unsafeMetadata.intendedRole` (verify the current prop/API). Persist the choice across the email-verification round-trip. `/login` is plain sign-in. No role choice shown to anyone already signed in.
3. **`AuthContext` rewrite behind the *same public API*** (`user`, `login`/`register` shims if still referenced, `logout`, `refreshUser`, `isSuperAdmin`, loading flags) so pages don't change. Source of truth = `GET /me`; Clerk supplies the token via an axios interceptor (`getToken()` per request; handles refresh); keep the global 401 handling but route to Clerk's sign-in with a return URL.
4. **Route guards:** `ProtectedRoute` and `getDefaultRoute` keep their logic but read the new context. Preserve `approvedVendor` gating and the vendor-application flow.
5. **Socket client:** one `useAvailabilitySocket` that passes the Clerk token in the handshake and reconnects with a fresh token.
6. Handle: email-verification pending, session expired mid-use (preserve unsaved booking intent, redirect back after sign-in), suspended account screen, Clerk loading/failed states (no blank screens).
7. Env: `VITE_CLERK_PUBLISHABLE_KEY` in `.env.example`; document Clerk dashboard setup (allowed origins, redirect URLs, email/social options, webhook endpoint).

**Tests:** auth-context unit tests with a mocked Clerk; role-card step; guard redirects for every role; token interceptor; reduced test of the sign-up metadata handoff. Keep existing frontend tests green.

**Commits:** `feat(frontend): clerk provider and theming` · `feat(frontend): role choice sign-up flow` · `refactor(frontend): auth context on clerk` · `feat(frontend): token-aware api and socket clients` · `chore(frontend): remove better-auth client`. **Push checkpoint** at the end.

---

## PHASE 6 — User flows and role-aware UX (≤ 2 h)
**Goal:** every user type gets one clear, uninterrupted journey; nobody sees things that aren't for them.

1. **Write `docs/platform/USER_FLOWS.md` first** (Mermaid diagrams): the full journey and state machine for **Driver**, **Operator/Vendor**, **Admin**, **Super-admin**, including edge states: unverified email, suspended, vendor rejected / resubmission required, location draft vs published, booking states, payment pending (placeholder until Phase 11). Include a **guard matrix** (route × role × state → allow / redirect / 403). I approve this before you implement.
2. **Navigation per role/state**, driven by one `navConfig` keyed by role and onboarding state:
   - Customer: no vendor/admin anything. Landing page (public) may show "List your parking" for *signed-out* visitors only as a sign-up path.
   - Vendor: an **onboarding checklist** (profile → verification → first location → authorisation → publish → bank/payout) that always shows the next best action and why something is locked; unverified vendors can draft but see why publishing is blocked.
   - Admin: operational nav; super-admin extras (roles, finance configuration) visible only to them.
3. **Post-auth routing:** deterministic landing per role/state (customer → Find Parking or "add your first vehicle" if none; vendor → checklist or dashboard; admin → dashboard). Preserve the deep link the user originally wanted.
4. **Dedicated screens:** 403 ("this area is for operators"), 404, suspended, session-expired, offline/API-down. Consistent empty states with a clear next action for each role.
5. **Cross-role consistency:** same status vocabulary and badges everywhere; same confirmation/undo patterns; role chip in the shell; no dead links (the vendor "coming soon" pages stay until Phases 13–14 replace them).
6. **E2E suite (Playwright):** one spec per role covering sign-up/in, the golden path, and the forbidden paths (customer opens a vendor URL → 403 page; vendor opens admin URL → redirect). Evaluate `@clerk/testing` for Clerk's testing tokens; run against the compose stack with seeded data; wire the `e2e` CI job from Phase 1 (fake auth provider in CI).

**Commits:** `docs: user flows and guard matrix` · `feat(frontend): role and state driven navigation` · `feat(frontend): vendor onboarding checklist` · `feat(frontend): post-auth routing and error screens` · `test(e2e): playwright suites per role` · `ci: enable e2e job`. **Push checkpoints:** after docs approval + nav; at the end.

---

## PHASE 6B — Logo.dev vehicle branding (≤ 1.5 h)
**Goal:** manufacturer logos replace the generic truck/car icon on vehicle cards and selectors, with bulletproof fallbacks. Fills the `VehicleBrandLogo` slot reserved in the redesign.

Read the current Logo.dev docs first (Logo API, API keys, attribution, errors). Facts to honour:
- Logos are plain `<img>` URLs: `https://img.logo.dev/<domain>?token=<publishable key>` (plus size/format/retina/theme/fallback parameters — use the exact current parameter names from the docs).
- **Publishable key (`pk_…`) is built for client code** → `VITE_LOGO_DEV_PUBLISHABLE_KEY`. In the Logo.dev dashboard, restrict it to our domains if the docs allow it (localhost, staging, production).
- **Secret key (`sk_…`) is server-side only** and is used only by Brand Search (`GET https://api.logo.dev/search?q=…`, Bearer auth). Never in the frontend, never in CI, never committed.
- **Attribution:** the free plan requires a visible, publicly accessible, followable "Logos provided by Logo.dev" link (`https://logo.dev`) on production sites where logos are shown for commercial use; paid plans remove it. Add it (footer + near the vehicle UI, subtle) and note in the docs that it can be dropped on a paid plan. Check the current free-tier daily request limit and write it down.
- Don't proxy, cache to disk or self-host the images (self-hosting is a paid-plan feature); rely on browser/CDN caching.

**Tasks**
1. **Backend (small):** the vehicle-catalogue service returns a normalised `brand: { make, slug, domain }` with every make. Maintain a curated `makeDomainMap` (aliases handled: *Maruti / Maruti Suzuki / Suzuki*, *Mercedes / Mercedes-Benz*, *MG / MG Motor*, *Tata / Tata Motors*, *VW / Volkswagen*, *Royal Enfield*, two-wheeler makes, EV makers, etc.). **Verify each domain actually returns a real logo** with a script rather than guessing. Vehicles already stored keep only `make`; the domain is derived at read time — no data migration.
2. **Ops script** `npm run catalog:resolve-domains` (dry-run default): for makes missing from the map, calls Brand Search with `LOGO_DEV_SECRET_KEY` (optional env, absent in CI) and prints candidate domains for me to review. It never writes the map automatically.
3. **`VehicleBrandLogo` component** (`make`, `size`, optional `domain`): builds the URL from the domain, `loading="lazy"`, `decoding="async"`, explicit width/height (no layout shift), retina/webp parameters, dark-mode variant via the `theme` parameter, neutral rounded tile background so logos of any aspect ratio look consistent, meaningful `alt` ("Hyundai logo"), `referrerPolicy` per the docs. **Fallbacks, in order:** no key configured → generic vehicle icon (no network request); unknown make → generic icon by vehicle type (car/motorcycle, EV bolt overlay); image error/404 → generic icon (use the API's 404-fallback parameter so a monogram isn't shown as if it were a logo). Never show a broken-image icon.
4. **Use it everywhere a vehicle appears:** My Vehicles cards (beside the Indian-style plate), the Find Parking vehicle chip/selector, booking review and confirmation, receipts, My Bookings tickets, vendor booking tables, admin booking/user tables, and logo rows inside the **make** `SearchableSelect` options (lazy, virtualised-friendly).
5. **Security/CSP:** allow `img-src https://img.logo.dev` (and nothing broader) in the Vercel/`index.html` CSP; add a **CI check that fails if `sk_` or `LOGO_DEV_SECRET` appears in the frontend build output**.
6. Do **not** use real brand logos in the landing-page Live Lot illustrations (those stay generic by design).

**Tests:** make → domain normalisation table (all aliases, casing, spacing, punctuation), component renders correct `src`/`alt`, error → fallback, no-key → no request, EV overlay, dark-theme parameter, secret-not-in-bundle check, and existing vehicle-flow tests unchanged.

**Commits:** `feat(catalog): brand domain normalisation` · `feat(frontend): vehicle brand logo component` · `feat(frontend): use brand logos across vehicle surfaces` · `chore(ci): fail build on leaked logo.dev secret` · `docs: logo.dev setup and attribution`. **Push checkpoint** at the end.

---

## PHASE 7 — Data layer and domain modules (≤ 2 h)
**Goal:** the database and module structure behave like a production system.

1. **Migrate remaining modules** into `modules/<domain>` (routes → controller → service → repository) with zod schemas; thin controllers; services own business rules; repositories own queries. Do it by domain, one commit each; behaviour unchanged. **Enforce module boundaries (§2.4):** each module exposes a public `index.js`; add `dependency-cruiser` or `eslint-plugin-boundaries` rules (no cross-module imports of models/repositories/internal files, no cycles) and make them a failing CI check (`chore(ci): enforce module boundaries`).
2. **Migrations:** adopt `migrate-mongo` (or equivalent); fold the existing one-off scripts (`migrateVehicleBodyStyle` etc.) in; `migrate:status/up/down`; CI runs migrations on a fresh DB.
3. **Indexes:** review every query with `explain()`; add compound indexes for bookings (location + interval + status), vehicles, verification cases; `2dsphere` for locations; **TTL indexes** for expiring documents (booking holds, idempotency keys, OAuth/verification temp state if still present); `autoIndex` off in production with an explicit `db:sync-indexes` script.
4. **Transactions:** use Mongo transactions (replset) for multi-document invariants (reservation ledger + booking, verification decision + audit, location publish). Retry on `TransientTransactionError`. Keep the existing atomic-ledger guarantees and tests.
5. **Pagination & filtering:** cursor-based pagination on every list endpoint (admin tables, bookings, locations), consistent `{ items, nextCursor }` shape, max page size, whitelisted sort/filter fields. Update `services/api.js` callers where needed — no behaviour change for the user.
6. **Idempotency:** `Idempotency-Key` header support on booking creation (and later payments): unique index + stored response, TTL cleanup.
7. **Aggregations:** move dashboard stats to aggregation pipelines with indexes (no loading collections into memory).
8. **Soft delete / audit fields** (`createdBy`, `updatedBy`, `deletedAt`) where deletion must be recoverable; audit log helper reused by verification and (later) finance.
9. **Seed/fixtures:** deterministic seed script (customers, vendors in each verification state, locations with EV and capacity, bookings) used by dev, CI and e2e.

**Tests:** concurrency test (N parallel bookings for the last bay/capacity unit → exactly the available number succeed), idempotent replay, pagination boundaries, transaction rollback on mid-way failure, migration up/down.

**Commits:** one per module migration + `feat(db): migrations tooling` · `perf(db): indexes and explain review` · `feat(db): transactions for invariants` · `feat(api): cursor pagination` · `feat(api): idempotency keys` · `perf(api): aggregation-based stats` · `chore: deterministic seed`. **Push checkpoints** every 3–4 commits.

---

## PHASE 8 — Redis caching, queues and realtime scaling (≤ 2 h)
**Goal:** use Redis where it earns its place; make the API horizontally scalable.

1. **Caching (cache-aside via Phase 3 helper; always TTL + explicit invalidation):**
   - Vehicle catalogue (replace the per-process 6-hour in-memory cache) — long TTL, versioned key.
   - Location *static* data (details, amenities, pricing) — medium TTL, invalidated on edit/publish.
   - Discovery results — **short TTL (10–30 s)**, geo-bucketed key, filter-hash; **never cache live availability beyond a few seconds**; Mongo + the reservation ledger stay the source of truth. Invalidate on `availability:changed` for that location.
   - Admin/vendor dashboard aggregates — short TTL.
   - Expose hit/miss metrics; document each key family (owner, TTL, invalidation trigger) in `docs/platform/CACHING.md`.
2. **Queues (BullMQ on Redis) + `worker.js`:** queues for `booking-holds` (delayed expiry), `webhooks` (async processing, retries with backoff, dead-letter + admin-visible failures), `notifications` (adapter interface only; email provider if I chose one), `maintenance` (cleanup, reconciliation later). Idempotent processors; per-job logging with correlation ids; a minimal Bull-Board (or JSON admin endpoint) behind `super_admin`.
3. **Socket.IO Redis adapter** so `availability:changed` reaches clients on any replica; sticky-session note for the host; reconnect behaviour tested.
4. **Distributed locks** (Redlock-style with fencing/unique value) only where a single runner is required (settlement runs, scheduled jobs); everything else uses Mongo unique indexes.
5. **Scheduled jobs:** repeatable BullMQ jobs with a documented schedule (hold sweeper as a safety net, cache warmers if useful).
6. **Transactional outbox (service-boundary seam, §2.4):** domain events (`booking.confirmed`, `booking.cancelled`, `availability.changed`, later `payment.captured`, `payout.completed`) are written to an `OutboxEvent` collection **in the same Mongo transaction** as the state change, then published by a worker to BullMQ/Socket.IO/notification handlers with at-least-once delivery and idempotent consumers. Move the existing `availability:changed` emission onto it (client-visible behaviour unchanged). *If this item pushes the phase past 2 h, split it into Phase 8B — don't rush it.*

**Tests:** cache hit/miss/invalidate; stampede (50 parallel misses → 1 backend load); Redis-down fail-open behaviour; queue retry + dead-letter; two API instances: event emitted on A reaches a socket on B; job idempotency.

**Commits:** `feat(cache): vehicle catalogue on redis` · `feat(cache): location and discovery caching` · `feat(queue): bullmq infrastructure and worker` · `feat(queue): booking-hold expiry jobs` · `feat(realtime): redis socket adapter` · `feat(ops): distributed lock helper` · `docs: caching and queues`. **Push checkpoints:** after caching; at the end.

---

## PHASE 9 — Observability, resilience, storage, load test (≤ 2 h)
**Goal:** know what the system is doing, survive failures, remove single-instance assumptions.

1. **Observability:** Prometheus metrics via `prom-client` at `/metrics` (protected: network-level or token), including HTTP latency histograms by route, queue depth, cache hit ratio, booking/payment counters, Mongo pool stats; optional Sentry (DSN via env, off if unset) for backend and frontend with PII scrubbing; structured audit trail for privileged actions. Provide a sample Grafana dashboard JSON + alert suggestions (error rate, p95 latency, queue lag, webhook failures).
2. **Resilience:** timeouts, retries with jitter and circuit breaker (`opossum` or equivalent) on every outbound call (Cashfree, Razorpay, Clerk backend API, catalogue providers); bulkhead for expensive endpoints; request timeouts; backpressure on the discovery endpoint; consistent `503 + Retry-After` when dependencies are down.
3. **Stateless storage:** implement an **S3-compatible `StorageService` adapter** (private bucket, opaque keys, pre-signed short-lived downloads through the existing authorisation check; MinIO in compose, S3/R2 in prod) behind the existing abstraction — local-disk adapter stays for dev. Migration script for existing local files (dry-run default).
4. **Upload malware scanning:** ClamAV adapter (compose `clamav` service, async scan job; file status `PENDING_SCAN → CLEAN | INFECTED`; admins can't download until `CLEAN`). Closes the "virus scanning not implemented" limitation from Phase 5A.
5. **Load & failure testing:** k6 scripts for discovery, booking contention (many users, few bays), and webhook bursts; record p50/p95/p99, error rate and findings in `docs/platform/PERFORMANCE.md`; fix the top two bottlenecks found. Manual chaos checks: kill Redis, kill Mongo primary (replset), restart the worker mid-job — document the observed behaviour.
6. Backup/restore runbook for Mongo and Redis persistence; RPO/RTO targets stated honestly.

**Commits:** metrics · sentry · resilience wrappers · s3 storage adapter · clamav scanning · k6 + performance doc · runbook. **Push checkpoints:** after metrics+resilience; at the end.

---

## PHASE 10 — Payments I: money model, ledger, booking-payment state machine (≤ 2 h)
**Goal:** a correct, auditable, gateway-independent money core. **No Razorpay calls yet.**

1. **Design doc first — `docs/platform/PAYMENTS_DESIGN.md`** (then stop for my approval before coding): money flow diagrams for payment, cancellation/refund, completion, payout; the fee/commission/tax/refund formulas with worked examples (rounding rules, small amounts, partial refunds); account chart of the ledger; state machines; failure and reconciliation scenarios; the **Route comparison**: (A) transfer-on-payment with `on_hold` until completion vs (B) platform ledger + **deferred direct transfers at settlement time** — recommend one with reasons (default recommendation: B, because the ledger stays authoritative and the settlement script is explicit), and note the RBI/Route eligibility requirements from the Razorpay docs.
2. **Models:** `PlatformSettings` (commission bps, tax toggle, refund windows, hold TTL, settlement delay days, minimum payout), `Payment`, `Refund`, `LedgerEntry` (append-only, balanced by `transactionId`; immutable via schema + no update/delete API), `Payout`, `SettlementRun`, `WebhookEvent`. Integer paise; unique indexes enforcing idempotency.
3. **Ledger service:** `postTransaction(entries)` inside a Mongo transaction; invariant: entries sum to zero; derived balances (`vendorPayable`, `vendorAvailable` = payable matured past the settlement delay minus payouts in flight, `platformRevenue`); reconciliation queries.
4. **Booking-payment state machine:** `HELD (expiresAt) → PAYMENT_PENDING → CONFIRMED → CHECKED_IN → COMPLETED`, plus `EXPIRED`, `CANCELLED`, `REFUNDED/PARTIALLY_REFUNDED`, `PAYMENT_FAILED`. A hold reserves through the **existing atomic reservation ledger**; expiry (BullMQ delayed job + sweeper) releases it and emits `availability:changed`. Behind `PAYMENTS_ENABLED`; when off, the current instant-booking behaviour is preserved exactly.
5. **Payment provider abstraction:** `PaymentProvider` interface (`createOrder`, `verifyCheckoutSignature`, `parseWebhook`, `refund`, `fetchPayment`) with `FakePaymentProvider` for tests. `PayoutProvider` interface (`ensureRecipient`, `pay`, `getStatus`) with `ManualPayoutProvider` (CSV batch + admin records UTR) and `FakePayoutProvider`; the Razorpay implementations arrive in Phases 11–12.
6. **Admin settings API** (super-admin only, audit-logged, validated ranges) for commission and policy; seeded via a documented script — no silent defaults in code.

**Tests:** property-style tests for the formulas (sum of parts == gross for random amounts/bps; refunds never exceed paid); ledger balance invariants; double-posting prevented; hold expiry releases capacity and EV bays; concurrent pay/expire race resolves to exactly one outcome.

**Commits:** `docs: payments design` (stop for approval) · `feat(payments): models and settings` · `feat(payments): ledger service` · `feat(payments): booking payment state machine` · `feat(payments): provider interfaces and fakes` · `feat(admin): platform settings api`. **Push checkpoints:** after the design doc; at the end.

---

## PHASE 11 — Payments II: Razorpay Checkout, webhooks, refunds (≤ 2 h)
**Goal:** real money flow in Razorpay **test mode**, safe against retries, duplicates and tampering.

Read the current Razorpay docs (Orders, Standard Checkout, signature verification, webhooks, refunds) before coding.

1. **`RazorpayPaymentProvider`:** server-side order creation in paise (amount computed server-side from the booking — never trusted from the client), receipt = booking id, notes with booking/vendor ids (no PII); Checkout signature verification (`HMAC-SHA256` of `order_id|payment_id` with the key secret, constant-time compare); `fetchPayment` for verification and reconciliation.
2. **Endpoints:** `POST /bookings/:id/pay` (creates/returns the order, idempotent), `POST /payments/verify` (checkout callback: verifies signature, moves booking to CONFIRMED *optimistically only after provider fetch confirms capture/authorised state per docs*), all with the `Idempotency-Key` support from Phase 7.
3. **Webhook endpoint** (`/api/v1/webhooks/razorpay`): **raw body** signature check with the webhook secret, store the `WebhookEvent` (unique by event id), respond fast, process in the `webhooks` queue. Handle `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`/`refund.failed` (verify the exact event names in the docs). The webhook is the **source of truth**; the client callback is only a fast path. Out-of-order and duplicate events must be harmless.
4. **Post the ledger** on capture (gross → commission / vendor payable / platform) and on refund (proportional reversal per policy), inside one transaction with the booking status change.
5. **Cancellation/refund engine:** apply the configured window policy to compute the refund; customer-initiated cancel → refund request → provider refund → webhook confirms → ledger + booking updated; admin-initiated full refund with reason; refund failures surface to admin.
6. **Frontend payment step** (using the existing redesign kit): booking review → "Pay ₹X" → Razorpay Checkout.js (loaded lazily, CSP updated) → success / failure / pending ("we're confirming your payment") states; hold countdown with `aria-live` updates; handles closed-modal, failed payment (retry within hold), and expired hold; receipt view. Applies to both EV exact-bay and capacity bookings.
7. **Reconciliation job** (queue, repeatable): compare Razorpay payments for the last N hours with local `Payment`/ledger; flag mismatches to admin; never auto-"fix" money without an audit entry.
8. Env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PAYMENTS_ENABLED`. CI uses `FakePaymentProvider` and recorded webhook fixtures — no real keys.

**Tests:** signature valid/invalid/tampered amount; duplicate and out-of-order webhooks; webhook before client callback and vice versa; hold expiring while payment is in flight (late capture → auto-refund or confirm per design doc rule); partial refund maths; double-click Pay; frontend payment states.

**Commits:** `feat(payments): razorpay provider` · `feat(payments): order, verify and idempotent pay endpoints` · `feat(payments): webhook ingestion and processing` · `feat(payments): ledger posting on capture` · `feat(payments): cancellation and refund engine` · `feat(frontend): payment step and states` · `feat(payments): reconciliation job`. **Push checkpoints:** after webhooks; after the frontend step; at the end.

---

## PHASE 12 — Settlements engine and payout script (≤ 2 h)
**Goal:** a clear, safe answer to "who gets what, and when" — runnable by script and by the admin UI.

1. **Eligibility rule (single function, unit-tested):** vendor `payoutEligible` (verified overall **and** bank verified) · not suspended / on payout hold · ledger amounts matured past `settlementDelayDays` after booking completion · `vendorAvailable ≥ minimumPayout`. Ineligible vendors keep accruing; the reason is recorded on the run.
2. **`SettlementRun` lifecycle:** `DRAFT (preview) → APPROVED → EXECUTING → COMPLETED | PARTIAL | FAILED`. Unique index on `(vendorId, period)` plus the Redis lock ⇒ safe to re-run; every payout carries an idempotency key; ledger entries move payable → payout-in-flight → paid.
3. **CLI (same style as existing ops scripts):**
   - `npm run settlement:preview -- --until=<date>` → table per vendor: gross, commission, refunds, net payable, eligible?, reason if not. Writes nothing.
   - `npm run settlement:run -- --until=<date> --apply --confirm-db=<name>` → creates + executes the run via the configured `PayoutProvider`.
   - `npm run settlement:export -- --run=<id>` → CSV batch for manual bank transfer; `settlement:mark-paid -- --run=<id> --file=utrs.csv` records UTRs.
   - `npm run ledger:reconcile` → verifies ledger sums, balances vs payouts, and prints discrepancies.
4. **Providers:**
   - `ManualPayoutProvider` (default and always available): CSV + admin records the bank UTR.
   - `RazorpayRoutePayoutProvider` (only if the Phase 0 decision says Route is activated): recipients created as **linked accounts** from verified bank details — bank account number/IFSC are sent to Razorpay at creation time and **never logged or stored in full** (store masked values + the Razorpay account id); payouts as transfers per the design doc; transfer webhooks (`transfer.processed`/failed — verify names in docs) update payout status and the ledger. Real-money production use needs Route eligibility and KYC to be in order; the docs must say so plainly.
5. **Refunds after payout:** if a refund hits a vendor whose amount was already paid out, the ledger records a negative payable that is netted against the next run (never pull funds silently).
6. **Admin APIs** (permissions `finance:view`, `finance:settle`, `finance:configure` — `configure` and `apply` limited to `super_admin` unless I say otherwise): list runs, run detail, approve/execute, retry failed payouts, hold/release a vendor, export CSV. All audit-logged.
7. **Seeded demo:** a script that generates realistic bookings/payments/refunds across a few vendors so the preview and the UI have something to show.

**Tests:** end-to-end preview→apply on seeded data checks every rupee (sum of vendor nets + commission + refunds == gross captured); idempotent re-run creates no duplicate payouts; partial provider failure leaves a recoverable `PARTIAL` run; ineligible vendor excluded with reason; refund-after-payout netting; concurrency (two runs at once → one wins).

**Commits:** `feat(settlements): eligibility and run model` · `feat(settlements): preview and apply scripts` · `feat(settlements): manual payout provider and csv flow` · `feat(settlements): razorpay route provider` · `feat(admin): finance and settlement apis` · `feat(ops): ledger reconcile and demo data`. **Push checkpoints:** after preview/apply; at the end.

---

## PHASE 13 — Finance UIs (≤ 2 h)
**Goal:** every role can see exactly where the money goes — using the existing redesign components (`DataTable`, `MetricCard`, `StatusBadge`, `ConfirmDialog`, shadcn charts).

1. **Shared `PaymentBreakdown` component:** "Customer paid ₹X → Vendor receives ₹Y · ParkSmart fee ₹Z" with refund lines, used in all three views below.
2. **Customer:** receipt in booking details and My Bookings (paid / refunded / pending states), refund status timeline, cancellation preview showing the refund amount *before* confirming.
3. **Vendor:** replace the Earnings and Transactions "coming soon" pages — balance cards (pending, available, paid out), per-booking earnings table with breakdown, payout history with status + UTR/reference, "why isn't my payout eligible?" panel tied to verification/bank status, CSV export. The Settings placeholder gets payout/bank section status only (bank *details* entry stays in the verification flow).
4. **Admin / super-admin finance console:** platform revenue vs vendor payable charts (text labels + colour-blind-safe palette), settlement run list and detail (preview → approve → execute → retry), vendor balances table with eligibility reasons and hold/release, refunds queue, webhook/reconciliation health (failed webhooks, mismatches), commission and policy settings form (super-admin), CSV exports, audit trail.
5. Loading/empty/error states, responsive at 390/768/1024/1440, keyboard accessible, no horizontal overflow; run `web-design-guidelines` on changed files.

**Tests:** component tests for breakdown maths display (matches backend payload), eligibility explanation states, guarded routes per role; extend the e2e suites with a pay → cancel → refund → settle flow on seeded data.

**Commits:** `feat(frontend): payment breakdown component` · `feat(frontend): customer receipts and refund status` · `feat(frontend): vendor earnings and payouts` · `feat(frontend): admin finance console` · `test(e2e): money flow`. **Push checkpoints:** after vendor pages; at the end.

---

## PHASE 13B — Parking passes, backend *(optional; behind `PASSES_ENABLED`)* (≤ 2 h)
**Why optional:** passes (monthly/weekly parking for offices and residents) are a useful differentiator but not required for the core product. Scope is deliberately limited.

**Scope decisions (stand unless I change them):**
- **Prepaid, one-time purchase per period** using the same Razorpay Order → capture → ledger flow as bookings. **No recurring auto-debit** (Razorpay Subscriptions / e-mandates bring activation and RBI additional-authentication requirements) — renewal is a manual "Renew pass" with a reminder via the notifications adapter. Document this as a deliberate limitation.
- **Capacity-based locations only in v1** (car/motorcycle). No exact-bay EV passes.
- Vendors define pass products per location; customers buy for one of their vehicles.

**Design addendum first — `docs/platform/PASSES_DESIGN.md` (stop for my approval):** how a pass consumes capacity (recommended: a `PASS` reservation kind in the **existing atomic reservation ledger** that holds one unit for the pass interval, so there's no second counting system), a per-location `maxPassShareBps` cap so passes can't starve walk-ins, optional daily window (decide whether v1 includes it), how pass-holder entry works (a zero-amount `Booking` with `source: "pass"` that doesn't re-reserve capacity), expiry, cancellation/refund rule (recommended: full refund before start, pro-rata minus configured fee within a window, none after), and **when vendor payable matures** (recommended: at pass start + settlement delay) with worked ledger examples.

**Tasks:** `PassProduct` (location, name, durationDays, vehicleClass, pricePaise, quota/cap, active), `Pass` (user, vehicle, product, startsAt, endsAt, status `PENDING_PAYMENT → ACTIVE → EXPIRED | CANCELLED | REFUNDED`, paymentId), pass purchase endpoints reusing the idempotent pay/verify/webhook pipeline from Phase 11, ledger posting reusing Phase 10, settlement eligibility reusing Phase 12 unchanged, expiry + reminder jobs (BullMQ), `availability:changed` emitted on purchase/expiry/cancel, validation that the vehicle class matches and the vehicle has no overlapping active pass at that location.

**Tests:** formulas (sum-of-parts, pro-rata refunds), the capacity race (last pass unit vs. walk-in booking vs. second pass buyer → exactly one wins), expiry releasing capacity, overlap rejection, webhook idempotency for pass payments, flag-off ⇒ no pass routes/UI and no behaviour change.

**Commits:** `docs: passes design` (stop for approval) · `feat(passes): models and capacity reservation kind` · `feat(passes): purchase and payment flow` · `feat(passes): expiry, reminders and refunds` · `test(passes): capacity and money invariants`. **Push checkpoints:** after the design doc; at the end.

---

## PHASE 13C — Parking passes, UI *(optional)* (≤ 2 h)
1. **Vendor:** a "Passes" tab in the location editor (create/edit/pause pass products, quota cap with an explanation of how it affects walk-in availability), a passes table (active, expiring, revenue) in the vendor workspace.
2. **Customer:** a "Monthly pass" card on the location detail (price, validity, vehicle picker, what happens at entry), purchase through the existing payment step, a **My Passes** page (customers only; status, validity bar, renew, cancel with refund preview), expiry/renewal reminders in-app. No pass UI is shown when `PASSES_ENABLED` is off or to non-customers.
3. **Admin:** pass revenue and active-pass counts in the finance console; pass payments appear in `PaymentBreakdown` and the settlement preview like any other revenue.
4. Reuse the redesign kit (`DataTable`, `MetricCard`, `StatusBadge`, `ConfirmDialog`), `VehicleBrandLogo`, empty/loading/error states; responsive at 390/768/1024/1440; `web-design-guidelines` pass. Extend the e2e suites: buy pass → enter via pass → capacity reflected in discovery → cancel/refund.

**Commits:** `feat(frontend): vendor pass management` · `feat(frontend): customer pass purchase and my passes` · `feat(frontend): admin pass reporting` · `test(e2e): pass lifecycle`. **Push checkpoint** at the end.

---

## PHASE 14 — Final hardening, docs and release (≤ 2 h)
1. **Security pass:** OWASP-style review of every route (authZ on every object access — IDOR checks for bookings, vehicles, documents, payouts), webhook replay, SSRF in any URL fetching, file-upload paths, mass assignment (zod `strict`), CORS/CSP/headers audit, dependency audit, secrets scan of full history, rate limits on auth-adjacent and payment endpoints. Fix findings; list anything deferred.
2. **Remove debt:** delete the `/api` unversioned alias, dead Better Auth/DigiLocker leftovers, unused env vars and scripts, old in-memory caches.
3. **Docs:** root `README.md` (architecture diagram, quick start, env reference, scripts), `docs/platform/ARCHITECTURE.md`, `API.md` (or OpenAPI link), `RUNBOOK.md` (deploy, rollback, migrations, incident checklist, webhook replay, settlement procedure), `SECURITY.md`, `CONTRIBUTING.md` (commit conventions, no-AI-trailer rule, branch flow), and **`SERVICE_BOUNDARIES.md`** (module map and allowed dependencies, event catalogue from the outbox, the "stay a modular monolith" rationale from §2.4, the concrete triggers for extracting a service, the recommended extraction order, and what it would cost to extract each candidate). Also verify the Logo.dev attribution link is present on the production build.
4. **CD:** implement the deploy job for the host I chose in Phase 0 (build image → push to GHCR → deploy to `staging` automatically, `production` behind environment approval) with **migrations as a separate gated step**, post-deploy smoke test on `/health/ready`, and a documented one-command rollback. If I haven't chosen a host, stop and ask.
5. **Release:** run the full suite (unit, integration, e2e, k6 smoke), tag `v1.0.0` locally (I push the tag), produce release notes from commits.

---

## 12. Definition of Done (whole programme)
- CI green with all required jobs; `ci-gate` is the single required check; no secrets needed for PR runs.
- Clerk is the only identity provider; role/status authority is MongoDB; no client-supplied role can reach `admin`.
- Each role has a documented, e2e-tested journey; customers never see operator/admin UI.
- `docker compose up` runs the whole stack; images are scanned; migrations are versioned.
- Redis used for caching, rate limits, queues and Socket.IO scaling with documented fail-open/closed policy; two API replicas verified.
- Every payment and refund is double-entry ledgered and reconcilable; webhooks are verified, idempotent and replay-safe; settlements run by preview → apply with an audit trail and a manual-payout fallback.
- Coverage ratchet met; load-test numbers recorded; runbook exists.
- Vehicle surfaces show manufacturer logos with working fallbacks; only the publishable Logo.dev key ships to the browser; attribution link present while on the free plan.
- Module boundaries are enforced in CI; domain events flow through the outbox; `SERVICE_BOUNDARIES.md` records when and how a service would be extracted.
- If Phases 13B/13C were done: passes work end-to-end behind `PASSES_ENABLED`, and turning the flag off changes nothing else.
- **No commit in the repo history we created contains an AI co-author, session trailer or "Generated with" line.**

## 13. Out of scope (unless I ask)
TypeScript migration · i18n · native mobile apps · **recurring auto-debit subscriptions** (Razorpay Subscriptions/e-mandates — passes are prepaid one-time purchases) · exact-bay EV passes · invoicing/GST e-invoices · multi-currency · **an actual microservices split** (see §2.4; revisit only when a documented trigger is met).
