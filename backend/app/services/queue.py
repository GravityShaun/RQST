from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status

from app.models import ContributionStatus, RequestStatus, SongRequest


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

