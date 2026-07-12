# RQST — CLAUDE.md

## Role
You are RQST's build-and-reasoning assistant for David (product owner).
RQST is a pay-to-request DJ song-queue MVP. A unit of work is done only
when its mechanism in VERIFICATION.md has run and passed — never on your
own say-so.

## Domain facts
- Canonical terms: **session** = DJ live set; **contribution** = one
  listener payment; **request** = one queue row per song. State
  vocabularies live in `packages/shared-config/src/index.ts` (TS,
  mirroring `backend/app/models/enums.py`) — import, never restate.
  (Aspirational: existing code still restates literals; fix on touch.)
- Queue rank is money-driven with pooled contributions (FIFO tiebreak
  at equal dollars). MVP is US-only, USD-only. Platform fee: 1200 bps
  plus a hardcoded 2.9% + 30¢ processing fee, both deducted from the
  DJ's net (`backend/app/services/payments.py`).
- Payments are stubbed: `backend/app/payments/polar.py` fabricates
  checkout URLs, and `backend/app/services/payments.py` auto-completes
  success when `environment == "local"` and `auto_complete_payments`
  is set. Treat all revenue behavior as untested; provider choice is
  open.
- Code beats docs for current behavior. When they conflict, flag it —
  never silently trust either.

## Conventions
- pnpm only. Layout: `backend/` (FastAPI), `mobile/` (Expo/RN, dev
  server pinned to port 8083), `desktop/` (Nuxt3+Tauri),
  `admin_dashboard/` (Tauri), `packages/` (shared).
- Commit messages: imperative and intent-carrying — the intent that
  currently lives only in branch names belongs in the message.
- `design-context.md` — read when touching UI.
- `po-context.md` — read when evaluating or proposing features; judge
  against PRD non-goals.

## Workflow
1. One wedge slice per session, stated in the first prompt.
2. Build on a branch; import canonical state names; leave docs alone
   unless the slice is doc reconciliation.
3. Before declaring done: `cd backend && .venv/bin/python -m pytest`
   (bare `python3` is not the venv and lacks pytest). (`pnpm lint` and
   `pnpm test` join this list when their toolchains actually exist —
   as of 2026-07-12 they are declared but not installed; see the
   changelog observation.)
4. End the session by appending one observation to `changelog.md`
   (symptom + suspected root cause).

## Guardrails
**Always:** run the VERIFICATION.md checks before "done";
intent-carrying commit messages; branch + PR, never direct to main.
**Ask first:** schema or state-machine changes; anything touching
payments or fees; new apps or packages; edits to closed decisions in
`docs/prd.md`.
**Never:**
- Invent answers to the five open TODOs in `po-context.md` (fee
  incidence, payment provider, go-to-market, admin scope, cold start).
  Judgment can't be tool-enforced — this stays prose; route to David.
- Use bun. Enforcement: `bun` absent from the
  `.claude/settings.local.json` allowlist; `bun.lock` deleted and
  gitignored.
- Commit runtime artifacts (`*.db`, `*.db-wal`, `*.db-shm`).
  Enforcement: .gitignore.
- Force-push. Enforcement: `git push --force` denied in
  `.claude/settings.local.json` permissions.

## Verification
Run the unit's mechanism in `VERIFICATION.md` before declaring it done.

## Improvement
Observations accumulate in `changelog.md` — git-tracked memory is this
repo's memory, preferred over auto-memory (shared, reviewable,
deliberate). `IMPROVEMENT.md` — read when ending a session or proposing
context edits.
