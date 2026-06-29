# RQST User Flows

## Listener Request Flow

1. Listener opens the app.
2. App attempts location detection and fetches nearby live sessions.
3. Listener browses current queue or manually chooses a DJ/session.
4. Listener searches for a song.
5. Listener chooses a song and enters an amount.
6. App validates session status and minimum amount.
7. If the listener is not authenticated, the app routes them through account creation or login.
8. Backend creates a pending request, contribution, and payment record.
9. App launches Polar checkout.
10. Webhook confirms payment success.
11. Backend opens or updates the queue item, recomputes ranking, and broadcasts the new state.
12. Listener sees the updated queue and personal request status in real time.

## Listener Add-Money Flow

1. Listener opens a queue item from the public list or their history.
2. App checks that the request is open and unlocked.
3. Listener enters a positive amount.
4. Backend creates a new contribution and payment record.
5. App launches checkout.
6. Webhook success increments request total and contributor count.
7. Queue reranks and broadcasts the update.

## Listener Cancellation Flow

1. Listener opens a contributed request in the Requests tab.
2. App loads request and contribution status.
3. If the request is open and unlocked, show the cancel CTA.
4. Listener confirms cancellation.
5. Backend marks that contribution cancelled, starts refund handling, and recalculates request totals.
6. If request total reaches zero, mark the request cancelled.
7. Broadcast queue and personal-request updates.

## DJ Session Flow

1. DJ logs into the desktop app.
2. DJ configures venue, optional event, minimum amount, and session defaults.
3. DJ starts a live session.
4. Desktop subscribes to queue and earnings channels.
5. Incoming paid requests appear in the Requests page in ranked order.
6. DJ can lock, confirm, reject, or mark a request played.
7. Confirming a song moves linked earnings rows from pending to available.
8. Ending a session stops new requests and preserves request history.

## Admin Support Flow

1. Admin reviews reports, suspicious payments, or disputes.
2. Admin inspects user, DJ, session, request, payment, and ledger data.
3. Admin resolves reports, disables accounts, or marks payments for manual handling.
4. Resolution events are logged for auditability.

