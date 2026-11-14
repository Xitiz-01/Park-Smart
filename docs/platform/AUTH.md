# Authentication

Clerk is replacing Better Auth as ParkSmart's identity provider, in three steps:

| Step | Backend | Frontend | Production sign-in |
|---|---|---|---|
| Phase 4 (now) | accepts Clerk session tokens **and** Better Auth cookies | Better Auth | Better Auth, unchanged |
| Phase 5 | both | Clerk | Clerk |
| End of Phase 5 | Better Auth removed | Clerk | Clerk |

Better Auth must be gone before **2026-12-31**, when its audit and Trivy allow-list entries expire (tracked in issue #24).

MongoDB stays the authority on **role** and **status**. Clerk supplies identity: who someone is, their email and its verification, their name and phone. Clerk's `publicMetadata` mirrors role and onboarding state for UI routing. The backend never reads it back for authorisation.

## How a request is authenticated

`protect` (`middleware/authMiddleware.js`) checks requests in this order:

1. When Clerk is switched on and there is an `Authorization: Bearer <token>` header, **only Clerk** decides. A valid session token is resolved to the ParkSmart user. Any other token is a 401, and there's no fallback to a cookie. Sessions that are still `pending` (sign-up tasks open) count as signed out.
2. Otherwise Better Auth's session cookie decides, exactly as before Phase 4.

With `CLERK_ENABLED=false` (production today), Bearer headers are ignored, and nothing about sign-in changes.

Tokens are checked with `verifyToken` from `@clerk/express`, with `authorizedParties` set to the frontend origins. If `CLERK_JWT_KEY` is set, no network call is needed; otherwise Clerk's JWKS is fetched and cached. The API doesn't mount `clerkMiddleware()`. The frontend is on a different origin and sends a Bearer token, so there's no `__session` cookie to handshake. One `verifySessionToken` call then serves HTTP and the Socket.IO handshake (4B) alike. `requireAuth()` isn't used: it redirects, and Clerk now marks it deprecated.

## Provisioning

`src/platform/auth/provisioning.js` finds or creates the ParkSmart user for a Clerk user:

- **Already linked** (`users.clerkId`): one indexed MongoDB read per request. Clerk's API is not called.
- **First request**: the user is fetched from Clerk.
  - If an account with the same email exists (from Better Auth), it is **linked**, but only when Clerk has verified the email, and only if that account isn't linked to another Clerk user. The account keeps its role.
  - Otherwise a new user is created.
- **Races**: simultaneous first requests create one user. The unique `clerkId` and `email` indexes decide, and the losers read the winner's row.
- **Sign-up intent**: the frontend passes `unsafeMetadata.intendedRole`. It's written by the browser, so only `customer` and `vendor` are honoured; anything else, admin roles included, becomes `customer`.
- **Vendor sign-ups**: someone who picks "I operate parking" starts as `role: customer` with `onboarding: { intendedRole: 'vendor', state: 'vendor_applicant' }`. That keeps today's rule: only an admin's approval makes a `vendor`, and vendor tools need an approved, active vendor profile.
- **Admin roles** are granted only by `npm run admin:grant` (Phase 4B) or by a super-admin.
- **After a user is created or linked**, `{ role, onboardingState, intendedRole }` is written to Clerk's `publicMetadata`. If that write fails it's logged, not retried inline: MongoDB already holds the truth.
- **Status**: `user.status` is `active` or `suspended`, derived from `isActive`. A suspended account gets 403.

Clerk sign-ups may have no phone number, so `phone` is required only for accounts without a `clerkId`.

## Webhook: `POST /api/v1/webhooks/clerk`

Subscribe it to `user.created`, `user.updated` and `user.deleted`.

- **Signature**: Clerk's `verifyWebhook` (Svix / Standard Webhooks) checks the **raw body**. The route is mounted with `express.raw()` before the JSON parser.
  - A wrong or missing signature is a 400.
  - So is a timestamp more than five minutes off, which blocks replays.
  - Without `CLERK_WEBHOOK_SIGNING_SECRET`, or with Clerk off, the route answers 503.
- **At least once**: each `svix-id` is stored in `clerkwebhookevents` before the event is applied. A repeated delivery is acknowledged with `duplicate: true` and skipped. If applying fails, the row is removed and the 5xx makes Svix retry. Rows expire after 30 days.
- **Out of order**: updates carry Clerk's `updated_at`, and data older than what's stored is ignored. Updates never change role, onboarding or status.
- **Deletes**: `user.deleted` deactivates the account (`isActive: false`, `clerkDeletedAt`) and keeps the row, because bookings and the ledger reference it. A late update never reactivates it.
- **Identity conflicts** (an unverified email matching an existing account) are acknowledged with `skipped: true` and logged, because retrying can't fix them.
- Other event types are acknowledged with `ignored`.

## Testing without Clerk

`AUTH_PROVIDER=fake` swaps Clerk for an in-memory provider (`createFakeAuthProvider`). It issues random tokens for users a test adds, and records `publicMetadata` writes. Webhooks still go through Clerk's real verifier, with a test signing secret, so the signature tests are real. The fake provider throws if `NODE_ENV=production`, and the config refuses `AUTH_PROVIDER=fake` in production. CI never needs Clerk keys.

## Setting up Clerk

None of this is needed until Phase 5. Phase 4 merges with Clerk switched off.

**Local development (optional).**
1. Create a Clerk application. It starts as a development instance.
2. From **API keys**, put `CLERK_SECRET_KEY` (`sk_test_…`) and `CLERK_PUBLISHABLE_KEY` (`pk_test_…`) in `backend/.env`, and set `CLERK_ENABLED=true`.
3. To try the webhook locally, expose the API with a tunnel and add it as an endpoint (see below).

**Production (before Phase 5 ships).**
1. **Production instance.** Clerk's production instances need a domain you own: the frontend moves from `*.vercel.app` to `parksmart.live` or `app.parksmart.live`. Add the DNS records Clerk's **Domains** page lists in Cloudflare, set to "DNS only". Subdomains of one root share sessions, so `api.parksmart.live` works with either.
2. **Webhook.** Under **Webhooks → Add endpoint**, use `https://api.parksmart.live/api/v1/webhooks/clerk`, subscribed to `user.created`, `user.updated` and `user.deleted`. Copy its signing secret (`whsec_…`).
3. **Render.** Set these variables:
   - `CLERK_ENABLED=true`
   - `CLERK_SECRET_KEY` (`sk_live_…`)
   - `CLERK_PUBLISHABLE_KEY` (`pk_live_…`)
   - `CLERK_WEBHOOK_SIGNING_SECRET`
   - `CLERK_AUTHORIZED_PARTIES` = the frontend origin
   - optionally `CLERK_JWT_KEY`
4. **Vercel.** Set `VITE_CLERK_PUBLISHABLE_KEY`.
5. **Existing users.** `npm run auth:migrate-better-auth` (Phase 4B) imports them, dry run first.
