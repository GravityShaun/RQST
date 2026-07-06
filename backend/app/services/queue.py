from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import (
    Contribution,
    ContributionStatus,
    DJEarningsLedger,
    Payment,
    RequestStatus,
    SongRequest,
)

INACTIVE_QUEUE_STATUSES = {
    RequestStatus.CANCELLED,
    RequestStatus.REJECTED,
    RequestStatus.REFUNDED,
    RequestStatus.EXPIRED,
}

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


def mark_request_played(song_request: SongRequest) -> None:
    if song_request.status != RequestStatus.CONFIRMED_BY_DJ:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request must be confirmed first")
    song_request.status = RequestStatus.PLAYED
    song_request.played_at = datetime.now(UTC)


def delete_song_request(db: Session, song_request: SongRequest) -> None:
    request_id = song_request.id
    db.execute(delete(DJEarningsLedger).where(DJEarningsLedger.song_request_id == request_id))
    db.execute(delete(Contribution).where(Contribution.song_request_id == request_id))
    db.execute(delete(Payment).where(Payment.song_request_id == request_id))
    db.delete(song_request)

