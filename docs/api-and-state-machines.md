# RQST API And State Machines

## API Surface

Base path: `/api/v1`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `POST /auth/verify-email`

### Me

- `GET /me`
- `PATCH /me`
- `DELETE /me`
- `GET /me/requests`
- `GET /me/payments`

### Public Discovery

- `GET /djs`
- `GET /djs/{slug}`
- `GET /djs/{slug}/events`
- `GET /venues/search`
- `GET /venues/nearby`
- `GET /sessions/nearby`
- `GET /sessions/{session_id}`
- `GET /sessions/{session_id}/queue`
- `GET /songs/search`
- `GET /songs/{song_id}`

### DJ Operations

- `POST /djs/profile`
- `PATCH /djs/profile`
- `POST /djs/profile/images`
- `POST /djs/events`
- `PATCH /djs/events/{event_id}`
- `DELETE /djs/events/{event_id}`
- `POST /dj/sessions`
- `GET /dj/sessions/current`
- `PATCH /dj/sessions/{session_id}`
- `POST /dj/sessions/{session_id}/start`
- `POST /dj/sessions/{session_id}/pause`
- `POST /dj/sessions/{session_id}/end`
- `POST /dj/requests/{request_id}/confirm`
- `POST /dj/requests/{request_id}/played`
- `POST /dj/requests/{request_id}/reject`
- `POST /dj/requests/{request_id}/lock`
- `GET /dj/payments`
- `GET /dj/earnings`

### Listener Requests And Payments

- `POST /sessions/{session_id}/requests`
- `GET /sessions/{session_id}/requests`
- `GET /requests/{request_id}`
- `POST /requests/{request_id}/contribute`
- `POST /requests/{request_id}/cancel`
- `POST /payments/checkout/request`
- `POST /payments/checkout/contribution`
- `GET /payments/{payment_id}`
- `POST /payments/webhooks/polar`

### Notifications And Admin

- `GET /notifications`
- `POST /notifications/read`
- `POST /device-tokens`
- `GET /admin/users`
- `GET /admin/djs`
- `GET /admin/payments`
- `GET /admin/reports`
- `POST /admin/reports/{id}/resolve`

## Request State Machine

```text
pending_payment
  -> open
  -> cancelled

open
  -> locked
  -> confirmed_by_dj
  -> rejected
  -> cancelled
  -> expired
  -> refunded
  -> disputed

locked
  -> confirmed_by_dj
  -> rejected
  -> cancelled
  -> refunded
  -> disputed

confirmed_by_dj
  -> played
  -> refunded
  -> disputed
```

## Payment State Machine

```text
payment_created
  -> checkout_started
  -> payment_cancelled

checkout_started
  -> payment_pending
  -> payment_cancelled

payment_pending
  -> payment_succeeded
  -> payment_failed
  -> payment_cancelled
  -> payment_authorized

payment_succeeded
  -> payment_refunded
  -> payment_disputed
```

## Ledger Rules

- successful listener payments create ledger rows with `pending_confirmation`
- DJ confirmation flips linked rows to `available`
- rejection or cancellation before confirmation flips linked rows to `reversed`
- dispute events move linked rows to `on_hold`
- payout processing later moves rows to `paid_out`

## Realtime Event Types

- `session.started`
- `session.paused`
- `session.ended`
- `request.created`
- `request.updated`
- `request.cancelled`
- `request.confirmed`
- `request.played`
- `request.rejected`
- `contribution.created`
- `payment.succeeded`
- `payment.failed`
- `queue.reordered`
