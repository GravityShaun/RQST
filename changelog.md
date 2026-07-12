# RQST — changelog.md

## Version history
- v1.0 (2026-07-12) — Context kit committed (was: two untracked local
  files). Decisions: git-tracked kit over Claude Code auto-memory
  (shared, reviewable, deliberate); CI path fixed (`Backend` →
  `backend`) so backend pytest actually executes; pnpm-only, bun.lock
  deleted; code-beats-docs made the single truth hierarchy (README
  source-of-truth section to be amended); PO lens demoted from
  always-on context to `po-context.md`, read on feature evaluation;
  roadmap snapshot cut from context — direction derives from `git log`.

## Observation log
- 2026-07-12 — Symptom: every CI run in repo history fails in ~15s;
  locally `pnpm lint`/`pnpm test` fail with `eslint: command not
  found`. Root causes: (1) CI pinned Node 20 while pnpm 11.7.0
  requires Node >= 22.13, so runs died at pnpm cache resolution
  (`ERR_UNKNOWN_BUILTIN_MODULE node:sqlite`) before any declared step —
  fixed, Node 22; (2) `cd Backend` vs `backend/` meant pytest could
  never have run even past that — fixed; (3) deeper than the handoff's
  diagnosis: every app declares `eslint`/`jest`/`vitest` scripts but no
  workspace installs those tools and no eslint config exists, so
  `pnpm lint` and `pnpm test` have never passed on any machine. Those
  CI steps are commented out until the toolchains land; backend pytest
  is the only real cross-machine check today.
- 2026-07-12 — Symptom: on `main`, backend pytest can't even collect
  (`NameError: RequestCreate` — a bare forward reference in
  `app/schemas/requests.py` makes the app unimportable on Python
  3.12/3.13), and after patching that, 31 of 74 tests fail against
  main's own code (tests expect `environment-refactor`-era behavior,
  e.g. registration auto-creating DJ profiles). Root cause: CI never
  ran, so main's suite was never executed on main; test files and app
  code drifted apart across merges. `environment-refactor` already
  rewrites the affected backend code and its suite passes 57/57 —
  which is why this kit lands on top of `environment-refactor` rather
  than `main`.

- 2026-07-12 — Second-perspective critique (fresh-context Claude Code
  instance, pre-merge, required by the kit's verification plan)
  reviewed CLAUDE.md and po-context.md against the repo. Findings,
  all corrected in this PR: (1) fee incidence was framed as fully
  unknown, but code answers current behavior — the DJ bears all fees
  (`net = gross - platform_fee - processing_fee`, DJ ledger credited
  with net); TODO reframed as "is this intended?"; (2) a second,
  hardcoded 2.9% + 30¢ processing fee existed undocumented in
  `backend/app/services/payments.py`; (3) auto-completion of payments
  was misattributed to `polar.py` — it lives in the payments service,
  gated on `environment == "local"`; (4) earnings unlock at
  `mark_played` and settle at session end, not at DJ confirm as the
  vision paragraph claimed; (5) "import state names, never restate"
  stated as fact when no app imports them yet and the backend has its
  own `enums.py` mirror — reworded as aspiration; (6) the documented
  pytest command needed the venv's python (bare `python3` lacks
  pytest). Symptom behind most of these: context written from docs
  and intent, not verified against code — the exact failure mode the
  kit exists to prevent.

- 2026-07-12 — Symptom: the lint/test half of the first 2026-07-12 CI
  observation — scripts declared everywhere, toolchains nowhere.
  Resolved (PR #9): eslint-config-expo + jest-expo for mobile,
  @nuxt/eslint-config standalone flat config + vitest for the Nuxt
  apps (standalone because the @nuxt/eslint module needs `nuxt
  prepare` codegen before `eslint .` can run — hostile to a bare
  `pnpm install && pnpm lint` CI job); root lint/test now include
  admin_dashboard, which the old scripts silently skipped; `vitest
  run` (not bare `vitest`) so local `pnpm test` doesn't hang in watch
  mode. First real lint run caught a genuine bug: rules-of-hooks
  violation in `mobile/app/(tabs)/find.tsx` (hooks after a conditional
  early return). CI lint/test steps re-enabled on top of the kit's
  Node 22 and `Backend`→`backend` fixes. Residue: ~70 eslint warnings
  across the apps (exhaustive-deps, html-self-closing) — non-blocking,
  but the count shouldn't grow.

## Research cache
(empty — first expected entry: payment-provider comparison, when that
open question is taken up)
