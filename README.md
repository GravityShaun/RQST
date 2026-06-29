# RQST

RQST is a DJ song request platform with three applications:

- `Backend`: FastAPI backend for auth, sessions, queueing, payments, and realtime.
- `Mobile`: Expo / React Native listener app.
- `Desktop`: Nuxt 3 + Tauri DJ desktop app.
- `packages/contracts`: shared API contracts and generated-client entrypoints.
- `packages/shared-config`: shared design tokens and product constants.

## Monorepo Commands

```bash
pnpm install
pnpm dev
pnpm dev:mobile
pnpm lint
pnpm test
```

Mobile app development:

```bash
cd Mobile
npm start
```

The Expo dev server is pinned to port `8083` so the iOS dev client and Metro stay aligned.

Backend setup:

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -e .[dev]
pytest
```

## Source Of Truth Docs

- [Product Requirements](./docs/prd.md)
- [User Flows](./docs/user-flows.md)
- [Architecture](./docs/architecture.md)
- [API And State Machines](./docs/api-and-state-machines.md)

## Current Status

This repo now includes the implementation scaffold for the MVP blueprint:

- documented product and system design
- FastAPI foundation with domain models, services, routes, and tests
- Expo app shell with tabbed navigation and feature-oriented screens
- Nuxt 3 + Tauri desktop shell for DJ workflows
- shared contracts/config packages for cross-app consistency
# RQST
