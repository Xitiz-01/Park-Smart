# ParkSmart – Real-Time Parking Slot Availability System

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
# Edit .env with your MongoDB URI and a JWT secret
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
JWT_SECRET=changethis_to_a_long_random_string
JWT_EXPIRE=7d
NODE_ENV=development
CLIENT_URL=http://localhost:3000
EXTERNAL_PARKING_CACHE_TTL_MS=120000
GEOCODING_PROVIDER=geoapify
GEOCODING_API_KEY=your_geoapify_api_key
```

**frontend/.env**
```
REACT_APP_API_URL=http://localhost:5000/api
```

---

## Creating the Admin Account

1. Register a normal account via the website
2. Open **MongoDB Compass**, connect to your DB
3. Go to `parking-system` → `users`
4. Find your user, click Edit, change `role` from `"customer"` to `"admin"`
5. Log out and log back in — you'll land on the Admin Panel

## Vendor onboarding (Phase 1)

Vendor access uses an approval workflow rather than a public role selector:

1. A customer submits an application at `/vendor/apply`.
2. ParkSmart creates a separate `VendorProfile` with a pending status; the user remains a customer.
3. An admin reviews the application under **Admin → Vendor Management**.
4. Approval changes the user's role to `vendor` and activates the vendor profile.
5. Rejection retains the application record. Suspension removes operational vendor access immediately.

JWTs contain only the user ID. Protected requests reload the current user and vendor status from MongoDB, so approval and suspension apply to already-issued tokens without requiring a token refresh.

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

## Live Nearby Parking on Map

- The **Nearby Map** (`/dashboard/nearby`) shows:
  - your app slots (seeded + managed in your DB), and
  - live public parking places near the user from OpenStreetMap sources.
- When online, backend tries multiple Overpass endpoints first and automatically falls back to Nominatim if Overpass is busy.
- If providers are temporarily unavailable, the app uses the last synced nearby map cache so users still see map data.

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
| POST | /api/auth/register | Public | Register customer |
| POST | /api/auth/login | Public | Login |
| GET | /api/slots | Protected | Get all slots |
| POST | /api/slots/seed | Admin | Seed 60 slots |
| POST | /api/bookings | Customer | Create booking |
| GET | /api/bookings/my | Customer | My bookings |
| PUT | /api/bookings/:id/checkin | Admin | Check in |
| PUT | /api/bookings/:id/checkout | Admin | Check out |
| GET | /api/admin/dashboard | Admin | Dashboard stats |
| GET | /api/admin/users | Admin | All users |
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
