# RQST — VERIFICATION.md

A unit of work is done only when its mechanism below has run and
passed. Ground truth is exit codes and CI logs — never the assistant's
own say-so.

## Code changes (recurring)
Run locally before any "done" declaration:
1. `pnpm lint` (repo root — covers mobile, desktop, admin_dashboard)
2. `pnpm test` (repo root — jest for mobile, vitest for the Nuxt apps)
3. `cd backend && .venv/bin/python -m pytest` (the venv's python — bare
   `python3` is the system interpreter and lacks pytest; CI instead
   installs fresh via `python -m pip install -e .[dev]`)

Each must exit 0, and the pushed branch's GitHub Actions run must show
the same steps executing and exiting 0. (Lint/test toolchains landed
2026-07-12, PR #9. eslint errors fail the build, warnings don't — do
not let the warning count grow.)

Review check (until a lint rule exists): state names are imported from
`packages/shared-config/src/index.ts`, never restated as string
literals.

## CI / workflow changes
The pushed branch's GitHub Actions run shows every declared step
actually executing. A step that never runs is a failure even when the
overall run is green — this repo's CI claimed a pytest step for months
without ever executing it.

## Doc reconciliation
Produce the diff plus a one-paragraph rationale; David approves against
the code-beats-docs rule. Ground truth is the current repo tree, not
the docs being edited.

## Feature accept/reject and the five open product TODOs
(fee incidence, payment provider, go-to-market, admin scope, cold
start — listed in `po-context.md`.)
Argue a position against the PRD non-goals, then route to David.
Never self-certify these.

## No-loop exception: payment flows
`backend/app/payments/polar.py` fabricates checkout URLs, and
`backend/app/services/payments.py` fakes success when
`environment == "local"` and `auto_complete_payments` is set, so
revenue behavior is untestable until a payment provider is chosen.
Payment-related tests are stub-scoped and must say so.
