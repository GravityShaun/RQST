from __future__ import annotations

from datetime import UTC, datetime
from threading import Lock

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RequestStatus, SongRequest
from app.realtime.queue import schedule_session_queue_broadcast
from app.services.queue import mark_request_expired

PLAY_DEADLINE_OPTIONS: dict[int, int] = {
    60: 500,
    30: 1000,
    15: 2000,
    5: 5000,
}

ACTIVE_DEADLINE_STATUSES = {
    RequestStatus.OPEN,
    RequestStatus.LOCKED,
    RequestStatus.CONFIRMED_BY_DJ,
}

# Avoid hammering the DB when many clients poll queue endpoints at once.
_EXPIRE_MIN_INTERVAL_SECONDS = 2.0
_last_expire_at: float | None = None
_expire_lock = Lock()


def validate_play_deadline(minutes: int | None, amount_cents: int) -> None:
    if minutes is None:
        if amount_cents != 0:
            raise ValueError("Play deadline amount requires a deadline duration")
        return

    expected_amount = PLAY_DEADLINE_OPTIONS.get(minutes)
    if expected_amount is None:
        raise ValueError("Unsupported play deadline duration")
    if amount_cents != expected_amount:
        raise ValueError("Play deadline amount does not match selected duration")


def resolve_play_deadline_amount(minutes: int | None) -> int:
    if minutes is None:
        return 0
    return PLAY_DEADLINE_OPTIONS.get(minutes, 0)


def expire_overdue_requests(db: Session, *, force: bool = False) -> list[int]:
    from app.services.earnings import reverse_ledger_for_request

    global _last_expire_at

    now = datetime.now(UTC)
    now_ts = now.timestamp()

    with _expire_lock:
        if (
            not force
            and _last_expire_at is not None
            and now_ts - _last_expire_at < _EXPIRE_MIN_INTERVAL_SECONDS
        ):
            return []
        _last_expire_at = now_ts

    stmt = select(SongRequest).where(
        SongRequest.play_deadline_expires_at.isnot(None),
        SongRequest.play_deadline_expires_at <= now,
        SongRequest.status.in_(ACTIVE_DEADLINE_STATUSES),
    )

    expired_session_ids: list[int] = []
    for request in db.scalars(stmt):
        mark_request_expired(request)
        reverse_ledger_for_request(db, request.id)
        expired_session_ids.append(request.session_id)

    if expired_session_ids:
        db.commit()
        for session_id in set(expired_session_ids):
            schedule_session_queue_broadcast(session_id)

    return expired_session_ids
