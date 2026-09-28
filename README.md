# ParkSmart – Real-Time Parking Slot Availability System

[![CI](https://github.com/Xitiz-01/Park-Smart/actions/workflows/ci.yml/badge.svg)](https://github.com/Xitiz-01/Park-Smart/actions/workflows/ci.yml)

A full-stack MERN application for real-time parking slot management.

---

## Prerequisites

Install these before anything else:

1. **Node.js v20+** → https://nodejs.org (download LTS)
2. **MongoDB Community** → https://mongodb.com/try/download/community
   OR use **MongoDB Atlas** (free cloud) → https://cloud.mongodb.com
3. **VS Code** → https://code.visualstudio.com

---

## Setup Steps

### 1. Backend

```bash
cd backend
cp .env.example .env        # create your .env file
# Edit .env with your MongoDB URI and Better Auth secrets
npm install
npm run dev
```

Backend runs on: http://localhost:5000

### 2. Frontend

```bash
cd frontend
cp .env.example .env        # create your .env file
npm install
npm start
```

Frontend runs on: http://localhost:3000

---

## Environment Variables

**backend/.env**
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/parking-system
NODE_ENV=development
CLIENT_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace_with_at_least_32_random_characters
BETTER_AUTH_URL=http://localhost:5000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000
BETTER_AUTH_SUPER_ADMIN_USER_IDS=
BETTER_AUTH_CROSS_SITE_COOKIES=false
BETTER_AUTH_MONGO_TRANSACTIONS=false
ADDRESS_SELECTION_SECRET=replace_with_a_separate_long_random_string
EXTERNAL_PARKING_CACHE_TTL_MS=120000
GEOCODING_PROVIDER=geoapify
GEOCODING_API_KEY=your_geoapify_api_key
```

**frontend/.env**
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_AUTH_URL=http://localhost:5000
```

Generate independent backend secrets with `openssl rand -base64 32`. `BETTER_AUTH_SECRET` signs/encrypts authentication state. `ADDRESS_SELECTION_SECRET` signs Geoapify selections and is not an authentication token secret.

## Authentication & Authorization

ParkSmart uses `better-auth` 1.7.6 with the official MongoDB adapter. Better Auth owns email/password signup, sign-in, password changes, sessions, sign-out, credential accounts, account-level bans, and its restricted Admin plugin. ParkSmart remains authoritative for business roles, vendor approval, ownership, and all domain records.

The two identities are intentionally linked rather than merged:

- Better Auth collections: `user`, `session`, `account`, and `verification`.
- ParkSmart domain collections: `users`, `vendorprofiles`, `vehicles`, `bookings`, `parkinglocations`, `parkingslots`, and the existing supporting collections.
- `users.authUserId` maps a Better Auth user to the existing ParkSmart user. The domain `_id` never changes, so all existing references remain valid.

The backend pipeline is: Better Auth cookie session → Better Auth user → linked ParkSmart `User` → `req.user` → permission middleware → existing ownership checks. Public signup accepts no role and always creates a `customer` domain user.

### ParkSmart roles and permissions

- `customer`: read parking; create/read/cancel own bookings; manage own vehicles; apply to become a vendor.
- `vendor`: customer capabilities where applicable; create and update owned parking locations; manage owned slots; read bookings for owned locations.
- `admin`: review vendor applications; list users; activate/deactivate non-admin users; read/manage platform bookings and parking.
- `super_admin`: all admin permissions plus promote customers to `admin`, demote admins, and manage admin account status.

The reusable permission registry is in `backend/auth/permissions.js`. Controllers still enforce ownership by querying with both resource ID and the authenticated domain owner. Frontend route guards improve UX, but backend permissions are authoritative.

### Existing-user migration

The migration is non-destructive and idempotent. It copies each existing bcrypt hash into a Better Auth credential account, creates/links the Better Auth user, sets `users.authUserId`, preserves the ParkSmart `_id`, role, active state, and every domain relationship, and creates safe auth/link indexes. The legacy domain password field is retained for rollback safety but is no longer read by runtime authentication.

First run a read-only preview:

```bash
cd backend
npm run migrate:better-auth
```

The command prints the resolved database name. After backing up and reviewing it, apply only to that exact database:

```bash
npm run migrate:better-auth -- --apply --confirm-db=parking-system
```

Users without a legacy password hash are reported and skipped. Never run the command with a production URI until the dry run and backup have been verified.

### Initial SUPER_ADMIN bootstrap

No MongoDB editing is required:

1. Run the existing-user migration, or create the first account through ParkSmart signup.
2. Sign in and copy the **Auth ID** shown on the Profile page (the same ID is returned by `/api/auth/get-session`).
3. Set `BETTER_AUTH_SUPER_ADMIN_USER_IDS=<that-id>` on the backend. Multiple IDs may be comma-separated.
4. Restart/redeploy the backend, then refresh the signed-in profile or sign in again. ParkSmart maps that explicit identity to `super_admin`.
5. Open **Admin → Users** and promote eligible customers to `admin`.

`admin` users cannot create admins or grant `super_admin`. Vendor access is never assigned from User Management; it continues to require the vendor application workflow. Bootstrap SUPER_ADMIN records cannot be demoted or deactivated in the dashboard.

### Local, Render, and Vercel configuration

For local development, use the example values above and keep `BETTER_AUTH_CROSS_SITE_COOKIES=false`.

On Render, set `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<render-service>`, `CLIENT_URL=https://<vercel-site>`, `BETTER_AUTH_TRUSTED_ORIGINS=https://<vercel-site>`, the optional bootstrap ID, `ADDRESS_SELECTION_SECRET`, and the Geoapify variables. Use `BETTER_AUTH_MONGO_TRANSACTIONS=true` only for a Mongo deployment that supports transactions. Never place backend secrets in Vercel or in `REACT_APP_*` variables.

On Vercel, set `REACT_APP_API_URL=https://<render-service>/api` and `REACT_APP_AUTH_URL=https://<render-service>`, then redeploy because React embeds these values at build time. The frontend sends credentials for both Axios and Socket.IO.

Raw `*.vercel.app` → `*.onrender.com` traffic is cross-site. If those hostnames are used directly, set `BETTER_AUTH_CROSS_SITE_COOKIES=true` on Render so cookies are `Secure; SameSite=None`; note that browser third-party-cookie policies, especially Safari, can still block this setup. The production-safe recommendation is to configure custom sibling domains such as `app.example.com` and `api.example.com` (and list the app origin as trusted), or proxy `/api` through the frontend domain. Keep the default same-site cookie mode when using sibling/proxied domains.

## CI/CD

GitHub Actions is the quality gate for ParkSmart. The `CI` workflow runs whenever a pull request targets `main`, whenever `main` is pushed, and when it is started manually from the Actions tab.

- `frontend-ci` installs the locked frontend dependencies, runs the React test command, and creates a production build.
- `backend-ci` installs the locked backend dependencies and runs the integration suite against an isolated MongoDB service. It never connects to the production database.
- No GitHub Actions secrets are required by the current CI workflow. Tests use harmless local values, and Geoapify requests are mocked by the integration suite.
- Vercel remains responsible for frontend preview and production deployments.
- Render remains responsible for backend production deployment.

The intended development flow is:

1. Create a feature branch from an updated `main` branch.
2. Make and verify the changes locally.
3. Push the feature branch.
4. Open a pull request targeting `main`.
5. Wait for `frontend-ci` and `backend-ci` to pass.
6. Review the Vercel preview deployment where applicable.
7. Merge only after the required checks pass.
8. Let Vercel and Render deploy the merged `main` branch automatically.

Production credentials, including the production MongoDB URI, Better Auth secret, address-selection secret, and Geoapify key, stay in Render environment configuration. They must not be added to GitHub Actions for this workflow.

---

## Vendor onboarding (Phase 1)

Vendor access uses an approval workflow rather than a public role selector:

1. A customer submits an application at `/vendor/apply`.
2. ParkSmart creates a separate `VendorProfile` with a pending status; the user remains a customer.
3. An admin reviews the application under **Admin → Vendor Management**.
4. Approval changes the user's role to `vendor` and activates the vendor profile.
5. Rejection retains the application record. Suspension removes operational vendor access immediately.

Protected requests resolve the Better Auth session and reload the current ParkSmart user and vendor status from MongoDB, so approval and suspension apply without trusting stale frontend role state.

For older records that have no role field, an optional idempotent migration is available:

```bash
cd backend
npm run migrate:user-roles
```

## Vendor parking management (Phase 2)

Approved vendors can create multiple independently configured parking locations. Each location owns its address, GeoJSON coordinates, supported vehicle types, hourly pricing, operating hours, amenities, and parking slots.

Address search uses the Geoapify Autocomplete API through the ParkSmart backend. The API key is never sent to the browser. Results are restricted to India and the backend signs each selected result; parking and vendor application payloads must present that signed selection before coordinates are accepted. A dragged marker may fine-tune the selected point within five kilometres.

Create a free Geoapify API key, then configure the backend:

```bash
GEOCODING_PROVIDER=geoapify
GEOCODING_API_KEY=your_key_here
```

Coordinates use MongoDB GeoJSON order: `[longitude, latitude]`, with a `2dsphere` index for later distance search.

Before deploying Phase 2 against a database created by an earlier version, replace the old globally unique slot-number index with the new location-scoped index:

```bash
cd backend
npm run migrate:parking-slot-indexes
```

The migration does not delete or rewrite slots. Legacy slots remain unique under a `null` parking location, while different vendor locations may each use identifiers such as `C01`.

---

## Seeding Parking Slots

After logging in as admin, go to **Admin → Slots** and click **"Seed 60 Slots"**.
This creates 60 slots across 4 zones (A/B/C/D) and 3 floors (G/1/2).

---

## Hybrid parking and dynamic discovery (Phase 3)

The main customer flow at `/dashboard/nearby` discovers real, active vendor `ParkingLocation` records with MongoDB GeoJSON distance search. A selected arrival/departure range drives operating-hours checks and live availability:

- cars, motorcycles/bikes, and SUVs reserve one unit from the location's configured capacity; they are not assigned a numbered slot;
- EVs reserve an exact vendor-managed charging bay, including charger/connector/power metadata;
- booking price is snapshotted when the reservation is made, while payment remains pending because settlement is intentionally out of scope;
- check-in and checkout are available to owning vendors and admins, with ownership enforced by the backend;
- an atomic reservation ledger prevents overlapping overbooking on standalone MongoDB, so CI does not require replica-set transactions.

Existing standard `ParkingSlot` records and the legacy admin slot routes are retained for compatibility, but vendors create and manage only EV physical bays in the new portal. Run the safe migration in dry-run mode before deploying against existing data:

```bash
cd backend
npm run migrate:hybrid-parking
npm run migrate:hybrid-parking -- --apply --confirm-db=parking-system
```

The migration backfills location capacity from legacy non-EV slots, booking location/type/rate metadata, active reservation ledgers, and required indexes. The apply command refuses to write unless `--confirm-db` exactly matches the database in `MONGODB_URI`. Back up production before applying it.

Customer vehicles store physical class (`car`, `motorcycle`, or `suv`) separately from fuel type (`petrol`, `diesel`, `cng`, `hybrid`, or `electric`). Preview the legacy EV conversion before deployment, then apply it only to the confirmed database:

The discovery page derives regular-capacity versus exact-EV-slot availability from the selected registered vehicle. The optional **EV-capable locations only** filter only narrows the location list: it does not turn a petrol, diesel, CNG, or hybrid vehicle into an EV booking.

```bash
cd backend
npm run migrate:vehicle-fuel-type
npm run migrate:vehicle-fuel-type -- --apply --confirm-db=parking-system
```

The migration converts legacy `vehicleType: "ev"` records to `vehicleType: "car"` with `fuelType: "electric"`. It does not guess a fuel type for other older vehicles. A legacy EV record that already has a contradictory explicit fuel type is reported and left unchanged for manual review. The command is idempotent and refuses write mode without an exact database-name confirmation.

---

## Vehicle intelligence and EV bay experience

ParkSmart now validates new vehicle registrations against a backend-owned catalog instead of accepting arbitrary brand/model pairs. The `vehicleCatalogService` isolates catalog consumers from the underlying provider and exposes normalized brand, model, physical type, and supported fuel types. API responses do not expose provider-specific records.

There is no stable, unrestricted public API for a current Indian-market vehicle catalog: VAHAN/National Transport Repository data-sharing interfaces concern registration records and restricted bulk access rather than a consumer model catalog. ParkSmart therefore ships a deliberately small, versioned fallback dataset reviewed on 28 September 2026 against official manufacturer model pages from [Mahindra](https://www.mahindra.com/our-business/automotive), [Hyundai India](https://www.hyundai.com/in/en/find-a-car), [Maruti Suzuki](https://www.marutisuzuki.com/), [Tata Motors Cars](https://cars.tatamotors.com/), [Honda Cars India](https://www.hondacarindia.com/), and [Ather](https://www.atherenergy.com/).

- brands and model lists are cached in backend memory for six hours;
- a failing future primary provider falls back to the curated provider automatically;
- new vehicles require a catalog-valid brand/model pair, and submitted body/fuel classifications must match catalog metadata;
- existing legacy vehicles remain readable and can still be edited without forcing an invented catalog match;
- reliable single-fuel/body metadata prefills the form, while multi-fuel models preserve a supported choice or ask the user to choose;
- no additional environment variable or third-party key is currently required.

The customer EV booking page uses real `ParkingSlot` records in an accessible visual board. Effective states are `available`, `selected`, `reserved`, `occupied`, `maintenance`, and `unavailable`; every state has a textual label and is not communicated by color alone. The selected bay panel shows charger, connector, requested time, rate, and estimate. The backend rechecks location ownership, EV compatibility, operational state, interval conflicts, and the atomic reservation ledger when booking. A stale selection is rejected and the board refreshes.

Customer and vendor EV boards listen only to the existing location-scoped `availability:changed` event. Slot creation, bulk creation, maintenance updates, reservation, cancellation, check-in, and checkout cause an authoritative refresh. The vendor board shows the current-hour operational state while retaining the detailed management table. Regular vehicles continue to reserve capacity and never receive a numbered-slot board. The landing-page visual remains illustrative and is not connected to production inventory.

Catalog maintenance is intentionally manual in this phase. The fallback is not an exhaustive registry of every Indian vehicle, variant, discontinued model, or commercial vehicle; additions should be verified against a manufacturer source and reviewed like code.

---

## Project Structure

```
parking-system/
├── backend/
│   ├── config/db.js
│   ├── controllers/
│   ├── middleware/authMiddleware.js
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── .env
└── frontend/
    ├── public/index.html
    ├── src/
    │   ├── components/
    │   ├── context/AuthContext.js
    │   ├── pages/
    │   ├── services/api.js
    │   ├── App.js
    │   └── index.css
    └── .env
```

---

## API Endpoints

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | /api/auth/sign-up/email | Public | Better Auth customer signup |
| POST | /api/auth/sign-in/email | Public | Better Auth email/password sign-in |
| POST | /api/auth/sign-out | Authenticated | Invalidate current session |
| GET | /api/auth/get-session | Authenticated | Better Auth session |
| GET/PUT | /api/account/profile | Authenticated | ParkSmart domain profile |
| GET | /api/slots | Protected | Get all slots |
| POST | /api/slots/seed | Admin | Seed 60 slots |
| POST | /api/bookings | Customer | Create booking |
| GET | /api/bookings/my | Customer | My bookings |
| PUT | /api/bookings/:id/checkin | Admin | Check in |
| PUT | /api/bookings/:id/checkout | Admin | Check out |
| GET | /api/admin/dashboard | Admin | Dashboard stats |
| GET | /api/admin/users | Admin | All users |
| PATCH | /api/admin/users/:id/role | Super Admin | Promote/demote an admin |
| POST | /api/vendors/register | Customer | Submit vendor application |
| GET | /api/vendors/me | Authenticated | View own vendor profile/status |
| PUT | /api/vendors/me | Authenticated | Edit safe vendor profile fields |
| GET | /api/vendors/dashboard | Approved vendor | Vendor dashboard metrics |
| GET | /api/admin/vendors | Admin | List vendor applications |
| GET | /api/admin/vendors/:id | Admin | View vendor application |
| PATCH | /api/admin/vendors/:id/approve | Admin | Approve vendor |
| PATCH | /api/admin/vendors/:id/reject | Admin | Reject vendor |
| PATCH | /api/admin/vendors/:id/suspend | Admin | Suspend active vendor |
| GET | /api/location/autocomplete?q= | Authenticated | Search structured Indian addresses |
| GET | /api/vehicle-catalog/brands | Authenticated | List normalized catalog brands, optionally by vehicle type |
| GET | /api/vehicle-catalog/models?brand= | Authenticated | List models for a catalog brand |
| GET | /api/vehicle-catalog/details?brand=&model= | Authenticated | Get normalized body and fuel metadata |
| GET | /api/vendors/parking-locations | Approved vendor | List owned parking locations |
| POST | /api/vendors/parking-locations | Approved vendor | Create a parking location |
| GET | /api/vendors/parking-locations/:id | Approved vendor/owner | View an owned location |
| PATCH | /api/vendors/parking-locations/:id | Approved vendor/owner | Edit an owned location |
| DELETE | /api/vendors/parking-locations/:id | Approved vendor/owner | Soft-deactivate an owned location |
| GET | /api/vendors/parking-locations/:id/slots | Approved vendor/owner | List location slots |
| POST | /api/vendors/parking-locations/:id/slots | Approved vendor/owner | Create one slot |
| POST | /api/vendors/parking-locations/:id/slots/bulk | Approved vendor/owner | Bulk-create slots |
| PATCH | /api/vendors/slots/:slotId | Approved vendor/owner | Update an owned slot |
| GET | /api/vendors/bookings | Approved vendor | List bookings for owned locations |

## Tests

The vendor integration suite requires a disposable MongoDB server. It always uses and deletes only the database named `parksmart-phase2-test`.

```bash
cd backend
TEST_MONGODB_URI=mongodb://127.0.0.1:27028 npm run test:integration
```
