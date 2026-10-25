# Redesign progress

Branch `feature/frontend-redesign`. Nothing is pushed; `main` is untouched at `d032c2e`.
Plan, audit findings (numbered 1–14 and lettered A–U) and risks are in [AUDIT.md](AUDIT.md).

| Phase | Scope | Status |
|---|---|---|
| 0 | Audit, baseline, fixture tooling | Done, approved |
| 1 | Vite, Tailwind v4, shadcn, tokens, fonts, theming | Done, approved |
| 2 | Component kit, `/_design` style guide | Done, approved |
| 3 | Landing (Live Lot), sign-in, sign-up | Done, approved |
| 4 | Driver workspace | **Done, waiting for review** |
| 5 (5A/5B) | Operator workspace, except Verification | **Done, waiting for review** |
| 6 | Admin workspace and Verification | Not started |
| 7 | Clean-up and performance pass | Not started |

## Decisions on record

From the review of Phases 1–3:

1. **React 19: no.** Stay on React 18 with the `forwardRef` patches on the shadcn wrappers (guarded by `overlays.test.jsx`).
2. **Vercel:** you are checking the preview; work carries on.
3. **Backend port docs** (5000 in README and `.env.example`, 5001 in code): left alone, listed under follow-ups.
4. **Fonts:** accepted. Legacy pages change look; that is fine.

## Phase 4: driver workspace

| Commit | What |
|---|---|
| `6788a36` | Workspace shell for drivers and operators: collapsible sidebar, ⌘K menu, breadcrumbs, user menu, driver tab bar on phones, skip link |
| `25aa9cf` | Lot Map kit (`components/kit/lotmap`) for exact EV bays and capacity parking |
| `ed6857f` | Driver dashboard and profile |
| `1c0b0ec` | Booking page with the Lot Map, capacity timeline and inline confirmation |
| `cadc763` | Map-first Find Parking |
| `17116f7` | My bookings as ticket stubs |
| `669ab59` | Vehicles: number plates, sheet editor |

Plus `0b674d1`, `b4e5389`, `ff55cf6` (fixes shared with Phase 5, below).

## Phase 5: operator workspace

| Commit | What |
|---|---|
| `8392cff` | Operator dashboard, locations list, five-step location editor, address combobox |
| `317720b` | Editor steps fit phones; clearer EV bay counts |
| `2265714` | EV bays page on the Lot Map |
| `af987d9` | Operator bookings table that becomes cards |
| `2a73b75` | Business profile, coming-soon pages, application and status |
| `0b674d1` | Filters in the URL; unsaved-changes warning in the editor |
| `b4e5389`, `ff55cf6` | One vehicle label everywhere (SUV, EV as acronyms) |
| `8188c6b` | Legacy and Leaflet CSS load only where used |
| `ddb7a05` | Address combobox tests |

Every `/dashboard` and `/vendor` route is on the new surface (dark mode, `data-surface="new"`) except `/vendor/verification` (Phase 6). `REDESIGNED_PATHS` in `src/lib/theme.js` and the pre-paint script in `index.html` match; a test keeps them in sync.

## The Lot Map: where every number comes from

Nothing on the map is invented. Illustrative data appears only in the `/_design` style guide.

- **EV mode** (`EvLotMap`): bays and states come from `availability.evSlots` on the existing `GET /parking-locations/:id` call for the chosen window. Six states, each with a text label; listbox and option roles with roving tabindex, arrow keys by row and column, Home and End, and the old accessible names ("EV02, 60 kilowatt, Available"). Live through `useAvailabilitySocket`. If the selected bay is taken elsewhere, it turns Reserved, the selection clears and a message says so. **Clicked through on the fixture stack**: a competing booking for the selected EV02 produced "EV02 was just taken. Pick another bay." within the 180 ms debounce.
- **Capacity mode** (`CapacityLotMap`): "N of M spaces free" from the same call's `available` and `total`. Large lots draw at scale and say "Each bay shown = N spaces". Never clickable and never a numbered bay; the confirmation reads "Space guaranteed. Bay assigned on arrival". When full, the map says so and booking is disabled.
- **Capacity timeline:** this data didn't exist as one endpoint, so it is **built from real calls**. One existing `getById` per window, for the next 8 whole hours, at the driver's chosen duration. Failed windows show as unknown, never as free. That is 8 requests per vehicle or duration change, worth a single backend endpoint later.
- **Mini maps:** Find Parking popups use the location's real free/total. Tickets show the booked EV bay, or "1 of N spaces" from the location's real capacity for that vehicle type.
- **Operator view:** the same `EvLotMap` in read-only list mode, live for the current hour.
- **Motion:** only `transform` and `opacity`. Arrival and bay flashes are one-shot, with no loops, so there is nothing to pause off-screen. Reduced motion shows the end state, with the text confirmation carrying the meaning.

## Audit findings fixed on these pages

- **#5** Duplicate badges and `window.confirm` on driver and operator pages → kit `StatusBadge` and the confirm dialog (deactivate, cancel booking, remove vehicle).
- **#10 / Q** The driver dashboard CTAs go straight to `/dashboard/nearby`. Stats still come from the legacy `slotsAPI.getAll()` (data sources unchanged as asked), and are now labelled "Tracked bays" so they don't pose as lot capacity.
- **#11** Transactions, Earnings and Settings are designed "not available yet" pages that point to the real data. No sample numbers.
- **E** Every field on these pages has a label tied to its control (`FormField`).
- **J, K** Inline icons sit inline. On phones, Find Parking leads with results and has a list/map toggle.
- **M** The vendor profile approval badge shows the real status.
- **M3** Operator tables become cards below 768 px, actions included.
- **N** Booking default times are computed when the page opens.
- **O** Discovery cache reads can't throw.
- **R** Load failures on the dashboard, My bookings, vehicles, every operator page and the EV bays location list show an error with Retry.
- **U** The location editor no longer geocodes on open. The smoke run's 503 allowance is removed, so a regression fails it.

## Deviations from the brief

- **Extra pages redesigned in this round:** driver profile, vendor business profile, coming-soon pages, vendor application and status. Each already sat in the shell, and leaving them legacy inside a redesigned shell looked broken.
- **Capacity bookings confirm inline**, like EV bookings, instead of navigating away. The legacy `/dashboard/book/:slotId` route still navigates as before.
- **The booking page listens to the socket for capacity bookings too**, so the free count and timeline stay live. Previously only EV listened.
- **Operator EV map is read-only.** Maintenance controls live in the table beside it. The map's selection mode is "pick one bay to book" (listbox semantics), which doesn't fit "manage many bays". **Decision for you** if you want controls on the map.
- **The capacity "car arrives" animation stops in the aisle**, not in a bay, so it never implies a fixed bay.
- **Unsaved-changes warning** in the location editor covers closing or reloading the tab only. In-app links can't be blocked with `BrowserRouter` (it needs a data router).
- **Copy uses sentence case**, not the Title Case that the web-interface guidelines suggest. This follows the design direction chosen in Phase 1.
- **Dates** use fixed `date-fns` English patterns (`EEE d MMM, HH:mm`), not `Intl` locale formats. The app is English-only today.
- **Pulled forward from Phase 7:** `index.css` and Leaflet's CSS now load only with the screens that use them (see Performance).

## Performance

Landing page, Lighthouse 13.5.0 mobile, both builds served by `vite preview` on the same machine, runs interleaved:

| Build | Simulated throttling (default) | DevTools throttling |
|---|---|---|
| Phase 3 (`4aeb897`) | 86 · FCP 2.6 s · LCP 3.7 s | 87 · FCP 3.1 s · LCP 3.1 s |
| Now | 82–83 · FCP 2.7–2.9 s · LCP 3.9–4.0 s | 87–88 · FCP 3.1 s · LCP 3.1 s |

Accessibility 100, best practices 96, SEO 100, CLS 0 in both. The landing code and its imports are unchanged since Phase 3.

- Bisecting showed the simulated score slipping a point or so per commit. The cause is Lantern's dependency graph, which counts whichever lazy chunks happen to start before the local first paint (~100 ms). More shared chunks across more lazy pages means more of them land in it.
- Cutting bytes didn't move the simulated number much: the CSS split took 17 KB gzip off the first-paint stylesheet (40.6 → 23.7 KB).
- Under real throttling the current build is equal or slightly better.
- **Decision for you:** accept this for now and tackle the simulated score in Phase 7 (lucide chunk split and legacy CSS deletion are already planned there), or prioritise it sooner.

Route-level code splitting is kept; every page is its own chunk.

## Verification at this gate

- Tests: **124 passing** (20 files). New this round: Lot Map (13), bookings helpers, discovery cache, vehicle labels, location payload, address combobox (3).
- Production build passes. The fixture smoke run passes for every role and route.
- Screenshots: every Phase 4–5 page, light and dark, at 1440 / 1024 / 768 / 390 → `screens/phase-4-5/` (152 PNGs, gitignored; `report.json` and `report-dark.json` tracked). 0 px horizontal overflow, 0 console errors, no unexpected redirects. 320 px was checked separately on the editor and bookings pages.
- GIFs: `screens/phase-4-5/flow-ev-booking.gif` and `flow-capacity-booking.gif`, real bookings on the fixture stack. Results: "EV01 reserved" and "Space guaranteed. Bay assigned on arrival".
- Clicked through on the fixture stack:
  - Vehicle add, save, remove (confirm), edit
  - Location editor, all five steps, then save
  - EV bay into maintenance and back
  - Check-in and check-out
  - Status tabs restored from the URL
  - In-app navigation into a legacy screen loads its CSS
  - The taken-bay case
- Legacy admin pages are pixel-identical to Phase 3 where their data didn't change.

## Not verified

- **Legacy `/dashboard/book/:slotId`:** the fixtures seed no legacy slots, so this route was not exercised.
- **Address suggestions from a live provider:** providers are off in the fixture stack. The combobox is covered by unit tests with a mocked lookup; the "not configured" path was checked in the browser.
- **Publishing a location successfully:** the fixture vendor isn't verified. The refusal path and its inline message were checked.
- **Two real browsers on one EV bay:** the competing booking came from the same session through the API. The live socket path, the map update and the message were all real.
- **Moving the entrance pin:** it can only be dragged; there is no keyboard alternative. The address suggestion still sets the position, so dragging is an optional fine-tune. Listed as a follow-up.

## Follow-ups

- Backend port docs: 5000 in the docs vs 5001 in the code.
- Map tiles still come from `tile.openstreetmap.org` (audit S). Pick a provider whose terms fit production (MapTiler, Stadia or Carto). Attribution is now correct, with a licence link.
- A keyboard way to fine-tune the entrance pin (e.g. nudge buttons).
- A single backend endpoint for the capacity timeline (it now makes 8 calls).
- Dead code: `pages/customer/SlotsPage.jsx` (not routed) still uses legacy classes.
- Simulated Lighthouse score (see Performance).
- Vercel preview check (yours).
