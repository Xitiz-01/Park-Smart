# Redesign fixtures and screenshots

Reproducible data and screenshots for every redesign phase, run against the **real, unmodified backend** on a **disposable local MongoDB**. Nothing here changes `backend/` or `frontend/`.

```bash
python3 docs/redesign/tools/fixtures.py up          # start mongod :27029, backend :5055, frontend :3055
python3 docs/redesign/tools/fixtures.py seed        # accounts + data (use --reset to rebuild)
python3 docs/redesign/tools/fixtures.py smoke       # log in through the form as each role, then load every route
python3 docs/redesign/tools/fixtures.py shoot --out docs/redesign/screens/phase-1
python3 docs/redesign/tools/fixtures.py status
python3 docs/redesign/tools/fixtures.py down
```

Useful `shoot` flags:
- `--widths 1440,1024,768,390,320` adds 320 px for overflow checks.
- `--only landing,customer-booking-ev` limits the run; route names are in `routes()` in `fixtures.py`.
- `--settle 5` waits longer on a slow machine.

`smoke` fails on a wrong landing route after login, a route that redirects or renders nothing, or any console error not listed in `KNOWN_ERRORS` (currently only the 503 from audit finding 5.U).

Each `shoot` run writes `<name>-<width>.png` plus a `report.json` with the final path, horizontal overflow in px, page height and console errors per capture. It also adds one 390 px capture with `prefers-reduced-motion: reduce`.

## Safety rules (enforced in code)

**Local MongoDB only.** The script starts its own `mongod`, bound to `127.0.0.1` and using its own data directory. Before any database operation it checks:
- The URI is plain `mongodb://` (so `mongodb+srv://`, which Atlas uses, is refused).
- Every host is loopback.
- The database name starts with `parksmart-fixtures`.
- The `mongod` on that port reports *our* data directory and a loopback-only bind.

`seed.mongosh.js` repeats the database-name, data-dir and bind-address checks itself and quits before writing if any of them fails.

**Your own servers are never touched.** The backend and frontend run on dedicated ports (5055 and 3055, not your usual 5001 and 3000).
- Every database variable in `backend/.env` is overridden at spawn time. The backend uses plain `dotenv.config()`, which never overrides existing variables, so `MONGODB_URI` from `.env` (Atlas) is never used.
- After start-up the script checks the backend's own `MongoDB Connected: <host>` log line and kills it if the host isn't loopback.
- Every API call and screenshot first checks that the process listening on the port belongs to the process group started by `up`. If you have another server on that port, the script refuses rather than calling it.

**No secrets in the repo.**
- The account password, `BETTER_AUTH_SECRET`, `ADDRESS_SELECTION_SECRET` and `JWT_SECRET` are generated at run time with Python's `secrets` module.
- They're stored in `$PARKSMART_FIXTURE_HOME/secrets.json` (default `~/.cache/parksmart-redesign-fixtures/`, directory mode 0700, file mode 0600).
- The script refuses to run if that directory is inside the repository.
- Passwords are never printed.

**Dev proxy.** The frontend talks to the fixture backend through absolute `REACT_APP_*` URLs, and `up` also sets `DEV_PROXY_TARGET` so Vite's `/api` and `/socket.io` proxy points at the fixture backend (port 5055) instead of your usual 5001. (Under CRA the proxy was fixed to 5001 in `package.json`; that gap is closed.)

**Providers off.** The Geoapify, API Ninjas, DigiLocker and Cashfree variables are blanked or disabled, so runs make no paid or external provider calls. Map tiles still load from OpenStreetMap, exactly as the app does.

## What `seed` creates

All data is illustrative and lives only in the disposable database.

| Thing | Detail |
|---|---|
| Accounts (real sign-up API) | `fixture-customer@`, `fixture-admin@`, `fixture-vendor@` and `fixture-applicant@parksmart.test`, all sharing one generated password |
| Roles | admin → `admin`; vendor → `vendor` with an **active** vendor profile; applicant → **pending** vendor application |
| Locations (Pune, FC Road area) | FC Road Multilevel (active; car, motorcycle, EV; 70 regular spaces), Deccan Surface Lot (active, no EV), Kothrud Draft Site (draft) |
| EV bays | EV01–EV06 at FC Road; EV01–02 DC 60 kW, EV03–06 AC 22 kW; **EV04 in maintenance** |
| Vehicles (customer) | MH12AB1234 petrol hatchback (default), MH14EV5678 electric SUV |
| Bookings (real booking API) | One regular and one EV booking two hours from now, plus one regular booking the next day, cancelled |

Generated IDs go to `$PARKSMART_FIXTURE_HOME/fixtures.json`, which `shoot` reads to build the booking and edit URLs. Account sign-in for the screenshot browser uses the same API, and the cookies are injected over the DevTools protocol.

## Requirements

macOS with Homebrew `mongod` and `mongosh` (MongoDB 7), Node 20, Google Chrome (override the path with `CHROME_PATH`), and Python 3 with `websocket-client`, which `shoot` needs. To change ports, set `PARKSMART_FIXTURE_MONGO_PORT`, `PARKSMART_FIXTURE_API_PORT`, `PARKSMART_FIXTURE_APP_PORT` or `PARKSMART_FIXTURE_CDP_PORT`.

`up` detects the frontend toolchain: `npm start` while the app is on CRA, `npx vite` once `frontend/vite.config.*` exists. It passes the API and auth URLs as both `REACT_APP_*` and `VITE_*` variables. Shell variables beat `frontend/.env` in both toolchains.

## Screenshots in git

PNGs under `docs/redesign/baseline/` and `docs/redesign/screens/` are gitignored (`docs/redesign/.gitignore`); `report.json` files are kept. To recreate the Phase 0 baseline:

```bash
python3 docs/redesign/tools/fixtures.py shoot --out docs/redesign/baseline
```

The existing `baseline/` images came from an earlier ad-hoc version of this tooling: ports 5001 and 3000, `baseline-*` account names, same data shape. A fresh run will differ only in names, dates and IDs.
