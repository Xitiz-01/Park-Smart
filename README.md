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
