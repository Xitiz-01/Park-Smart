# Platform audit (Phase 0)

Snapshot taken 2026-11-01 on `platform/p0-preflight`, which is stacked on `feature/frontend-redesign` (`9978de4`). Decisions needed from you are in [DECISIONS.md](DECISIONS.md).

## 1. Repository state

| Branch | Tip | State |
|---|---|---|
| `origin/main` | `e81ae17` | Contains `feature/vendor-verification` (Phase 5A) and the redesign **up to Phase 3** (PR #5 merged `4aeb897`). |
| `feature/vendor-verification` | `d0cb1ec` | **Merged** into `main`. The DigiLocker removal it planned is **not done**: DigiLocker is still in `verificationProviders.js`, `vendorVerificationController.js`, `vendorVerificationRoutes.js`, `VerificationOAuthState`, `services/api.js` and the vendor Verification page. |
| `feature/frontend-redesign` | `9978de4` | Pushed. **19 commits not in `main`**: redesign Phases 4–6 (driver, operator, admin, Verification). |
| `platform/p0-preflight` | this branch | Stacked on `feature/frontend-redesign` because that isn’t merged yet. |
| Local `main` | `d032c2e` | 19 commits behind `origin/main`. Not touched. |
| `feature/clerk-auth`, `feature/vehicle-intelligence`, `feature/vendor-role-system` | local only | Old pointers with no unpushed work. `feature/clerk-auth` is just an old `main` merge and has no Clerk code. |
| Other `feature/*` | pushed | Already merged history (CI, hybrid parking, vendor parking, RBAC, old ui-redesign). |

**Safest merge order into `main`** (I won’t merge anything):
1. ~~5A~~ (already merged). Do the DigiLocker removal as its own small PR whenever you want; it doesn’t block this plan. Phase 14 will also remove any leftovers.
2. `feature/frontend-redesign` (Phases 4–6). The PR will be clean apart from the merge commit `e81ae17` that `main` already has.
3. Then each `platform/pN-*` branch in order. Until (2) lands, each platform branch is stacked on the one before.

**Forbidden-trailer scan:** every local branch and all pushed history were scanned with the patterns in `scripts/commit-hygiene-patterns.txt`. **No hits anywhere.** Nothing needs rewriting.

## 2. Baseline (2026-11-01, macOS, Node 20.20.2, npm 10.8.2)

| | Command | Result |
|---|---|---|
| Frontend | `npm ci` | OK (5 s) |
| | `npm test` | **129 tests, 21 files, all pass** |
| | `npm run build` | OK. `build/` 1.9 MB, 91 JS/CSS files, **445 KB gzip** of JS+CSS in total. First-paint CSS 23.7 KB gzip. |
| Backend | `npm ci` | OK |
| | `npm run test:integration` | **22 tests, all pass** (3.7 s, against a throwaway local `mongod` 7.0 on :27028, same as CI) |
| Landing, Lighthouse mobile | from the redesign | Simulated 82–83 · DevTools-throttled 87–88 (see `docs/redesign/PROGRESS.md`) |

**Node 20 is past end of life** (security support ended April 2026). Phase 1 should move `.nvmrc` and CI to the current LTS (Node 22 or 24); I’ll confirm the current LTS line from nodejs.org then.

**`npm audit --omit=dev` (production dependencies):**
- **Frontend:** 1 critical, 5 high, 7 moderate, 1 low. Critical: `better-auth` (goes away in Phase 5). High: `axios`, `form-data`, `socket.io-parser`, `ws`, `zod`.
- **Backend:** 2 critical, 6 high, 3 moderate, 1 low. Critical: `better-auth`, `proxy-addr`. High: `body-parser`, `engine.io`, `multer`, `socket.io-parser`, `ws`, `zod`.

All have fixes available. Phase 1’s security job will gate on high/critical, with a documented allow-list for any accepted advisory. I’ll bump dependencies in Phase 1 rather than ship an allow-list full of fixable items.

## 3. Inventory

### 3.1 Routes and guards (backend, all under `/api`)

`protect` = Better Auth session → Mongo user, 401 if none, 403 if `isActive` is false. `perm:x` = `requirePermission('x')` from `auth/permissions.js`. `vendor✓` = `requireApprovedVendor` (VendorProfile approved and active). `adminOnly` = `perm:parking:manage-all`.

| Mount | Route | Guard |
|---|---|---|
| `/api/auth/*` | Better Auth handler (raw body, mounted before `express.json`) | Better Auth |
| `/api/account` | `GET/PUT /profile` | protect |
| `/api/slots` | `GET /`, `/nearby`, `/external-nearby`, `/:id` | protect |
| | `POST /seed`, `POST /`, `PUT/DELETE /:id` | protect + adminOnly |
| `/api/bookings` | `POST /` | protect + perm:booking:create |
| | `GET /my`, `GET /:id`, `PUT /:id/cancel` | protect (ownership checked in the controller) |
| | `GET /`, `PUT /:id/checkin`, `PUT /:id/checkout` | protect + adminOnly |
| `/api/admin` | `GET /dashboard` | perm:booking:read-all |
| | `GET /users`, `PUT /users/:id/toggle`, `PATCH /users/:id/role` | perm:user:list / user:set-status / user:set-admin-role |
| | vendors list/detail/approve/reject/suspend | perm:vendor:approve |
| | `vendor-verifications` list/detail/review/content | perm:verification:review |
| `/api/vehicles` | CRUD | protect (owner-scoped queries) |
| `/api/vehicle-catalog` | brands/models/years/details | protect + perm:parking:read |
| `/api/vendors` | `POST /register` | perm:vendor:apply |
| | `GET/PUT /me` | protect |
| | dashboard, parking-locations CRUD/publish, slots, bookings | perm:parking:create + vendor✓ (+ perm:booking:manage-vendor for check-in/out) |
| `/api/vendor-verification` | `GET /digilocker/callback` | **public** (state-token checked) |
| | everything else | protect + perm:verification:manage-own + vendor✓ + in-memory rate limit |
| `/api/parking-locations` | `/nearby`, `/:id` | protect + perm:parking:read |
| `/api/location` | `/autocomplete` | protect |
| `/`, `/api` | health strings | public |

Roles: `customer`, `vendor`, `admin`, `super_admin`. `super_admin` is bootstrapped from `BETTER_AUTH_SUPER_ADMIN_USER_IDS` (or the legacy `BETTER_AUTH_ADMIN_USER_IDS`) at request time.

**Frontend guards** (`App.jsx`): `ProtectedRoute({ roles, approvedVendor })` and `getDefaultRoute(user)` (`utils/authRouting.js`, tested). `/admin/*` needs admin or super_admin. `/vendor/*` needs vendor plus `approvedVendor`. `/vendor/apply` is for customers only, `/vendor/status` for customers and vendors.

### 3.2 Every Better Auth touch point

- **Backend:**
  - `auth/betterAuth.mjs`: config, bcrypt verifier, admin plugin, hooks that create and link the Mongo `User`.
  - `auth/betterAuthBridge.js`: CJS bridge.
  - `middleware/authMiddleware.js`: `protect`, `authenticateSocket`, bootstrap super-admin, role sync.
  - `controllers/accountController.js` and `adminController.js`: `updateCurrentAuthUser`, `setAuthUserRole`, `setAuthAccountActive`.
  - `services/betterAuthMigration.js` and `scripts/migrateBetterAuthUsers.js`.
  - `server.js`: the `/api/auth/*` mount and CORS from `BETTER_AUTH_TRUSTED_ORIGINS`.
  - Tests: `vendorFlow` and `verification` integration tests sign up through Better Auth.
- **Frontend:**
  - `lib/authClient.js`.
  - `context/AuthContext.jsx`: `useSession`, `signIn.email`, `signUp.email`, `signOut`.
  - `pages/customer/ProfilePage.jsx`: `authClient.changePassword`.
  - `lib/env.js`: `AUTH_URL`.
  - `services/api.js`: cookie credentials, global 401 → `/login`.
- **Env:**
  - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`
  - `BETTER_AUTH_SUPER_ADMIN_USER_IDS` (+ legacy `BETTER_AUTH_ADMIN_USER_IDS`, not in `.env.example`)
  - `BETTER_AUTH_CROSS_SITE_COOKIES`, `BETTER_AUTH_MONGO_TRANSACTIONS`
  - `REACT_APP_AUTH_URL`

### 3.3 Socket.IO events

| Event | Emitted by | Payload | Listener |
|---|---|---|---|
| `socket:connected` | `server.js` on connection | `{ connected }` | none |
| `availability:changed` | bookings (create/cancel/check-in/out), vendor slot changes | `{ locationId, vehicleType }` | `hooks/useAvailabilitySocket.js` (Find Parking 300 ms, booking 180 ms, vendor EV bays 180 ms) |
| `booking:changed` | bookings | booking summary | none on the frontend |
| `slot:updated` | bookings, vendor slot changes | slot | none on the frontend |

All emits are `io.emit` (broadcast to every client); there are no rooms. Socket auth reuses the Better Auth cookie through `authenticateSocket`, so **every socket needs a signed-in session**; there is no public realtime channel today.

### 3.4 Environment variables

- **Backend, code and `.env.example`:**
  - Core: `PORT`, `MONGODB_URI`, `NODE_ENV`, `CLIENT_URL`
  - Better Auth: the six `BETTER_AUTH_*` above
  - Address and catalogue: `ADDRESS_SELECTION_SECRET`, `EXTERNAL_PARKING_CACHE_TTL_MS`, `GEOCODING_PROVIDER`, `GEOCODING_API_KEY`, `API_NINJAS_API_KEY`
  - Verification storage: `VERIFICATION_STORAGE_PROVIDER`, `VERIFICATION_STORAGE_LOCAL_PATH`
  - DigiLocker: seven `DIGILOCKER_*`
  - Cashfree: four `CASHFREE_*`
- **Backend, in code but not in `.env.example`:**
  - `BETTER_AUTH_ADMIN_USER_IDS` (legacy alias)
  - `JWT_SECRET` (a fallback for the address selection token in `geocodingService.js`, left over from the pre-Better-Auth JWT era)
- **Frontend:** `REACT_APP_API_URL`, `REACT_APP_AUTH_URL`, `REACT_APP_SOCKET_URL` (**missing from `.env.example`**), and `DEV_PROXY_TARGET` (dev only, Vite config).

### 3.5 Legacy leftovers noticed

- `frontend/src/index.css`, `styles/legacy.css`, `components/layout/AppShell.jsx` and `components/ui/{Brand,LoadingState,MetricCard,PageHeader}.jsx` are **unused** since redesign Phase 6. `ui/StatusBadge.jsx` is only kept alive by its test. `pages/customer/SlotsPage.jsx` isn’t routed. These were scheduled for redesign Phase 7 (clean-up), which this brief replaces; I’ll delete them in platform Phase 6 or 14.
- No `window.confirm` remains. `ConfirmDialog.jsx` only mentions it in a comment.
- Unused backend dependencies: `express-validator` and `express-async-handler` have no imports. `jsonwebtoken` is used only for address selection tokens.
- DigiLocker code still present (see §1).
- Legacy `ParkingSlot` admin features (zones, floors, "seed 60 slots") coexist with operator-owned EV bays in the same collection.
- `README.md` says the backend runs on 5000, but the code and Vite proxy use 5001. This was already a follow-up.

### 3.6 Backend smells

| Area | Finding | Phase that fixes it |
|---|---|---|
| Structure | Fat controllers: `slotController` is 500 lines, `vendorParkingController` 312. No service/repository split for most domains. | 2, 7 |
| Validation | No request validation layer. Only `validators/parkingLocationValidator.js`; `express-validator` installed but unused. Mass-assignment risk wherever `req.body` is spread. | 2, 7, 14 |
| Config | `process.env` read in about 20 places; `connectDB` calls `process.exit(1)` on the first failure (no retry); no env validation. | 2 |
| Errors | One catch-all handler; controllers send ad-hoc `{ success, message }` shapes; `error.message` from Mongo is returned to clients in places (e.g. admin dashboard 500s). | 2 |
| HTTP | No `helmet`, compression or body-size limits. CORS allow-list hard-codes `https://park-smart-eight.vercel.app`. | 2 |
| Logging | `console.*` only, no request ids. | 2 |
| Lifecycle | No graceful shutdown; no `/health` endpoints (only `/`); `server.js` mixes app and listen (exports both, which helps tests). | 2 |
| In-memory state | `vehicleCatalogService` cache (per process, 6 h), `geocodingService` LRU of 200, the verification rate limiter `Map`. All break or diverge with more than one replica. | 3, 8 |
| Storage | Verification documents on **local disk** (`private-verification-storage/`); single-instance only; no malware scan. | 9 |
| Realtime | `io.emit` broadcasts to every client; no Redis adapter, so events don’t cross replicas. Socket auth is cookie-only. | 4, 8 |
| Queries | **No pagination** on admin users, all bookings, vendors, vendor bookings, slots or verification cases. Vendor dashboard does per-location `await` in a loop (N+1-style; fine at today’s scale). Admin dashboard does 9 sequential count/aggregate calls. | 7 |
| Indexes | Bookings, locations (2dsphere), verification and ledger have sensible indexes. Missing: `Vehicle` (user), `User` (role, createdAt) for admin lists, TTL on stale holds (holds are pruned inline instead). | 7 |
| Reservation ledger | Holds live in an **embedded array on one document per resource** (`regular:<location>:<type>` or `ev:<slot>`). It is atomic and correct, but a busy location contends on one hot document, and the array is pruned inline (30-day history). It stays as-is (do-not-break), and Phase 7 measures it under the concurrency test. | 7, 9 |
| Transactions | `BETTER_AUTH_MONGO_TRANSACTIONS` is off because CI’s Mongo is standalone. Moving CI and local to a **replica set** is a prerequisite for Phases 7 and 10. | 1, 3 |
| Tests | Backend integration tests are `node:test` against a real Mongo, with no unit layer and no coverage. Frontend has Vitest with 129 tests and no coverage threshold. | 1, 2 |

## 4. Guardrails added in this phase

- `.claude/settings.json` (committed): `attribution.commit = ""`, `attribution.pr = ""`, `attribution.sessionUrl = false`. These are the current keys per the settings reference; `includeCoAuthoredBy` is deprecated and not used.
- `.githooks/commit-msg`: **strips** any line matching the forbidden patterns, then re-checks and refuses if anything remains. Human `Co-authored-by` lines are kept (tested). Enable per clone with `git config core.hooksPath .githooks`. Phase 1 moves this under Husky.
- `scripts/check-commit-clean.sh` and `scripts/commit-hygiene-patterns.txt`: scan a commit range (default: commits not on any remote) or a message file. These are the patterns the CI `commit-hygiene` job will use in Phase 1.

## 5. Confirmed phase plan and estimates

| # | Phase | Estimate | Notes |
|---|---|---|---|
| 0 | Pre-flight | 1 h | This document. |
| 1 | CI/CD | 2 h | Includes the Node LTS bump and the dependency fixes needed to pass the security gate. A replica-set Mongo for CI (`mongodb-memory-server` in replset mode). |
| 2 | Backend skeleton | 2 h | Must stay behaviour-neutral; 8 commits. |
| 3 | Docker + Redis foundation | 2 h | Needs Docker Desktop (installed: 29.2.0). |
| 4 | Clerk backend | **2–2.5 h → may split 4A/4B** | 4A: provider abstraction, middleware, `/me`, webhook. 4B: socket auth, ops/migration scripts, Better Auth removal. Needs your Clerk dev instance keys. |
| 5 | Clerk frontend | 2 h | Needs `VITE_CLERK_PUBLISHABLE_KEY` (dev). |
| 6 | User flows + e2e | **2–3 h → likely split 6/6-e2e** | `USER_FLOWS.md` needs your approval mid-phase. |
| 6B | Logo.dev | 1.5 h | Needs a publishable key to see real logos; fallbacks work without one. |
| 7 | Data layer | **3–4 h → split 7A (modules + boundaries) / 7B (migrations, indexes, transactions, pagination, idempotency)** | |
| 8 | Redis + queues | **2–3 h → outbox likely 8B** | The brief already allows this split. |
| 9 | Prod readiness | **3 h → split 9A (metrics, resilience, storage) / 9B (ClamAV, k6, runbook)** | |
| 10 | Payments I | 2 h, plus your approval of the design doc | |
| 11 | Razorpay | **2–3 h → split backend / frontend** | Needs Razorpay **test** keys. |
| 12 | Settlements | 2 h | Route provider only if Route is activated. |
| 13 | Finance UIs | 2 h | |
| 13B/13C | Passes (optional) | 2 h + 2 h | Only if you say yes. |
| 14 | Hardening + release | 2 h | Needs your hosting choice for the deploy job. |

Splits follow §0.1: each half ends with its own commits, tests and a push checkpoint.
