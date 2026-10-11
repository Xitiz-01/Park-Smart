# ParkSmart frontend redesign — Phase 0 audit

Branch `feature/frontend-redesign` @ `d0cb1ec` (same commit as `feature/vendor-verification`; `main` is `d032c2e`, 3 commits behind).
Phase 0 was read-only. Nothing under `frontend/src`, `backend/` or the config files was changed. The only new files are this audit and `docs/redesign/baseline/`.

**Contents**
1. How the baseline was produced
2. Screen and route inventory
3. Component inventory
4. The brief's findings, checked against the code
5. Findings the brief missed
6. Risks
7. Tooling recommendation
8. Three design directions
9. Phase plan
10. Skills, plugins and MCP servers
11. Open questions for you

---

## 1. How the baseline was produced

| Step | Result |
|---|---|
| `npm ci` (frontend) | OK, 1,342 packages. `npm audit`: 99 issues overall (3 critical, 75 high). Almost all come from `react-scripts`; production deps only: 9 (5 moderate, 4 high). |
| `CI=true npm test -- --watchAll=false` | **4 suites, 19 tests passing**, as the brief expected. |
| `CI=true npm run build` | **Compiled successfully**, no warnings. One JS chunk: **661 KB raw / 191.8 KB gzip** (`main.7440fdf4.js`). CSS: **74 KB raw / 17.5 KB gzip** (includes Leaflet's CSS). No code splitting. `build/` is 3.5 MB. |
| Backend for screenshots | `backend/.env` points at a **MongoDB Atlas cluster**, and the brief asks for a disposable DB. So the stock backend ran unmodified with env-var overrides: `PORT=5001`, `MONGODB_URI=mongodb://127.0.0.1:27029/parksmart-baseline` (a throwaway local `mongod` whose data lives in the session scratchpad), a random `BETTER_AUTH_SECRET`, and Geoapify, API Ninjas, DigiLocker and Cashfree switched off. No backend file was touched, and nothing connected to Atlas. |
| Fixture data | Four accounts were created through the real sign-up API: customer, admin, approved vendor, and pending applicant (all `@parksmart.test`). Roles and vendor profiles were set directly in the throwaway DB. Seeded: 3 parking locations (2 active, 1 draft) near FC Road in Pune, 6 EV bays (one in maintenance), 2 vehicles (petrol hatchback, electric SUV). Three bookings were made **through the real booking API**: one regular, one EV, one later cancelled. |
| Screenshots | Headless Chrome driven over the DevTools protocol (Python `websocket-client` was already installed, so no installs). 29 routes × 1440 / 1024 / 768 / 390 px, full page, geolocation pinned to FC Road. Output: `docs/redesign/baseline/*.png` (gitignored; regenerate with `tools/fixtures.py`, see `tools/README.md`) plus `report.json` (tracked), which records horizontal overflow and console errors per shot. One extra capture runs with `prefers-reduced-motion: reduce`. |
| Screenshot results | **116 captures + 1 reduced-motion capture, 14 MB.** **No horizontal page overflow at any width on any route**, and no unexpected redirects. Console errors: `GET /favicon.ico` 404 on `/` (there is no favicon), and a 503 on `/vendor/locations/:id/edit` (see 5.U). Fonts render as the system stack (see #3). |
| Not captured | `/dashboard/book/:slotId` (legacy slot booking; needs legacy admin slots, and none are seeded). The `/dashboard/slots` redirect. DigiLocker and Cashfree flows (providers are off). |

> **Why 5001:** on macOS 12 and later, Control Center (AirPlay Receiver) listens on **:5000**. That is why `package.json`'s proxy, the code fallbacks and your local `backend/.env` all use 5001, while the README and both `.env.example` files still say 5000. See finding #9.

---

## 2. Screen and route inventory

Verdict key: **Restyle** = same structure, new kit · **Rework** = new layout and IA, same behaviour · **Rebuild** = new composition over the existing logic.

| Route | Page file | What it does / data | Verdict |
|---|---|---|---|
| `/` | `LandingPage` | Static marketing: nav, hero with a static CSS "deck", journey strip, 4 feature cards, 3 audience cards, CTA, footer. No data. | **Rebuild.** Live Lot hero and scroll-story (§6 of the brief). Copy is truthful today; keep the voice. |
| `/login` | `LoginPage` + `AuthShell` | `login()` → `getDefaultRoute`. Errors go to toast only. | **Rework.** Split layout with the mini Live Lot; inline errors. |
| `/register` | `RegisterPage` + `AuthShell` | `register()`; client-side match and length checks only via toast. | **Rework.** Inline validation; same rules. |
| `/dashboard` | `customer/Dashboard` | `slotsAPI.getAll()` stats (legacy) + latest 3 of `getMyBookings`. CTAs go to `/dashboard/slots`. | **Rework.** Fix CTA targets. Keep data sources but **flag them** (see 5.Q). |
| `/dashboard/nearby` | `NearbyMapPage` | Vehicles → geolocation (Pune fallback) → `parkingLocations.getNearby`. `localStorage` cache, socket refresh (300 ms debounce), 11 native controls, Leaflet with OSM tiles. | **Rebuild** (flagship). Map-first, filter sheet. Every §3 behaviour preserved. |
| `/dashboard/parking/:locationId` | `BookingPage` | Reads query params, picks the vehicle, `getById` availability (250 ms debounce), EV board plus socket (180 ms), capacity copy, mini map, estimate, EV confirmation. | **Rebuild** as a stepper with a sticky summary. Keep `bookingPayloadForVehicle`. |
| `/dashboard/book/:slotId` | `BookingPage legacy` | Legacy slot booking via `slotsAPI.getById`. | Restyle alongside the above. Not captured. |
| `/dashboard/bookings` | `MyBookings` | List, status chips, cancel via `window.confirm`. Own badge copies. | **Rework.** Tabs with counts, ticket cards, AlertDialog. |
| `/dashboard/vehicles` | `VehiclesPage` | Full dependent catalog flow (make → model → year → details), retry and error states, inline add/edit card. | **Rework.** Card grid, plate treatment, Sheet editor. Flow logic untouched. |
| `/dashboard/profile` | `ProfilePage` | Profile update and Better Auth `changePassword`. Shows the Auth ID. | Restyle into sectioned settings. Keep Auth ID (README depends on it for bootstrap). |
| `/vendor/apply` | `VendorApplication` | Business fields + `AddressLocationPicker` (Geoapify signed selection). No shell. | Rework as a stepped application inside a minimal shell. |
| `/vendor/status` | `VendorStatus` | Pending, rejected or suspended card; refresh; logout. No shell. | Restyle as a status timeline. |
| `/vendor` | `VendorDashboard` | `vendors.getDashboard` stats; occupancy bar. | Rework: KPIs, occupancy ring, accessible chart. |
| `/vendor/locations` | `ParkingLocations` | Cards, publish draft, links to edit and EV slots. | Restyle as cards with clear draft/publish gating copy. |
| `/vendor/locations/new`, `/:id/edit` | `ParkingLocationEditor` + `ParkingLocationForm` | One long form (5 cards). Deactivate via `window.confirm`. | **Rebuild** as a multi-step editor; same payload. |
| `/vendor/slots` | `VendorSlots` | EV location picker, bulk/single create, `EVSlotBoard`, maintenance toggles, **third socket client**. | Rework: SlotBoard + DataTable. |
| `/vendor/bookings` | `VendorBookings` | Table with check-in/out. | Restyle as a DataTable that collapses to cards on mobile. |
| `/vendor/profile` | `VendorProfile` | Editable business fields; read-only identity. | Restyle. |
| `/vendor/verification` | `VendorVerification` | Status, 4 step cards, manual upload with consent, DigiLocker and Cashfree options, per-location authorization, evidence list. | **Last** (Phase 6). Data-driven providers. |
| `/vendor/transactions`, `/earnings`, `/settings` | `VendorPlaceholder` | Generic "prepared for a future phase" text. | Designed "coming soon" pages that say plainly what will exist, with no invented numbers. |
| `/admin` | `AdminDashboard` | Users, slots, bookings and revenue stats; occupancy bar; recent bookings table. | Rework with real charts and tables. |
| `/admin/slots` | `AdminSlots` | **Legacy** admin slot CRUD + "Seed 60 Slots" (2× `window.confirm`). | Restyle as a DataTable. Label it clearly as legacy inventory. |
| `/admin/bookings` | `AdminBookings` | Filter chips, table, check-in/out, cancel. | DataTable + detail sheet. |
| `/admin/users` | `AdminUsers` | Search, activate/deactivate, promote/demote (super admin). | DataTable + detail sheet. Keep every guard condition. |
| `/admin/vendors` | `AdminVendors` | Table + inline detail card; approve, reject, suspend. | DataTable + detail sheet + ConfirmDialog. |
| `/admin/verifications` | `AdminVerifications` | Filters, case list, detail, evidence, private download, review modal, audit list. | **Rebuild** as the review console (Phase 6, provider-agnostic). |
| `*` | — | Redirects to `/`. | Consider a real 404. Not a behaviour change; your call. |

Orphaned file: **`pages/customer/SlotsPage.js` is not routed anywhere** (`/dashboard/slots` redirects). It is dead code (140 lines, 19 inline styles).

---

## 3. Component inventory

| Component | Today | Verdict |
|---|---|---|
| `layout/AppShell` | Sidebar defined in the render body and rendered twice; top bar shows the role label and avatar initial only. | **Rewrite.** Extract `Sidebar`. Make the closed mobile drawer `inert`. Add breadcrumbs, user menu, ⌘K. |
| `admin/AdminLayout`, `customer/CustomerLayout`, `vendor/VendorLayout` | Nav arrays + `AppShell` props. Emit a `role-*` accent class. | **Reuse.** Move nav config into one `navigation.js` so the sidebar, mobile tabs and ⌘K share it. |
| `auth/AuthShell` | Dark story panel with static route art; form panel. | **Rewrite** with the mini Live Lot. |
| `parking/EVSlotBoard` (+ test) | `listbox`/`option` board; exports `SLOT_STATES`, `slotDisplayStatus`, `isSlotSelectable`. | **Rewrite visuals, keep the API and exports** → `SlotTile` / `SlotBoard`, shared with the landing page and vendor ops. Test must stay green. |
| `shared/SearchableSelect` | Hand-rolled combobox (ARIA mostly right; options are `<button>`s). | **Rewrite** on Command + Popover with the **same props**. |
| `shared/AddressAutocomplete` | 500 ms debounce, ≥3 chars, `skipNextSearch`; 9 inline styles; suggestions aren't keyboard-navigable as a listbox. | **Rewrite** on Command + Popover; same timing and semantics. |
| `shared/AddressLocationPicker` | Exports `emptyAddressSelection`; composes autocomplete, city, state, pincode and map. | **Restyle**; keep exports. |
| `shared/LocationMapSelector` | Draggable marker with an inline-hex `divIcon`. | **Restyle** with a token marker; lazy-load. |
| `shared/StateSelect` | Native select. | Replace with the `Select` primitive (or a searchable one; 36 options). |
| `ui/Brand` | Lucide `ParkingCircle` + text. `aria-label` on a role-less `div` is ignored. | **Rewrite**: SVG logomark + wordmark. |
| `ui/LoadingState` | Generic 3-card skeleton. | **Replace** with shape-matched `Skeleton`s. |
| `ui/MetricCard` | Icon + value; dead `metric-glow` div. | **Rewrite** with count-up and reduced-motion support. |
| `ui/PageHeader` | Used on 3 pages; 18 other routed pages hand-roll `.page-header`. | **Reuse API**; make it the only header. |
| `ui/StatusBadge` (+ test) | Tone map, readable text. | **Reuse API**, extend tones (payment, roles, location status). The single badge for the whole app. |
| `vendor/ParkingLocationForm` | 5-card form, 15 inline styles; `createInitialState` normalises legacy `suv`/`bike`. | **Rebuild** as a multi-step editor. Keep `createInitialState` and the submit payload byte-for-byte. |
| Local `StatusBadge`/`PaymentBadge` copies in `MyBookings`, **`AdminBookings`**, **`AdminSlots`** | Duplicates. | **Delete** (use `ui/StatusBadge`). |
| `VendorPlaceholder` | Generic copy. | **Replace** with a designed `ComingSoon` page. |
| `SlotsPage` | Unrouted. | **Delete** (needs your OK). |

To build (Phase 2 kit): Button, Input, Select, Switch, Slider, date-time range picker, FormField with inline errors, Card, Sheet, Dialog / **ConfirmDialog**, Tabs, DataTable, EmptyState, ErrorState, Skeletons, Tooltip, DropdownMenu, Command (⌘K), `useAvailabilitySocket`, `lib/env.js`, `/_design` (dev only).

---

## 4. The brief's findings, checked against the code

| # | Verdict | Notes |
|---|---|---|
| 1 | **Confirmed** | `react-scripts` 5.0.1; React 18.3.1; react-router-dom 6.30.3 (with v7 future flags); axios 1.15; better-auth 1.7.6; leaflet 1.9.4 / react-leaflet 4.2.1; socket.io-client 4.8.3; lucide-react 0.383.0; react-hot-toast 2.6; date-fns 3.6. `.npmrc` = `legacy-peer-deps=true`. No Tailwind, TypeScript, component library or animation library. **Extra:** `yaml` is a frontend devDependency that nothing in `src` imports. |
| 2 | **Confirmed** | 703 lines; cream `#f5f2ea`, teal `#147d6f`; legacy alias block at lines 42–68. Exactly **6** `@keyframes` (spin, fadeUp, skeletonPulse, menuIn, backdropIn, modalIn). Breakpoints 1180 / 1080 / 960 / 720 / 430. One `prefers-reduced-motion` block, **which is itself a bug** (see 5.A). |
| 3 | **Confirmed** | `index.html` loads Space Mono + DM Sans; the CSS stack is `Inter, Manrope, -apple-system…`, and neither is loaded. **Verified on this Mac:** neither font is installed, so the screenshots render in SF Pro. Windows users get Segoe UI, Android users Roboto. The Google Fonts request is pure waste. `theme-color` is `#0f172a`. `public/` contains only `index.html`: no favicon, manifest, OG image or `robots.txt`. |
| 4 | **Partly right** | Totals are higher: **249 `style={{…}}` across 26 files** (not ~220 across 20). The six named files match exactly (20/19/18/17/16/15). Next: AdminBookings 13, ProfilePage 12, AdminUsers 11, VendorProfile 10, AdminVendors 10, AddressAutocomplete 9. Hard-coded hex: `App.js` toaster (7), `NearbyMapPage` (3), `BookingPage` (2), `LocationMapSelector` (1), plus `#fff` in `MyBookings` and `AdminBookings` filter chips. 19 of the 249 are in the dead `SlotsPage`. |
| 5 | **Partly right** | Duplicate badges exist in **three** files, not one: `MyBookings` (Status + Payment), `AdminBookings` (Status + Payment), `AdminSlots` (Status). Two badge systems confirmed (`.badge-*` and `.status-*` share one rule). `PageHeader` is used by 3 pages; 18 routed pages hand-roll `.page-header`. Two loading styles confirmed (spinner on 12 pages plus the `ProtectedRoute` guard; skeleton on the 3 dashboards). `window.confirm`: **9 calls in 7 files**. AdminSlots has 2 (delete, seed) and AdminUsers 2 (role, toggle); the others have one each (MyBookings, VehiclesPage, ParkingLocationEditor, AdminBookings, AdminVendors). |
| 6 | **Confirmed, and worse** | `Sidebar` is a component defined inside `AppShell`, so its identity changes every render and React remounts both copies. Also: the closed mobile drawer is only translated off-screen, so at ≤960 px **its links stay in the tab order** (keyboard users tab into an invisible menu), and its box-shadow bleeds 16 px into the viewport (visible as a grey strip on every 390 px app screenshot). |
| 7 | **Confirmed** | `mobility-visual` / `parking-deck` / `bay` spans; only `fadeUp` on the copy. |
| 8 | **Partly right** | 11 controls in one auto-fit grid: confirmed (stacks into ~770 px of form above the results at 390 px). Default OSM tiles and an inline-styled `divIcon`: confirmed. **But there are three inline Socket.IO clients, not two**: `NearbyMapPage`, `BookingPage` **and `VendorSlots`**, each with the same URL derivation and the `localhost:5001` fallback. Also, the `NearbyMapPage` socket effect depends on `fetchLocations`, which changes on every filter edit, so **the socket disconnects and reconnects on every keystroke** in the filter form. |
| 9 | **Confirmed, with a reason** | `.env.example` and README say 5000; `package.json` proxy, socket fallbacks and your `backend/.env` say 5001. Root cause is the macOS AirPlay listener on :5000. Also: axios and auth fall back to relative `/api` / `window.location.origin`, but the sockets fall back to absolute `http://localhost:5001`. A build without `REACT_APP_API_URL` would therefore call the API same-origin and try to open sockets on the visitor's own machine. `lib/env.js` should own all three. |
| 10 | **Confirmed, plus a display bug** | The dashboard CTA and the empty-state button both link to `/dashboard/slots`. Stats come from `slotsAPI.getAll()`, which counts **ParkingSlot records only** (EV bays plus legacy slots). In the fixture, "Total spaces: 6 · Across all locations" sits beside 70 regular capacity spaces. The recent-booking rows render `Slot {slot.slotNumber} · Zone {slot.zone}`, so capacity bookings show **"Slot · Zone"** with blanks (visible in `customer-dashboard-*.png`). `AdminDashboard`'s recent-bookings table has the same pattern. Both flagged; data sources not changed. |
| 11 | **Confirmed** | `VendorLayout` lists Transactions / Earnings / Settings → `:section` → `VendorPlaceholder`. |
| 12 | **Confirmed** | `VendorVerification` hard-codes the DigiLocker block, consent state and success toast; `services/api.js` has `verificationAPI.startDigiLocker`. Cashfree is also hard-coded, so the provider list should be one data array covering both. |
| 13 | **Confirmed** | Jobs `frontend-ci` and `backend-ci`; Node 20; `npm ci`, `npm test -- --watchAll=false --passWithNoTests` and `npm run build` with `CI=true`; no secrets; triggers on PRs to and pushes to `main`. No `vercel.json`. `REACT_APP_*` are baked at build time. |
| 14 | **Confirmed** | `{backend/{config,controllers,middleware,models,routes},frontend/…}` is a tree of empty directories plus `.DS_Store` (a brace expansion that never expanded). The root `node_modules/` holds only `yaml`, and the root `package-lock.json` has an empty `packages`. Not touched. |

---

## 5. Findings the brief missed

All of these were checked in the code, and the visual ones also in the baseline screenshots.

**Accessibility**
- **A. The reduced-motion block breaks layout.** `*, *::before, *::after { transform: none !important }` removes *positioning* transforms as well as animations. With reduced motion on, every input icon loses its `translateY(-50%)` centring, and the closed mobile drawer loses `translateX(-102%)`, so **it sits open over the content at ≤960 px**, and the ✕ can't close it. The measured drawer rect is `left: 0, right: 264, transform: none`. See `extra-reduced-motion-customer-dashboard-390.png`. **This is a live production bug:** any phone or tablet user with "Reduce motion" on (a common iOS and Android setting) cannot use the app shell. Phase 1c fixes it. If you want it fixed sooner, it's a one-rule hotfix on `main`; say the word. The redesign must use motion-only reductions.
- **B. The focus ring is nearly invisible.** `:focus-visible` uses 3 px of teal at 22 % alpha, about **1.3:1** against the cream background (WCAG needs 3:1). `.form-input:focus` sets `outline: none` and relies on a 12 % alpha shadow.
- **C. Muted text fails contrast.** `--ps-muted #92968f` on `#f5f2ea` is about **2.7:1**, yet it is used for page descriptions, empty states, card metadata and the auth switch line. `--ps-text-secondary` (4.9:1) and white on teal (5.0:1) pass.
- **D. Text is very small.** Many 8–10 px labels: hero proof chips, deck footer, map result address and meta (9 px), slot legend (9 px), nav section label (9 px), role chip (10 px). Body text is 15 px.
- **E. Many labels aren't associated with their fields.** There's no `htmlFor`/`id` in NearbyMapPage, BookingPage, VehiclesPage (plate, year, type, body, fuel, colour), ProfilePage, ParkingLocationForm, VendorSlots, VendorApplication, VendorProfile and AdminSlots. The AdminUsers search box and the AdminSlots filters have no label at all. Login, Register, SearchableSelect and the verification forms are fine.
- **F. Icon-only buttons have no name.** AdminSlots edit, delete and refresh; AdminBookings cancel is a bare "✕", which screen readers announce as "multiplication x".
- **G. The review modal isn't a real modal.** In AdminVerifications there's no focus trap, no Escape, focus isn't returned on close, and the page behind stays scrollable.
- **H. Landmarks.** `VendorVerification` and `AdminVerifications` render a `<main>` inside AppShell's `<main>`. There is no skip link, and the `Brand` `aria-label` sits on a plain `div`.
- **I. Emoji are used as icons.** The ProfilePage role badge and AdminSlots features (📷 🏠 ⚡) are read aloud and clash with lucide.

**Visual and layout bugs (visible in the baseline)**
- **J. Inline icons break onto their own line.** The global `img, svg { display: block }` overrides `verticalAlign: middle`, so the address pin and the duration clock on BookingPage sit alone on a line.
- **K. Mobile Find Parking.** The results list is capped at 310 px and the 470–600 px map sits directly under it. Combined with the ~770 px filter form, the first result is about two screens down.
- **L. Missing CSS rules.** The `role-emerald` / `role-graphite` accent classes are emitted, but **no CSS uses them**, so per-role accent theming doesn't exist today; keeping it is really a new design decision. Also `badge-warning` (vendor role in AdminUsers) and the draft location badge (`badge ` with no tone) render unstyled.
- **M. VendorProfile's status badge is always green**, whatever the actual status.
- **M2. Verification copy mangles acronyms.** The `label()` helper turns `PAN`, `GSTIN`, `CIN` and `NOC` into "Pan", "Gstin", "Cin" and "Noc", while the category select shows raw `IDENTITY`. The two consent rows also use different sizes (11 px vs 15 px). A display-name map is needed (Phase 6).
- **M3. Tables scroll inside their card on mobile.** `table { min-width: 690px }` pushes the Status and Action columns off-screen at 390 px (vendor slots and bookings, all admin tables). There is no page-level overflow, but the primary actions are hidden. This is the main argument for the card-collapse `DataTable`.

**Behaviour and robustness** (flagged only; out of scope for a presentation redesign unless you say otherwise)
- **N. Stale default times.** `BookingPage`'s `defaultStart` is computed when the module loads, so default arrival times go stale in a long-lived tab.
- **O. Unguarded storage.** `NearbyMapPage` reads `localStorage` and runs `JSON.parse` without try/catch inside the error path. Private mode or a corrupt cache turns a network error into a crash of that handler. I'll make reads safe in `useDiscoveryCache` without changing the cache key or shape.
- **P. Bundle.** No route-level code splitting: Leaflet, better-auth and every page ship to the landing page. `leaflet.css` is imported twice (`index.js` and `NearbyMapPage`).
- **Q. Legacy data sources.** The customer dashboard and the admin dashboard occupancy still read legacy `ParkingSlot` stats (see #10).
- **U. Opening the location editor fires an address-autocomplete request.** `createInitialState` sets `search` to the saved address, and `AddressAutocomplete`'s effect runs on mount because `skipNextSearch` starts `false`. With Geoapify configured, every edit-page load costs a Geoapify call and opens a suggestion dropdown over the form. With it unconfigured (as in this baseline) it shows "Geocoding is not configured" in amber above a "Location selected" tick. Fix in the rewrite: skip the search when the value equals the verified selection.
- **R. Errors only reach toasts.** Several load failures are swallowed (`Promise.all(...).finally` with no catch in Dashboard, AdminDashboard, AdminSlots, AdminUsers, AdminBookings, MyBookings, VehiclesPage, and the VendorSlots location load), leaving an empty screen with no error state.
- **S. OSM tiles.** `tile.openstreetmap.org` is used directly. Its usage policy allows light use with attribution, but it isn't meant for production apps, and `LocationMapSelector`'s attribution lacks the required link. Phase 4 should pick a provider whose terms fit (MapTiler, Stadia or Carto are the usual options) and keep attribution.
- **T. Tailwind v4 browser floor.** v4 targets Safari 16.4+, Chrome 111+ and Firefox 128+. Today's browserslist (`>0.2%, not dead`) is broader. Probably acceptable for an Indian mobile audience in 2026, but it's a real support change you should sign off on.

---

## 6. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **The Vite migration breaks the Vercel deploy** (framework preset still "Create React App"; output dir; env names) | Medium | `build.outDir: 'build'`, `envPrefix: ['VITE_', 'REACT_APP_']`, `vercel.json` SPA rewrite. **You** check the Vercel preset and build command on the first preview deploy. |
| **CI job names drift**, breaking required checks | Low | Edit only the step contents; job ids and names stay `frontend-ci` / `backend-ci`. |
| **JSX `.js` → `.jsx` rename loses blame and history** | Low | `git mv`, in a rename-only commit separate from content edits. |
| **Jest → Vitest semantics** (`test.each`, `describe`, `renderToStaticMarkup`) | Low | All 19 tests are pure or static-render; `globals: true` keeps them as written. |
| **Socket regressions** when centralising into `useAvailabilitySocket` (debounces 300 / 180 ms, location filter, the reconnect bug) | Medium | Hook unit tests with a fake socket; click-through on booking and vendor slots with two browser tabs. |
| **Restyling the vehicle flow breaks dependent resets** | Medium | Keep `VehiclesPage` state logic; swap only presentational components. Test the legacy-vehicle edit path explicitly. |
| **Community components** (21st.dev, React Bits, Magic UI) bring a11y, licence or reduced-motion debt | Medium | At most two sources; record author and licence per component; add reduced-motion handling; review every file. |
| **The landing Live Lot hurts LCP and CLS** | Medium | Lazy-load after the hero text, reserve its box, static first frame, pause off-screen; Lighthouse in Phase 3. |
| **Long-lived mixed styling** (legacy `index.css` and Tailwind) | High during Phases 2–6 | Tailwind preflight scoped carefully; legacy CSS shrinks per screen; deleted in Phase 7. |
| **`index.css`'s `transform: none` reduced-motion rule fights Motion** | Certain if left | Replace it in Phase 1c with motion-only reductions plus `<MotionConfig reducedMotion="user">`. |

---

## 7. Tooling recommendation

**Recommendation: migrate to Vite (Phase 1 as the brief describes it).** The risk is moderate and well understood.

Why:
- CRA 5 is unmaintained. It's the source of almost all of the 99 audit findings and the forced `legacy-peer-deps`.
- The shadcn CLI, the `@/` alias, Tailwind v4's Vite plugin and 21st.dev snippets all assume this setup.
- The app is small (51 source files, 19 tests). It has no CRA-specific features beyond `proxy`, `process.env.REACT_APP_*` and Jest.
- Dev-server startup and HMR get much faster, which pays for itself across Phases 2–7.

Specifics beyond §4 of the brief:
1. Vite 7 needs Node ≥ 20.19. CI's `node-version: 20` resolves to the latest 20.x and this machine has 20.20.2, so both are fine. Pin `engines.node` to `>=20.19`.
2. `server.proxy` should cover `/api` **and** `/socket.io` with `ws: true`. Today the sockets use an absolute URL, so this only matters if `lib/env.js` defaults to relative URLs in dev, which I'd recommend.
3. Keep `REACT_APP_API_URL` / `REACT_APP_AUTH_URL` readable through `import.meta.env` via `envPrefix`, and add an optional `REACT_APP_SOCKET_URL` (derived by default) so nobody has to change Vercel settings.
4. Standardise local docs on **5001**: README, `frontend/.env.example`, the Vite proxy. `backend/.env.example` and the backend default port are backend files. I'll leave them and list the mismatch in the Phase 1 report unless you say otherwise.
5. Remove `react-scripts`, the unused `yaml` dev dependency and (if peer deps resolve) `.npmrc`. Each removal is called out in the commit.

**Fallback (if you don't want the migration):** stay on CRA, add design tokens as CSS custom properties with hand-written CSS Modules, plus Motion (works under CRA's webpack 5). Tailwind **v3** can run on CRA via its built-in PostCSS support. What you lose: the `@/` alias without CRACO, a clean shadcn CLI, and drop-in 21st.dev snippets. Primitives would be Radix UI used directly, with styles written by hand. Expect roughly 30–40 % more effort in Phase 2, and the audit debt from `react-scripts` stays.

---

## 8. Three design directions

All three share the non-negotiables:
- Status is semantic and never the brand colour.
- Every slot state has a text label.
- WCAG 2.2 AA in both themes.
- Motion only explains state.
- Mono numerals for plates, bay IDs and prices.
- Live Lot hero; no fabricated proof.

### A. Wayfinding (the brief's concept) — recommended

City and airport signage brought to life: confident, legible at a glance, made from parking's own visual language.
- **Colour:** parking-sign blue brand (`#2563EB` family, 5.2:1 against white). Traffic-light status: available green, reserved amber, occupied coral-red, maintenance slate with a hatch pattern, EV cyan with a bolt, selected shown as a brand-blue ring. Cool blue-grey neutrals. Road-paint yellow used sparingly. Dark mode is "asphalt night" with glowing bays.
- **Type:** Bricolage Grotesque (display; its optical sizes give signage punch at hero sizes and stay calm at 20 px), Geist (UI), Geist Mono (plates, IDs, prices, tabular numerals). All self-hosted.
- **Motifs:** bay-line dashes as dividers and loaders; route arrows for progress; a "P" logomark built from a bay line and a route pin; barrier-arm motion on confirm.
- **Strengths:** instantly says "parking", scales cleanly to dense admin tables, and status semantics are built in.
- **Risks:** blue SaaS can drift generic. The motif discipline (bay lines, signage type, real slot tiles) is what keeps it distinct. EV cyan must stay clearly separate from brand blue.

### B. Night Lot — dark-first, high-contrast operations

An after-dark multistorey car park: asphalt surfaces, white and yellow line paint, sodium-lamp warmth, status lights that glow.
- **Colour:** dark-first (charcoal `#111418`-ish surfaces). Brand is road-paint yellow (`#F5C518`-ish) on dark, with near-black text on yellow buttons. Status lights in saturated green, amber and red with a soft glow. Light mode is "concrete daylight", the secondary theme.
- **Type:** Space Grotesk or Archivo Expanded for display (wide, stencil-adjacent), Inter Tight for UI, JetBrains Mono for data.
- **Motifs:** painted arrows, kerb stripes, floor-level markers ("L2 · B-row"), headlight sweeps in the hero.
- **Strengths:** very distinctive, and the Live Lot looks spectacular. Operators running a night-shift desk get a comfortable dark UI.
- **Risks:** yellow brand plus amber "reserved" is a semantic collision that would need re-mapping (reserved becomes violet or blue). Dark-first data tables are harder to get to AA. Marketing looks stunning, but daytime driver use on phones skews to light mode.

### C. Permit — evolve today's identity

Keep the existing cream and teal brand equity, but make it intentional: municipal permits, parking tickets, stamped receipts.
- **Colour:** refined cream and paper surfaces. Teal brand deepened for AA on small text. Status keeps traffic-light semantics (today's coral "maintenance" moves to slate). Ink-blue secondary. Dark mode is "carbon paper".
- **Type:** Instrument Sans (UI) + Instrument Serif or Fraunces (display moments only), IBM Plex Mono for ticket numbers.
- **Motifs:** ticket and booking cards with perforated edges and stub tear-offs, stamp marks for "Verified" and "Reserved", receipt-style booking summaries, punch-hole progress.
- **Strengths:** lowest-risk evolution; existing users still recognise the product; the ticket motif fits My Bookings and the confirmation flow beautifully.
- **Risks:** warmer and more editorial, so less "live and real-time" energy in the hero. The serif display can feel lifestyle rather than utility. The Live Lot needs a paper-map treatment to fit.

**My pick: A (Wayfinding), borrowing C's ticket-stub treatment for booking cards and confirmations.** The ticket fits the domain without diluting the signage system.

---

## 9. Phase plan

The brief's phases are kept. My adjustments are marked ★.

| Phase | Scope | Commits (one per sub-phase) | Gate |
|---|---|---|---|
| **0** | This audit + baseline | none (needs your approval) | **Your approval** of tooling, direction, plan |
| **1a** | CRA → Vite: `git mv` JSX files to `.jsx` (rename-only commit ★), `vite.config.js`, `lib/env.js` (all 3 URLs, fixes #9), Vitest, `vercel.json`, CI steps (job names unchanged), README frontend setup on 5001 | `chore(frontend): rename JSX modules to .jsx` ★ · `chore(frontend): migrate CRA to Vite` | 19/19 tests, build, all routes boot against the local backend, login works |
| **1b** | Tailwind v4 + shadcn (`tsx: false`), `cn()`, Motion; lucide upgrade with an icon-name check | `chore(frontend): add Tailwind v4 and shadcn/ui` | Build + visual parity spot check (preflight doesn't break legacy screens) |
| **1c** | Tokens (light + dark), self-hosted variable fonts (fixes #3), theme toggle with no-flash script, favicon / manifest / OG, `theme-color`; **replace the broken reduced-motion block** ★ (5.A); visible focus ring ★ (5.B) | `feat(frontend): design tokens, fonts, theming` | Contrast check of the token pairs; no flash of the wrong theme |
| **2** | Kit (§7 of the brief) + `useAvailabilitySocket` (fixes the reconnect-per-keystroke bug ★) + `ConfirmDialog` (9 call sites) + single `StatusBadge` (3 duplicate sites) + `/_design` | `feat(frontend): primitives…` · `feat(frontend): cross-cutting kit…` | Style guide reviewed by you in light + dark |
| **3** | Landing + Live Lot (`useLotTimeline` reducer with unit tests) + auth | per section | **Stop:** screenshots + hero recording, your approval |
| **4** | App shell (`Sidebar` extracted, `inert` drawer, ⌘K, mobile tab bar) + customer workspace; tile provider decision ★ | per surface | Search → book (regular + EV), add vehicle, cancel, all clicked through |
| **5** | Vendor workspace (except Verification) incl. coming-soon pages | per surface | Create location → manage EV slots, clicked through |
| **6** | Admin workspace + Verification (vendor + admin console), data-driven providers | per surface | Review flow clicked through |
| **7** | Motion / a11y / perf passes, route code-splitting, delete `index.css` + `SlotsPage` (if approved) + dead classes, README screenshots | per pass | Definition of Done |

**Every phase gate:** tests and build green; screenshots at 1440 / 1024 / 768 / 390 (+320 for overflow) into `docs/redesign/screens/phase-N/` using the same headless-Chrome driver; a `web-design-guidelines` review (once installed, see §10); a report in the brief's §9 format.

★ **Fixtures:** the disposable-Mongo approach worked against the real backend, so MSW isn't needed for screenshots. I'd like to commit the seed and screenshot scripts under `docs/redesign/tools/` (no backend changes) so every phase reproduces the same data.

---

## 10. Skills, plugins and MCP servers

**Found in this session**

| Tool | Status | Use |
|---|---|---|
| Built-in browser (`Claude_Browser`) and Claude in Chrome | Available | Interactive checks. Batch screenshots went through headless Chrome, since these tools return images to me rather than writing files. |
| `drawio` plugin | Installed | Optional flow diagrams |
| `dataviz` skill | Available | Vendor and admin charts (colour-blind-safe palettes, text labels) |
| `code-review`, `simplify`, `security-review` skills | Available | Per-phase self-review |
| Claude Docs, visualize, Google Drive-style connector, iOS simulator | Available | Not needed for this work |
| Local: Chrome, `mongod` 7.0, `mongosh`, Docker CLI, Python `websocket-client` | Present | Baseline + fixtures |

**Missing (you said you'd install these)**

| Tool | Status | Note |
|---|---|---|
| `frontend-design` skill | **Not installed.** It is listed in the `claude-plugins-official` marketplace you already have. | Install from the plugin UI or `/plugin` in a terminal session. |
| 21st.dev Magic MCP | **Not configured** (no user or project MCP servers) | Needs an API key from 21st.dev; add to project or user MCP config. |
| shadcn MCP | **Not configured** | Optional. The shadcn CLI after Phase 1b covers it. |
| Playwright MCP | **Not configured** | Optional. The headless-Chrome driver already works. |
| Vercel agent-skills: `web-design-guidelines`, `react-best-practices`, `composition-patterns` | **Not installed** | The per-phase `web-design-guidelines` review gate depends on this. |
| React Bits / Magic UI registries | Nothing to install now | Pulled via the shadcn CLI after Phase 1b |

---

## 11. Open questions for you

1. **Tooling:** approve the Vite migration (§7), or take the CRA fallback?
2. **Direction:** A (recommended, with C's ticket stubs), B, or C?
3. **Tailwind v4 browser floor** (5.T): acceptable?
4. **`SlotsPage.js`:** delete in Phase 7?
5. **Fixture scripts:** OK to commit them under `docs/redesign/tools/`?
6. **Per-role accents:** they don't exist today (5.L). Do you want driver/vendor and admin variations designed in, or one theme?
7. **Toasts:** I propose Sonner (ships with shadcn, token-themed, accessible live region, and an API close to react-hot-toast's, so call sites barely change). OK?
8. **Robustness fixes:** the guarded `localStorage` read (5.O) and the socket reconnect fix (#8) change no behaviour contracts. OK to include them where I touch that code, or flag only?
9. **Port docs:** OK to standardise frontend docs on 5001 and leave the backend files (out of scope)?
