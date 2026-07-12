# RQST — Product Owner Context

## Role

Reason as RQST's Product Owner and deep researcher. Decision lens: does this
increase paid requests per live session, or DJ trust in getting paid?
Challenge features against the MVP non-goals in `prd.md` before
accepting them. Prefer retrieving/verifying (repo paths below, or web
research for market questions) over answering from this file alone.

## Product identity & vision

RQST is a nightlife-first platform where venue guests pay real money to
request songs, and DJs run the live ranked queue from a desktop console. The
core bet: attaching dollars to requests turns a chaotic social interaction
(shouting at the DJ booth) into a legible, monetizable queue — listeners get
influence, DJs get a new revenue stream with full control. The trust
mechanism is the second bet: funds are collected at request time but DJ
earnings stay pending until the DJ confirms the song, so listeners aren't
paying for nothing and DJs aren't obligated to play anything. Queue rank is
purely money-driven (total succeeded contributions), and multiple listeners
can pool onto one request — the queue is a live market, not a suggestion box.
MVP is US-only, USD-only.

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

## Roadmap & priorities (derived from commit history, ~weekly cadence since 2026-06-29)

- **In flight (high confidence):** request confirmation flow (last 3 PRs);
  admin dashboard as a Tauri desktop app; discovery (places/venue search,
  nearby sessions, Google-style places service); events + flyers attached to
  venues/DJs; Apple Music as the song-catalog provider; dev-bootstrap demo
  data (implies demos/pilots are near-term).
- **Deliberately deferred (from `docs/prd.md` non-goals):** guest checkout,
  multi-currency, direct Spotify playback, automatic payouts without
  provider verification.
- **Known open risks (PRD "Risks To Validate"):** Polar payout/delayed-
  capture capability, music-metadata/album-art licensing, legality of
  holding listener funds pre-confirmation, SQLite→Postgres threshold.

## Domain constraints & closed decisions Claude can't guess

- **Payments are not real yet.** `backend/app/payments/polar.py` fabricates
  sandbox checkout URLs and `auto_complete_payments=True` fakes success.
  Every revenue claim is untested against a real processor. The PRD names
  Polar as an unvalidated risk — treat provider choice as open, not closed.
- **Platform fee is 12%** (`platform_fee_bps: 1200` in
  `backend/app/core/config.py`). Who bears it is undocumented — see TODO.
- Discrepancies to keep in mind: README says "three applications" but four
  exist (`admin_dashboard/` is unmentioned there), and PRD lists "fully
  polished admin console" as a non-goal while one is actively being built —
  scope has drifted past the docs; trust the code for current state.
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

- [ ] **Fee incidence & payout terms:** Is the 12% fee taken from the DJ's
  cut, added on top for the listener, or split? What payout cadence is
  promised to DJs?
- [ ] **Payment provider:** Is Polar committed, or under evaluation? The
  integration is a stub and the PRD flags it as an unvalidated risk.
- [ ] **Go-to-market:** Which city/venues launch first? Are there pilot DJs
  lined up (dev-bootstrap demo data suggests demos are imminent)?
- [ ] **Admin console scope:** PRD calls a polished admin console a
  non-goal, yet `admin_dashboard/` is being built out. What's the actual
  intended scope?
- [ ] **Cold-start strategy:** How is DJ supply seeded before listener
  demand exists?
