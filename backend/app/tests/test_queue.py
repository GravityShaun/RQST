from datetime import UTC, datetime, timedelta

from app.models import RequestStatus, SongRequest
from app.services.queue import apply_successful_contribution, cancel_contribution, confirm_request, mark_request_played, rank_requests


def make_request(request_id: int, total: int, created_offset: int = 0) -> SongRequest:
    return SongRequest(
        id=request_id,
        session_id=1,
        song_id=request_id,
        requested_by_user_id=1,
        status=RequestStatus.OPEN,
        original_amount_cents=500,
        total_amount_cents=total,
        currency="USD",
        created_at=datetime.now(UTC) + timedelta(seconds=created_offset),
        updated_at=datetime.now(UTC),
    )


def test_rank_requests_orders_by_amount_then_time_then_id() -> None:
    first = make_request(1, 1200, created_offset=10)
    second = make_request(2, 1500, created_offset=5)
    third = make_request(3, 1200, created_offset=1)

    ranked = rank_requests([first, second, third])

    assert [item.request_id for item in ranked] == [2, 3, 1]
    assert [item.rank for item in ranked] == [1, 2, 3]


def test_cancel_contribution_zeroes_request_and_cancels() -> None:
    request = make_request(1, 500)
    cancel_contribution(request, 500)
    assert request.total_amount_cents == 0
    assert request.status == RequestStatus.CANCELLED


def test_confirm_then_play_flow() -> None:
    request = make_request(1, 1200)
    confirm_request(request)
    assert request.status == RequestStatus.CONFIRMED_BY_DJ
    mark_request_played(request)
    assert request.status == RequestStatus.PLAYED


def test_initial_success_opens_pending_request() -> None:
    request = make_request(1, 0)
    request.status = RequestStatus.PENDING_PAYMENT
    apply_successful_contribution(request, 700, is_initial=True)
    assert request.status == RequestStatus.OPEN
    assert request.total_amount_cents == 700

