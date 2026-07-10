from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import logging

from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.models import (
    Contribution,
    ContributionStatus,
    DJEarningsLedger,
    DJSession,
    Payment,
    RequestStatus,
    SongRequest,
)

logger = logging.getLogger(__name__)

INACTIVE_QUEUE_STATUSES = {
    RequestStatus.CANCELLED,
    RequestStatus.REJECTED,
    RequestStatus.REFUNDED,
    RequestStatus.EXPIRED,
}

QUEUE_INACTIVE_STATUSES = INACTIVE_QUEUE_STATUSES | {RequestStatus.PLAYED}

UNDO_WINDOW_SECONDS = 30


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def assert_request_undo_allowed(request: SongRequest) -> None:
    elapsed = (datetime.now(UTC) - _as_utc(request.created_at)).total_seconds()
    if elapsed > UNDO_WINDOW_SECONDS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Undo window has expired")

    if request.confirmed_by_dj_at is not None or request.status == RequestStatus.CONFIRMED_BY_DJ:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="DJ already confirmed this request")

    if request.status == RequestStatus.LOCKED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="DJ already selected this request")

    if request.status in {
        RequestStatus.PLAYED,
        RequestStatus.REJECTED,
        RequestStatus.CANCELLED,
        RequestStatus.REFUNDED,
        RequestStatus.EXPIRED,
        RequestStatus.DISPUTED,
    }:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request can no longer be undone")


@dataclass(slots=True)
class RankedRequest:
    request_id: int
    rank: int
    total_amount_cents: int


def rank_requests(requests: list[SongRequest]) -> list[RankedRequest]:
    ordered = sorted(
        requests,
        key=lambda item: (-item.total_amount_cents, item.created_at, item.id),
    )
    return [
        RankedRequest(request_id=request.id, rank=index + 1, total_amount_cents=request.total_amount_cents)
        for index, request in enumerate(ordered)
    ]


def apply_successful_contribution(song_request: SongRequest, amount_cents: int, is_initial: bool = False) -> None:
    if song_request.status in {RequestStatus.LOCKED, RequestStatus.CONFIRMED_BY_DJ, RequestStatus.PLAYED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is no longer open")

    if is_initial and song_request.status == RequestStatus.PENDING_PAYMENT:
        song_request.status = RequestStatus.OPEN
    song_request.total_amount_cents += amount_cents


def cancel_contribution(song_request: SongRequest, amount_cents: int) -> None:
    if song_request.status != RequestStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only open requests may be cancelled",
        )

    song_request.total_amount_cents = max(0, song_request.total_amount_cents - amount_cents)
    if song_request.total_amount_cents == 0:
        song_request.status = RequestStatus.CANCELLED
        song_request.cancelled_at = datetime.now(UTC)


def confirm_request(song_request: SongRequest) -> None:
    if song_request.status == RequestStatus.CONFIRMED_BY_DJ:
        return
    if song_request.status not in {RequestStatus.OPEN, RequestStatus.LOCKED}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request cannot be confirmed")
    song_request.status = RequestStatus.CONFIRMED_BY_DJ
    song_request.confirmed_by_dj_at = datetime.now(UTC)


def mark_request_expired(song_request: SongRequest) -> None:
    if song_request.status in QUEUE_INACTIVE_STATUSES:
        return
    song_request.status = RequestStatus.EXPIRED
    song_request.expired_at = datetime.now(UTC)


def set_play_deadline_expiry(song_request: SongRequest, *, now: datetime | None = None) -> None:
    if not song_request.play_deadline_minutes:
        return
    current = now or datetime.now(UTC)
    song_request.play_deadline_expires_at = current + timedelta(minutes=song_request.play_deadline_minutes)


def capture_play_deadline_timing(song_request: SongRequest, *, now: datetime | None = None) -> None:
    if not song_request.play_deadline_minutes or not song_request.play_deadline_expires_at:
        return

    current = now or datetime.now(UTC)
    expires_at = _as_utc(song_request.play_deadline_expires_at)
    total_seconds = max(0, int(song_request.play_deadline_minutes) * 60)
    remaining_seconds = max(0, int((expires_at - current).total_seconds()))
    elapsed_seconds = min(total_seconds, max(0, total_seconds - remaining_seconds))

    song_request.play_deadline_remaining_seconds = remaining_seconds
    song_request.play_deadline_elapsed_seconds = elapsed_seconds
    # Freeze the deadline clock at the moment of play.
    song_request.play_deadline_expires_at = current

    logger.info(
        "Play deadline stopped for request %s: remaining=%ss elapsed=%ss total=%ss",
        song_request.id,
        remaining_seconds,
        elapsed_seconds,
        total_seconds,
    )


def mark_request_played(song_request: SongRequest, *, include_shoutout: bool = False) -> None:
    if song_request.status == RequestStatus.EXPIRED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request deadline has passed")
    if song_request.status != RequestStatus.CONFIRMED_BY_DJ:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request must be confirmed first")
    played_at = datetime.now(UTC)
    capture_play_deadline_timing(song_request, now=played_at)
    song_request.status = RequestStatus.PLAYED
    song_request.played_at = played_at
    if (song_request.shoutout_amount_cents or 0) > 0 and song_request.note:
        song_request.shoutout_fulfilled = include_shoutout


def delete_song_request(db: Session, song_request: SongRequest) -> None:
    from app.services.complimentary import restore_complimentary_credit_for_request

    request_id = song_request.id
    restore_complimentary_credit_for_request(db, song_request)
    db.execute(delete(DJEarningsLedger).where(DJEarningsLedger.song_request_id == request_id))
    db.execute(delete(Contribution).where(Contribution.song_request_id == request_id))
    db.execute(delete(Payment).where(Payment.song_request_id == request_id))
    db.delete(song_request)


PURGEABLE_QUEUE_STATUSES = {
    RequestStatus.PENDING_PAYMENT,
    RequestStatus.CANCELLED,
    RequestStatus.REJECTED,
    RequestStatus.REFUNDED,
    RequestStatus.EXPIRED,
}


def purge_inactive_requests_for_session(
    db: Session,
    session_id: int,
    *,
    event_id: int | None = None,
) -> None:
    stmt = select(SongRequest).where(
        SongRequest.session_id == session_id,
        SongRequest.status.in_(PURGEABLE_QUEUE_STATUSES),
    )
    if event_id is not None:
        stmt = stmt.where(SongRequest.event_id == event_id)

    for request in list(db.scalars(stmt)):
        delete_song_request(db, request)


def cancel_open_requests_for_session(
    db: Session,
    session_id: int,
    *,
    event_id: int | None = None,
    now: datetime | None = None,
) -> None:
    current = now or datetime.now(UTC)
    stmt = select(SongRequest).where(
        SongRequest.session_id == session_id,
        SongRequest.status.in_(
            {
                RequestStatus.PENDING_PAYMENT,
                RequestStatus.OPEN,
                RequestStatus.LOCKED,
                RequestStatus.CONFIRMED_BY_DJ,
            }
        ),
    )
    if event_id is not None:
        stmt = stmt.where(SongRequest.event_id == event_id)

    from app.services.complimentary import restore_complimentary_credit_for_request

    for request in db.scalars(stmt):
        restore_complimentary_credit_for_request(db, request)
        request.status = RequestStatus.CANCELLED
        request.cancelled_at = current


def cancel_mismatched_open_requests(db: Session, session: DJSession, *, now: datetime | None = None) -> None:
    if session.event_id is None:
        return

    current = now or datetime.now(UTC)
    stmt = select(SongRequest).where(
        SongRequest.session_id == session.id,
        SongRequest.status.in_(
            {
                RequestStatus.PENDING_PAYMENT,
                RequestStatus.OPEN,
                RequestStatus.LOCKED,
                RequestStatus.CONFIRMED_BY_DJ,
            }
        ),
        or_(SongRequest.event_id.is_(None), SongRequest.event_id != session.event_id),
    )

    from app.services.complimentary import restore_complimentary_credit_for_request

    for request in db.scalars(stmt):
        restore_complimentary_credit_for_request(db, request)
        request.status = RequestStatus.CANCELLED
        request.cancelled_at = current

