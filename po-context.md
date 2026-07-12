# RQST — Product Owner Context

## Role

Reason as RQST's Product Owner and deep researcher. Decision lens: does this
increase paid requests per live session, or DJ trust in getting paid?
Challenge features against the MVP non-goals in `docs/prd.md` before
accepting them. Prefer retrieving/verifying (repo paths below, or web
research for market questions) over answering from this file alone.

## Product identity & vision

RQST is a nightlife-first platform where venue guests pay real money to
request songs, and DJs run the live ranked queue from a desktop console. The
core bet: attaching dollars to requests turns a chaotic social interaction
(shouting at the DJ booth) into a legible, monetizable queue — listeners get
influence, DJs get a new revenue stream with full control. The trust
mechanism is the second bet: funds are collected at request time but DJ
earnings stay pending until the song is actually marked played (confirming
alone credits nothing — `credit_ledger_for_played_request` runs in
`mark_played`, and funds settle to withdrawable at session end), so listeners
aren't paying for nothing and DJs aren't obligated to play anything. Queue
rank is money-driven (total succeeded contributions, FIFO tiebreak at equal
dollars), and multiple listeners can pool onto one request — the queue is a
live market, not a suggestion box. MVP is US-only, USD-only.

## Users

Three roles (evidenced throughout backend auth and PRD): **listener**
(mobile, Expo), **dj** (desktop, Tauri), **admin** (separate Tauri dashboard).

- Listener JTBD: get my song played tonight, at this venue, in under 30
  seconds of app time. Churn risk: paying and the song never playing, or
  unclear refund state. (Inference: the elaborate request/refund state
  machine exists precisely because this is the trust-killer.)
- DJ JTBD: extra revenue per set without losing creative control or
  attention during a live set (hence keyboard-friendly desktop UI, confirm/
  reject/lock controls). Churn risk: payout friction or requests they feel
  forced to honor. (Inference from PRD UX principles + earnings design.)
- Two-sided cold start is the existential product problem; nothing in the
  repo says how supply (DJs) gets seeded. See TODO below.

## Domain constraints & closed decisions Claude can't guess

- **Payments are not real yet.** `backend/app/payments/polar.py` fabricates
  sandbox checkout URLs, and `backend/app/services/payments.py` fakes
  success when `environment == "local"` with `auto_complete_payments=True`.
  Every revenue claim is untested against a real processor. The PRD lists
  Polar checkout as committed scope but flags its payout/delayed-capture
  capabilities as unvalidated risks — treat provider choice as open, not
  closed.
- **Fees, as implemented:** platform fee 12% (`platform_fee_bps: 1200` in
  `backend/app/core/config.py`) plus a hardcoded 2.9% + 30¢ processing fee
  (`backend/app/services/payments.py`), both deducted from the listener's
  gross before crediting the DJ — today the DJ bears all fees. Whether that
  is the intended product decision is undocumented — see TODO.
- Canonical terminology: "session" = a DJ's live set accepting requests;
  "contribution" = one listener's payment toward a request; "request" = one
  queue row per canonical song per session. Full state vocabularies live in
  `packages/shared-config/src/index.ts`.

## Retrieval paths

- Product rules, scope, non-goals, UX principles → `docs/prd.md`
- End-to-end user journeys → `docs/user-flows.md`
- API surface + request/payment state machines → `docs/api-and-state-machines.md`
- Current behavior (source of truth over all docs) → `backend/app/services/`
  and `backend/app/api/routes/`; shared enums/labels/theme →
  `packages/shared-config/src/index.ts`
- Listener UX as built → `mobile/src/features/`; DJ console → `desktop/`;
  admin → `admin_dashboard/`
- Recent product direction → `git log` PR merges (branch names are theme
  labels, e.g. `request_confirmation_flow`)
- Competitive/market/licensing questions (song-request apps, DJ tipping,
  music-metadata licensing, fund-holding regulations) → research the web;
  the repo contains nothing on these.

## TODO — needs product-owner input (do not invent answers)

- [ ] **Fee incidence & payout terms:** Code currently takes the 12%
  platform fee and a 2.9% + 30¢ processing fee out of the DJ's cut — is
  that the intended decision, or should some land on the listener? What
  payout cadence is promised to DJs?
- [ ] **Payment provider:** Is Polar committed, or under evaluation? The
  integration is a stub and the PRD flags it as an unvalidated risk.
- [ ] **Go-to-market:** Which city/venues launch first? Are there pilot DJs
  lined up (dev-bootstrap demo data suggests demos are imminent)?
- [ ] **Admin console scope:** PRD calls a polished admin console a
  non-goal, yet `admin_dashboard/` is being built out. What's the actual
  intended scope?
- [ ] **Cold-start strategy:** How is DJ supply seeded before listener
  demand exists?
