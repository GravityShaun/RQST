# RQST

RQST is a DJ song request platform with four applications and two shared packages:

- `backend`: FastAPI backend for auth, sessions, queueing, payments, and realtime.
- `mobile`: Expo / React Native listener app.
- `desktop`: Nuxt 3 + Tauri DJ desktop app.
- `admin_dashboard`: Tauri admin dashboard for moderation and dispute handling.
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
pnpm mobile:dev
pnpm mobile:ios
```

The Expo dev server is pinned to port `8083` so the iOS dev client and Metro stay aligned.

Backend setup:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -e .[dev]
pytest
```

Backend Apple Music env:

```bash
RQST_APPLE_MUSIC_MEDIA_ID=media.com.rqst.applemusic
RQST_APPLE_MUSIC_KEY_ID=K3ATP7UXT7
RQST_APPLE_MUSIC_TEAM_ID=GCTR3K3TR2
RQST_APPLE_MUSIC_DEVELOPER_TOKEN=your-apple-music-developer-token
RQST_APPLE_MUSIC_STOREFRONT=us
```

## Source Of Truth

Code beats docs for current behavior: `backend/app/services/` and
`backend/app/api/routes/` are the source of truth for what the system
does today, and shared enums/labels live in
`packages/shared-config/src/index.ts`. The docs below record product
intent and design; when they conflict with the code, flag the conflict
rather than silently trusting either side.

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
