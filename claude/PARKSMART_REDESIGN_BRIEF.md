# ParkSmart — Complete Frontend Redesign Brief

> **For Claude Code.** Read this whole file before touching anything. You are working in the existing ParkSmart repo (`frontend/` = React app, `backend/` = Node/Express/MongoDB). Your job is a **presentation-layer redesign of the entire frontend** so ParkSmart looks and feels like a finished, modern product. Features will be added *after* this, so leave the codebase cleaner and easier to extend than you found it.

---

## 0. Mission and ground rules

**Mission.** Transform every screen (landing, auth, customer, vendor, admin) into a cohesive, modern, animated, accessible product UI. The landing page must include an **animated parking-lot visual that explains what ParkSmart does within ~10 seconds** (see §6).

**Ground rules**

1. **Scan before you build.** Do Phase 0 (§1) first. **Make no edits until you have shown me the audit, the plan, the design direction and the tooling decision, and I have approved them.**
2. **Git.** Create `feature/frontend-redesign` from the current HEAD (currently `feature/vendor-verification`, Phase 5A *not merged*). Never commit to `main`, never merge, never push without asking. One commit per sub-phase, conventional-commit messages. Ignore the stale `feature/ui-redesign` branch (it deletes ~5k lines relative to `main`).
3. **Backend is out of scope.** Do not modify `backend/`. API contracts, roles, route guards and Socket.IO events stay exactly as they are.
4. **Behaviour parity.** Redesign how things look and flow, not what they do. The "do not break" list is in §3.
5. **Stay in JavaScript.** No TypeScript conversion. (shadcn supports JS via `"tsx": false` in `components.json`; 21st.dev snippets arrive as TSX — convert them to JSX.)
6. **Every phase ends with**: tests green, production build green, screenshots at 1440 / 1024 / 768 / 390 px, a `web-design-guidelines` review, then a commit and a short report (§9).
7. **No fabricated social proof.** No invented user counts, partner logos, testimonials, reviews or statistics anywhere (landing included). Sample data inside illustrations must be labelled "Illustrative".
8. **Don't invent features.** Where a mock needs something the product doesn't do (e.g. QR passes, calendar export, notifications), leave it out.

---

## 1. Phase 0 — Scan and audit (mandatory, read-only)

Do this properly; I have only skimmed the code. Read, don't grep-and-guess.

**1.1 Read, in this order**
- `README.md` (all of it), `.github/workflows/ci.yml`, `frontend/package.json`, `frontend/.npmrc`, `frontend/.env.example`, `frontend/public/index.html`
- `frontend/src/index.js`, `App.js`, `index.css` (**all 703 lines** — it is the entire current design system), `context/AuthContext.js`, `lib/authClient.js`, `services/api.js`, `utils/*`
- **Every file** in `src/components/**` and `src/pages/**` (≈45 files, ≈4.2k lines). Open each one; note what it renders, what state/effects it has, and which API calls and sockets it uses.
- Skim `backend/routes/*` and `backend/server.js` only to understand API shapes and Socket.IO events the UI depends on. Do not change them.

**1.2 Run a baseline**
- `cd frontend && npm ci && CI=true npm test -- --watchAll=false && npm run build`. Expected today: **4 suites, 19 tests passing**. Record build size.
- Start the app and capture baseline screenshots of every route at 1440 / 1024 / 768 / 390 px into `docs/redesign/baseline/`. Authenticated screens need the backend + MongoDB (see README; use a disposable DB). If you can't run them, say so and build a dev-only fixtures layer (MSW), excluded from production builds.

**1.3 Verify these initial findings (from my review — confirm or correct each)**

| # | Finding |
|---|---|
| 1 | Stack: **Create React App** (`react-scripts` 5.0.1, deprecated), React 18, react-router 6, axios, better-auth client, leaflet/react-leaflet, socket.io-client, lucide-react ^0.383, react-hot-toast, date-fns. `.npmrc` forces `legacy-peer-deps`. **No Tailwind, no TypeScript, no component library, no animation library.** |
| 2 | One global 703-line `src/index.css` ("warm urban mobility": cream `#f5f2ea`, teal `#147d6f`), with a block of legacy alias variables (`--bg-primary`, `--accent`, …) kept for older components. Only 6 `@keyframes`; breakpoints at 1180/1080/960/720/430 px; one `prefers-reduced-motion` block. |
| 3 | **Font bug:** `public/index.html` loads *Space Mono* and *DM Sans*, but the CSS font stack is `Inter, Manrope, …`, which are never loaded → users get system fonts. `theme-color` is `#0f172a` (navy) against a cream UI. There is **no favicon, manifest or OG image** in `public/`. |
| 4 | **~220 inline `style={{…}}`** props across 20 files (worst: `MyBookings` 20, `SlotsPage` 19, `BookingPage` 18, `VehiclesPage` 17, `AdminSlots` 16, `ParkingLocationForm` 15). Hard-coded hex colours in `App.js` (toaster), `NearbyMapPage`, `BookingPage`, `LocationMapSelector`. |
| 5 | **Duplicated patterns:** `MyBookings` defines its own `StatusBadge`/`PaymentBadge` while `components/ui/StatusBadge` exists; two badge systems (`.badge` and `.status-badge`); hand-rolled `.page-header` blocks vs the `PageHeader` component; two loading styles (`.loading-spinner` vs `LoadingState` skeleton); native `window.confirm` in 8 places (MyBookings, VehiclesPage, AdminBookings/Slots/Users/Vendors, ParkingLocationEditor) → one `ConfirmDialog`. |
| 6 | `AppShell` defines `Sidebar` *inside* the component body and renders it twice (desktop + mobile), so it is recreated on every render. |
| 7 | Landing hero "illustration" is a static CSS composition (`mobility-visual`, `parking-deck`, `bay` spans) — nothing animates. |
| 8 | **Find Parking** (`NearbyMapPage`) packs ~11 native controls into one grid, uses default OSM tiles and an inline-styled `divIcon` marker. The Socket.IO client is created inline in both `NearbyMapPage` and `BookingPage` with duplicated URL derivation. |
| 9 | API URL inconsistency: `.env.example` says `localhost:5000/api`, README says backend on 5000, but `package.json` proxy and the in-code fallbacks use `5001`. → centralise in one `src/lib/env.js`. |
| 10 | Customer dashboard CTAs link to `/dashboard/slots`, which just redirects to `/dashboard/nearby`. The dashboard's "available/occupied" stats come from the legacy `slotsAPI.getAll()`. **Do not change data sources in this redesign — flag it in your report.** |
| 11 | Vendor nav lists Transactions / Earnings / Settings, which all fall through to `VendorPlaceholder` (`:section` route). They need intentional "coming soon" designs, not blank pages. |
| 12 | `VendorVerification.js` and `services/api.js` still contain **DigiLocker** code (the Phase 5A correction removing it is pending). Don't remove it here; make the provider list data-driven so removal later is a one-line change, and redesign the Verification pages **last** (§8, Phase 6). |
| 13 | CI jobs are named `frontend-ci` and `backend-ci` (probably required status checks) — **keep these exact names**. Frontend CI runs `npm ci`, `npm test -- --watchAll=false --passWithNoTests`, `npm run build` on Node 20. Frontend deploys on Vercel; `REACT_APP_*` vars are baked in at build time. No `vercel.json` exists. |
| 14 | Housekeeping I noticed: empty stray directory `{backend/{config,controllers,…},frontend` and a stray root `node_modules`/`package-lock.json` at repo root (not part of the app). Mention, don't delete without asking. |

**1.4 Deliverable of Phase 0** → `docs/redesign/AUDIT.md` containing: route/screen inventory with a one-line verdict each; component inventory (reuse / rewrite / delete); the confirmed-or-corrected findings above; risks; and your **proposed plan** (tooling, design direction with 2 alternative directions, phases). **Then stop and wait for my approval.**

---

## 2. Skills, plugins and tools to use

I'm installing these before you start. Check what's actually available (`/plugin`, `/mcp`, `/skills`) and tell me anything missing.

| Tool | Use it for |
|---|---|
| **`frontend-design` skill** (Anthropic plugin) | Invoke **before** designing each major surface, to avoid generic template output. |
| **21st.dev Magic MCP** (`generate`, `get_inspiration`, `search`, `search_logo`) | Inspiration and starting points for specific sections: hero, nav, bento grid, tabs, feature sections, FAQ, empty states, auth layouts, data tables. Treat output as a *draft*: convert TSX→JSX, replace hard-coded colours with our tokens, remove dead props, check it for accessibility. Note each component's author/licence shown on 21st.dev before shipping it. |
| **Secondary component registries (optional, installed via the shadcn CLI as `npx shadcn@latest add @<registry>/<component>`)** | **React Bits** (`@react-bits/<Name>-JS-TW` gives plain-JS + Tailwind variants — a good fit for this JS codebase; text/background effects) and **Magic UI** (`@magicui/<name>`; marquee, number ticker, animated beams, bento helpers). Use them sparingly for specific effects, not whole pages. Rules: review every file you install (community code); they often **lack reduced-motion handling — add it**; Magic UI needs `motion`; pick **at most two** sources for animated pieces (21st.dev + one registry) so the site doesn't turn into a patchwork; never ship an effect that doesn't serve the Find → Reserve → Park story. |
| **shadcn/ui + shadcn MCP** | The primitive layer (Button, Input, Select, Dialog, AlertDialog, Sheet, Tabs, Table, Command, Popover, Tooltip, DropdownMenu, Skeleton, Badge, Card, Switch, Slider, Calendar, Sonner, charts). Add components via CLI, not by hand-copying. |
| **`web-design-guidelines`**, **`react-best-practices`**, **`composition-patterns`** (Vercel agent-skills) | Run `web-design-guidelines` on every phase's changed files before committing; `react-best-practices` for the performance pass; `composition-patterns` when designing component APIs (avoid boolean-prop sprawl). |
| **Motion** (`npm i motion`, `import { motion } from "motion/react"`) | All animation. Use `LazyMotion` + `domAnimation` to keep the bundle small and `<MotionConfig reducedMotion="user">` at the root. |
| **A browser** (Playwright MCP, or the built-in/Chrome browser) | Screenshots and interaction checks at every phase. You must *look* at the result, not just compile it. |

---

## 3. Do-not-break list

- **Auth & routing:** `ProtectedRoute` logic, `getDefaultRoute`, roles `customer | vendor | admin | super_admin`, `approvedVendor` gating, vendor-application flow, `AuthContext` API (`login`, `register`, `logout`, `refreshUser`, `isSuperAdmin`).
- **API layer:** `services/api.js` function names and payloads; axios `withCredentials`; global 401 redirect.
- **Parking domain logic:** everything in `utils/hybridParking.js` (EV vs capacity booking, `bookingPayloadForVehicle`, `shouldShowEVSlotBoard`, `isAvailabilityEventForLocation`…), its tests, and the rule **`fuelType === "electric"` ⇒ exact EV-slot booking; everything else is capacity-based**.
- **Real-time:** Socket.IO `availability:changed` handling with debounce (300 ms discovery, 180 ms booking), location filtering.
- **Find Parking:** geolocation with Pune fallback, `localStorage` cache (`parksmart-location-discovery-v1`) + "cached result" indicator, filter semantics, URL query hand-off to the booking page.
- **Vehicles:** the dependent flow *License plate → Make → Model → Model year → Vehicle type → Body style → Fuel → Colour → Default*, with its loading / retry / error / empty states and safe legacy-vehicle editing.
- **Verification & admin:** consent checkboxes before any provider call, private document download flow, status vocabulary (`NOT_STARTED, PENDING, UNDER_REVIEW, VERIFIED, REJECTED, RESUBMISSION_REQUIRED`), publishing and payout rules shown in the UI.
- **Accessibility already in place** (must only get better): `EVSlotBoard` uses `role="listbox"`/`option`, labels like "EV02, 60 kilowatt, Available", disabled unavailable states; six slot states (`available, selected, reserved, occupied, maintenance, unavailable`) each with a **text label, not colour alone**; focus rings; reduced-motion support.
- **Tests:** the existing 4 suites / 19 tests must keep passing (port to the new runner if tooling changes; don't delete tests to make them pass).
- **Env var names:** `REACT_APP_API_URL`, `REACT_APP_AUTH_URL` must keep working so Vercel settings don't need to change.
- **Responsive:** no horizontal page overflow at 320, 390, 768, 1024, 1440 px (previous work verified this — don't regress).

---

## 4. Phase 1 — Foundation (tooling) — *requires my approval at the end of Phase 0*

**Why:** 21st.dev snippets, the shadcn CLI and Tailwind v4 assume a Vite-style toolchain with a `@/` import alias; CRA 5 is unmaintained and can't support them cleanly. This is the one big structural decision — **present it in the audit with your recommendation and the fallback** (stay on CRA + hand-written CSS + Motion, which loses 21st.dev/shadcn). If you judge the migration too risky, stop and tell me.

**If approved, as separate commits:**

1. `chore(frontend): migrate CRA to Vite` —
   - `vite` + `@vitejs/plugin-react`; `index.html` at `frontend/` root; scripts `dev`/`start`, `build`, `preview`, `test`.
   - **JSX-in-`.js` is not supported by Vite.** `git mv` every file that contains JSX to `.jsx` (pages, components, `context/AuthContext`, tests). Pure logic files stay `.js`. Update imports.
   - `vite.config.js`: dev **port 3000**; `server.proxy['/api'] → http://localhost:5001` (mirrors today's `proxy`); `build.outDir: 'build'` (keeps Vercel's output dir unchanged); `envPrefix: ['VITE_', 'REACT_APP_']` so existing env names keep working; alias `@` → `src`.
   - Replace all `process.env.REACT_APP_*` with one `src/lib/env.js` (API URL, auth URL, socket URL). Fix finding #9.
   - Add `frontend/vercel.json` with an SPA rewrite to `/index.html`. Tell me to double-check the Vercel framework preset.
   - Tests → **Vitest** + `@testing-library/react` + `jsdom`, `globals: true`, so existing `test()/expect()` code runs unchanged. Update `.github/workflows/ci.yml` accordingly **keeping job names `frontend-ci` / `backend-ci`**, Node 20, and no secrets.
   - Remove `react-scripts`, `.npmrc`'s `legacy-peer-deps` if no longer needed. Update README frontend setup (ports/commands).
   - Gate: 19/19 tests, `npm run build`, app boots, all routes load, login works against local backend.
2. `chore(frontend): add Tailwind v4 and shadcn/ui` — `tailwindcss` + `@tailwindcss/vite`; `jsconfig.json` with `@/*`; `npx shadcn@latest init` with `tsx: false`, CSS variables on; `clsx`, `tailwind-merge`, `class-variance-authority`, `cn()` helper; `motion`; upgrade `lucide-react` (verify every icon name still exists).
3. `feat(frontend): design tokens, fonts, theming` — tokens (§5), self-hosted variable fonts via `@fontsource-variable/*` (**fixes finding #3**), dark mode (`.dark` class, system default + toggle, persisted in `localStorage` inside try/catch, no flash-of-wrong-theme via a tiny inline script in `index.html`), real favicon / manifest / OG image, corrected `theme-color`.

Migrate legacy CSS **incrementally**: new surfaces use Tailwind + shadcn; the old `index.css` shrinks screen-by-screen and is **deleted entirely by the final phase**. No big-bang rewrite, no long-lived broken states.

---

## 5. Design direction (default — propose 2 alternatives in the audit, then follow what I pick)

**Concept: "Wayfinding."** ParkSmart should feel like the best airport/city signage system came to life: confident, legible at a glance, built from the visual language of parking itself — painted bay lines, route arrows, "P" signs, EV bolt markers, barrier-arm motion. Not another purple-gradient SaaS template.

**Colour (starting point; refine with the `frontend-design` skill and check contrast)**
- **Brand = parking-sign blue** (≈ `#2563EB` family). **Status = traffic-light semantics, never brand colour**, so "available" always reads as available:
  - available → green · reserved → amber · occupied → red/coral · selected → brand blue ring · EV → cyan/teal + bolt icon · maintenance → slate with hatch pattern · unavailable → muted.
- Neutrals: cool, slightly blue-tinted greys. Optional "road-paint yellow" accent used *sparingly* (lane dashes, highlights on the hero).
- Light and dark themes both first-class. Dark hero = asphalt-night with glowing bays. Define semantic tokens (`--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--brand`, `--slot-available`, …) as CSS variables mapped into Tailwind's `@theme`; **no raw hex in components** (also removes the hex in the toaster and Leaflet markers).
- WCAG 2.2 AA: 4.5:1 text, 3:1 UI components and focus rings, in both themes.

**Type:** display *Bricolage Grotesque* (or a better choice you justify), body *Geist* (or Inter Tight), numerals/plates/slot IDs/prices in *Geist Mono* with tabular figures. Fluid type scale for headings. Self-hosted.

**Shape & surface:** 12–16 px radii, hairline borders over heavy shadows, subtle inner highlights, one restrained texture (asphalt noise) used only on hero/CTA backdrops. Bay-line dashes as a recurring divider/loader motif.

**Motion principles**
- Motion must *explain state* (a bay turning reserved, a route being drawn, a booking confirming) — not decorate.
- UI transitions 150–250 ms; hero choreography 0.6–1.2 s per beat; springs for selection; 40 ms stagger for lists; count-up on metric tiles; shared-layout (`layoutId`) for the active nav/tab indicator; shape-matched skeleton loaders.
- Animate only `transform`/`opacity`. Pause off-screen animations (IntersectionObserver). `prefers-reduced-motion` → static equivalent that still communicates the same information. Motion never blocks input.

**Brand:** replace the lucide `ParkingCircle` + text with a real SVG logomark (a "P" built from a bay line + route pin), wordmark, favicon set. Reserve a `VehicleBrandLogo` component (generic icon fallback now) — Logo.dev integration is a *later* phase, don't implement it.

---

## 6. Landing page (`/`) — the showpiece

Sections, in order:
1. **Sticky nav** — glass-on-scroll, theme toggle, "Sign in" / "Get started", mobile sheet menu.
2. **Hero** — headline (keep the voice: "Parking, without the searching."), one-line value prop, primary/secondary CTAs, 3 truthful proof chips (e.g. "Live slot status", "EV bay booking", "Verified operators"), and the **Live Lot** (below).
3. **How it works** — Find → Reserve → Park, three steps, **synchronised with the Live Lot timeline**; on desktop make it a sticky scroll-story where the lot scene changes as you scroll.
4. **Feature bento grid** — live availability · map discovery (animated mini map) · EV bay selection (render the *real* `EVSlotBoard`/slot-tile component with sample data) · vehicle-aware search (car/bike, fuel) · real-time updates · verified operators.
5. **Three audiences** — tabs for Drivers / Operators / Admins, each showing a live-rendered mini product UI (components + sample data, not screenshots).
6. **Trust** — how vendor verification works (private document review, per-location authorisation, admin approval). Must match the real Phase 5A behaviour; no overclaiming.
7. **FAQ** accordion (accurate only), **final CTA** with animated bay lines, **footer**.

### The Live Lot (hero visual)
A top-down parking lot built in **inline SVG + Motion**, original artwork only (generic car silhouettes — no real brands/models).

- ~3 rows × 8 bays, one lane, an entrance, **two EV bays** with bolt icons and a charge-fill bar. Bays carry IDs (A1…C8) in mono type.
- A header chip with a live counter ("**14 of 24** free") that ticks as the scene changes, plus an "Illustrative" label.
- **Looping ~12 s story, driven by a deterministic timeline hook (`useLotTimeline`, not `Math.random`):**
  1. Lot fades in; some bays occupied, a couple reserved, rest free.
  2. A "You" pin appears at the entrance; a soft radar pulse; free bays highlight.
  3. A bay is chosen; a dashed **route line draws itself** (stroke-dashoffset) from the pin to the bay; ETA chip appears.
  4. A compact booking card slides in: bay ID · time window · rate → bay flips to **Reserved** (counter −1).
  5. A car drives in along the lane and parks; bay becomes **Occupied**; step 3 of "Find → Reserve → Park" lights up.
  6. Another car leaves elsewhere; a bay frees up (counter +1) — "updated in real time". Loop.
- **Interactive:** hovering/focusing a bay shows a tooltip ("B4 · Available · ₹60/hr"); clicking a free bay replays the reserve beat. Keyboard accessible.
- Uses the same slot-state tokens and labels as the app's `EVSlotBoard`, so the marketing visual and the product match.
- `prefers-reduced-motion`: render a still frame of step 4 plus a text description. Pause when off-screen. Give the SVG a meaningful `aria-label`/`<desc>`. Lazy-load the scene so it doesn't block LCP; reserve its box to avoid layout shift. Smaller grid on mobile.
- Reuse a mini version in the auth screens (replacing the static route art), empty states (an empty-bay illustration) and as a loader.
- Put the timeline logic in a pure reducer/hook and unit-test it.

---

## 7. Surface-by-surface scope

**Cross-cutting kit (build once, in Phase 2, then use everywhere):** Brand/logo, Button/Input/Select/Switch/Slider/Calendar-time picker, form field + inline validation pattern, Card, single `StatusBadge` (replaces both badge systems and the duplicates in `MyBookings`), `PageHeader`, `MetricCard` (count-up), `EmptyState`, shape-matched `Skeleton`s, `DataTable` (sticky header, filter/search, pagination, **collapses to cards on mobile**), `ConfirmDialog` (replaces all 8 `window.confirm` calls), `SlotTile`/`SlotBoard` (shared by EV board, landing and vendor ops), `SearchableSelect` rebuilt on Command/Popover (same props/behaviour), toasts (Sonner or restyled react-hot-toast — your call, justify it), error states, `useAvailabilitySocket` hook (centralises both inline socket clients), a dev-only `/_design` style-guide route listing every primitive in both themes (excluded from production).

**Auth (`/login`, `/register`)** — split layout with the mini Live Lot, polished forms, password reveal, clear inline errors, loading states. Don't change auth logic.

**App shell (all three workspaces)** — collapsible sidebar with animated active indicator; ⌘K command palette (navigation + the existing quick actions only); top bar with breadcrumbs and a user menu (profile, theme, sign out); role chip; mobile = bottom tab bar for the customer workspace + sheet for the rest. Extract `Sidebar` out of the render body (finding #6). Keep the per-role accent theming (`emerald` for driver/vendor, `graphite` for admin) as a deliberate, tasteful variation.

**Customer**
- *Dashboard:* greeting, metric tiles with count-up, next/recent bookings, quick actions. Fix CTA targets to `/dashboard/nearby`.
- *Find Parking (flagship):* map-first split view. Floating search bar with a vehicle chip (type/fuel icon) and time-range presets (Now · +1 h · +2 h · Custom); the other filters move into a popover/sheet (radius slider, sort segmented control, max price, amenity chips, available-only, EV-only). Result cards with availability meter, price, distance, EV badge. Map with **price-pill markers coloured by availability**, card↔marker hover/selection sync, theme-matched tiles (**check the tile provider's usage terms and keep attribution**), lazy-loaded Leaflet. Mobile: map + draggable bottom-sheet list. Preserve every behaviour in §3.
- *Booking:* stepper (Vehicle & time → Spot → Review), sticky summary (duration, rate, estimate). EV bays drawn as a **top-down bay diagram** with charger power/connector, six distinct states, spring on select, polite `aria-live` for availability changes. Animated confirmation. Capacity-booking path for regular vehicles keeps its explanatory copy.
- *Vehicles:* card grid with an Indian-style number-plate treatment (EV = green plate stripe) and the `VehicleBrandLogo` slot; add/edit in a Sheet with the full dependent flow intact.
- *My Bookings:* tabs with counts, ticket-style cards, status timeline, `AlertDialog` cancel.
- *Profile:* sectioned settings layout.

**Vendor** — dashboard (occupancy bar/ring, KPIs; shadcn charts with colour-blind-safe palettes and text labels, not colour alone), locations as cards + a multi-step editor (details → address/map → pricing/hours → capacity/EV → review; keep `AddressAutocomplete` / `LocationMapSelector` behaviour), slot-operations board (EV bay grid + table, maintenance controls), bookings table, business profile, application/status pages, designed "coming soon" pages for Transactions/Earnings/Settings (finding #11). **Verification page last** (finding #12): progress stepper, provider cards driven by data, consent rows, evidence upload states, per-location authorisation.

**Admin** — dashboard with proper charts and tables, Users / Vendors / Bookings / Slots as `DataTable`s with detail sheets, and a **Verification Review console**: case list left, case detail right, evidence viewer, approve / reject-with-reason / request-resubmission dialogs, audit-trail timeline. (Do this after the 5A DigiLocker correction lands, or keep it provider-agnostic.)

**Everywhere:** real empty / loading / error states; skeletons shaped like their content; consistent focus-visible rings; ≥44 px touch targets on mobile; semantic landmarks + skip link; lazy-loaded routes.

---

## 8. Phases and gates

| Phase | Scope | Gate before moving on |
|---|---|---|
| **0** | Scan, baseline, audit, plan | **My approval** of plan, direction, tooling |
| **1** | Foundation (§4) | Tests/build/CI parity; app behaves identically |
| **2** | Tokens, primitives, cross-cutting kit, `/_design` page | Style guide reviewed in light + dark |
| **3** | Landing page + Live Lot + auth screens | **Stop. Show me screenshots + a short screen recording of the hero. I approve before continuing.** |
| **4** | App shell + customer workspace | Core flows (search → book, add vehicle, cancel) clicked through in the browser |
| **5** | Vendor workspace (except Verification) | Create location → manage slots flow clicked through |
| **6** | Admin workspace + Verification pages (both roles) | Review flow clicked through |
| **7** | Polish: motion pass, a11y pass, perf pass, delete `index.css` and dead classes, zero stray inline styles (dynamic values excepted), README frontend section with screenshots | Definition of Done (§10) |

---

## 9. Reporting format (end of every phase)

Short and concrete: what changed · screenshots path (`docs/redesign/screens/phase-N/`) · test + build results · bundle-size delta · deviations from this brief and why · open questions · any bug or data issue you noticed but deliberately did not fix · commit hash(es) · `git status` · confirmation `main` is untouched.

---

## 10. Definition of Done

- All routes redesigned; no screen still on the legacy look; `index.css` legacy removed; no raw hex in components; inline `style={{}}` only for genuinely dynamic values.
- Light + dark themes both complete and contrast-checked.
- Frontend tests green (≥ the original 19), `npm run build` green, CI green, no console errors on any route.
- Screens verified at 320 / 390 / 768 / 1024 / 1440 px with no horizontal overflow.
- Keyboard-only walkthrough of login → find → book → my bookings works; focus visible everywhere; reduced-motion verified; Lighthouse (mobile) on `/`: Performance ≥ 90, Accessibility ≥ 95, CLS < 0.1; routes code-split; Leaflet and the Live Lot lazy-loaded.
- `web-design-guidelines` review run on the final tree with findings resolved or listed.
- No fabricated stats, logos or testimonials anywhere.

## 11. Explicitly out of scope (for now)
Backend changes · new features · payments / Razorpay (Phase 5B) · Logo.dev vehicle logos (only reserve the component slot) · removing DigiLocker (separate Phase 5A correction) · TypeScript migration · i18n.
