# RQST Architecture

## Repository Layout

```text
Backend/
Mobile/
Desktop/
packages/
  contracts/
  shared-config/
docs/
```

## Backend Architecture

- `FastAPI` handles HTTP APIs, OpenAPI generation, auth, and admin/support endpoints.
- `SQLAlchemy 2.0` models map cleanly to SQLite now and Postgres later.
- `Alembic` owns schema migrations.
- `services/` contains business rules for auth, sessions, requests, payments, and ranking.
- `repositories/` centralize DB access patterns and transactional reads/writes.
- `payments/polar.py` wraps provider-specific checkout and webhook helpers.
- `realtime/manager.py` broadcasts queue and private account events over WebSockets.
- background tasks reconcile pending payments, stale requests, and ledger anomalies.

## Mobile Architecture

- `Expo Router` defines the tab structure and detail pages.
- `TanStack Query` handles server state.
- `Zustand` holds auth/session/UI preferences.
- `React Hook Form + Zod` power forms and request modals.
- a feature-first `src/` directory keeps UI logic close to product areas.

## Desktop Architecture

- `Nuxt 3` powers the DJ UI using Vue 3 Composition API.
- `Pinia` stores auth, session, and UI state.
- `Vue Query` is optional for async server state and can be layered in as pages mature.
- `Tauri` wraps the Nuxt build for desktop packaging and secure local capabilities.

## Shared Contracts

- OpenAPI from FastAPI is the contract source of truth.
- `packages/contracts` holds generated client code and shared API types.
- `packages/shared-config` holds money formatting rules, status maps, design tokens, and route constants.

## Data And Event Model

- the queue is canonical per `session + song`
- all money movement is additive through `contributions`
- all provider callbacks are logged in `payment_events`
- DJ earnings are derived through an append-only `dj_earnings_ledger`
- queue and request views update via WebSockets, with polling fallback for resilience
