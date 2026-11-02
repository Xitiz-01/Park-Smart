# Decisions needed (Phase 0)

Answer inline or in chat. Where the brief already sets a default, it’s marked **(default)**; you only need to reply if you want something different. Items marked **needed by Phase N** block that phase, not the ones before it.

## Fixed by the brief (confirm you’re happy, no action otherwise)

- **Architecture:** modular monolith with enforced module boundaries; no microservices (§2.4).
- **Database:** stay on MongoDB; Atlas in production, a replica set locally and in CI (§2.5).
- **Identity:** Clerk replaces Better Auth; MongoDB is the authority on role and status (§2.1).
- **Money:** integer paise; append-only double-entry ledger; commission and refund policy are settings, not code constants (§2.2).

## 1. Backend hosting and managed services (needed by Phase 14; useful from Phase 3)

| Question | Options | My suggestion |
|---|---|---|
| Backend host | Render · Railway · Fly.io · a VPS · other | **Render** or **Railway**: Docker images from GHCR, managed TLS, simple env and secrets, easy `api` + `worker` services. Fly.io if you want regions close to India (Mumbai). A VPS only if you want to run everything yourself. |
| MongoDB | Atlas (M0 free / M10+) · self-hosted | **Atlas**, already your production DB. Transactions need a replica set, which Atlas always is. Pick an Indian region (Mumbai). |
| Redis | Upstash · Redis Cloud · the host’s managed Redis | **Upstash** (serverless, TLS, free tier) or the host’s own Redis add-on to keep latency low. BullMQ needs a Redis that allows blocking commands, which I’ll verify for whichever you pick. |

## 2. Commission and cancellation policy (needed by Phase 10)

The brief keeps these out of code; they live in a settings document seeded by a script. I need the **starting values**:

- Commission: \_\_\_ % of gross (stored as basis points), with optional per-vendor and per-location overrides.
- Tax on commission: off **(default)** until you confirm tax treatment with an accountant.
- Gateway fees borne by: platform **(default)** · vendor.
- Refund windows, for example "100% if cancelled ≥ 2 h before start · 50% if < 2 h · 0% after start". Your values: \_\_\_
- Hold time for an unpaid booking: \_\_\_ minutes (today’s inline hold is 5 min).
- Settlement delay after completion: \_\_\_ days. Minimum payout: ₹\_\_\_.

## 3. Razorpay (needed by Phases 10–12)

- Are you in **test mode only**, or is your account **activated**?
- Is **Route** activated? Route has eligibility requirements under the RBI Payment Aggregator guidelines (including a minimum financial turnover, evidenced with FY25 or FY26 documents). Linked accounts must be created and activated (`requested → under_review → activated`) before transfers work, and Route supports INR only.
  - If Route **isn’t** activated, Phase 12 ships with the **manual payout provider** only (CSV + you record the bank UTR), and the Route provider stays unbuilt until you have it.
- I’ll need **test-mode** keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, a webhook secret) in your local `.env` only, never in chat or the repo.

## 4. Customer → vendor upgrade policy (needed by Phases 5–6)

**(default)** Role is chosen at sign-up; there is no self-service upgrade, and an admin can change a role.

Today’s app does have a self-service path: "List your parking" → `/vendor/apply` for signed-in customers. Under the default, that entry goes away for signed-in customers in Phase 6, and only signed-out visitors see "List your parking" (as a sign-up path).

- Keep the default? Or keep a hidden `/partners` entry for existing customers?

## 5. Transactional email (needed by Phase 8 if in scope)

- Provider (Resend · Postmark · Amazon SES · SendGrid), or **out of scope** for now.
- If out of scope, the notifications adapter ships with a logging implementation only. Booking confirmations stay in-app.

## 6. Logo.dev (needed by Phase 6B)

- Do you have an account, a **publishable key** (`pk_…`) and a **secret key** (`sk_…`)?
- Free plan: **500K requests/month, hard cap** (requests stop until the monthly reset). **Commercial use requires a visible "Logos provided by Logo.dev" link**; paid plans remove it.
- Without a key, 6B still ships with the generic icon fallbacks, and logos appear once you add the key.

## 7. Parking passes (Phases 13B/13C, optional)

- Do you want passes at all?
- If yes: should v1 include a **daily time window** (e.g. 9:00–19:00 office passes), or all-day passes only?

## 8. Things I need from you along the way (not decisions, just heads-up)

| When | What |
|---|---|
| Phase 1 | Turn on GitHub branch protection using the checklist I hand over. Check CodeQL is allowed on the repo (it’s free for public repos; private repos need GitHub Advanced Security). Tell me whether the repo is public or private. |
| Phase 4 | A Clerk **development** instance: publishable key, secret key, webhook signing secret, in `backend/.env` and `frontend/.env` locally. CI uses the fake provider and needs none. |
| Phase 6 | Approve `USER_FLOWS.md` before I implement. |
| Phase 10 | Approve `PAYMENTS_DESIGN.md` before I implement. |
| Phase 13B | Approve `PASSES_DESIGN.md` (if passes are in). |
| Phase 14 | Push the `v1.0.0` tag yourself. |

## 9. Process questions for this run

- **Pushing.** The brief says I never run `git push`, but you asked me to commit and push for each phase. I’m following your chat instruction: I push at each checkpoint after the hygiene check and show the checkpoint block. Say "don’t push" if you’d rather push yourself.
- **Stacking.** `feature/frontend-redesign` (redesign Phases 4–6) isn’t in `main` yet, so every platform branch stacks on it. Once you merge it, I’ll rebase the next platform branch onto `main` (before pushing it, never after).
- **DigiLocker removal** (the pending 5A correction): do it as a separate small PR now, or fold it into Phase 14’s debt removal?
