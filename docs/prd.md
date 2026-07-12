# RQST Product Requirements Document

## Product Summary

RQST is a nightlife-first song request platform that lets venue guests pay to request songs while DJs manage a live ranked queue from a desktop console. The MVP serves US venues and USD payments only.

## Users

- `listener`: browse DJs, venues, and live queues; create paid requests; contribute to existing requests; manage personal request history.
- `dj`: run live sessions, configure request rules, manage the queue, confirm songs, and track earnings.
- `admin`: moderate users and DJs, resolve payment issues, and manage abuse and disputes.

## Core Product Rules

1. A DJ must have an active session for a listener to request songs.
2. Initial requests must meet the DJ session minimum amount.
3. Contributions to an existing request may be any positive amount.
4. One active queue row exists per canonical song per session.
5. User funds are collected at request time, but DJ earnings remain pending until the DJ confirms the song.
6. Listeners may cancel only their own eligible contributions before the request is locked or confirmed.
7. Queue ranking is determined by total succeeded contributions.

## MVP Scope

### Listener Mobile App

- Home tab with detected session, nearby activity, and personal request summary
- Find tab with map/list discovery and manual search fallback
- List tab with live ranked queue and add-money flow
- Requests tab with song search, request creation, and request management
- Settings tab with account, payment history, notifications, privacy, and support
- DJ public profile page

### DJ Desktop App

- Home dashboard for session lifecycle, venue/event, QR code, and nightly metrics
- Requests page for live queue management and confirm / reject / play controls
- Payments page for ledger and payout visibility
- Profile page for public DJ profile editing
- Settings page for account, payments, defaults, notifications, and visibility

### Backend

- JWT auth with refresh rotation and role-based authorization
- venue, event, DJ profile, session, song, queue, contribution, payment, notification, and report APIs
- Polar checkout + webhook ingestion
- internal ledger and reconciliation support
- WebSocket updates for public queues and authenticated private events

## Non-Goals For MVP

- guest checkout
- multi-currency pricing
- direct Spotify playback
- fully polished admin console (note 2026-07-12: a basic `admin_dashboard/`
  app is being built; the intended admin scope is an open product question —
  see the TODO in `po-context.md` — this non-goal has not been re-decided)
- automatic marketplace payouts without provider verification

## UX Principles

- request a song in under 30 seconds
- always show which DJ/session the user is targeting
- make money, queue rank, and request state obvious
- keep desktop queue controls keyboard-friendly and readable during live sets
- use high-contrast nightlife visuals without sacrificing trust

## Risks To Validate

- Polar payout and delayed-capture capabilities
- music metadata licensing and album-art usage rights
- legal/compliance requirements for holding listener funds prior to DJ confirmation
- operational thresholds for SQLite before moving to Postgres

