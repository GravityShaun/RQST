from datetime import UTC, datetime, timedelta

import pytest

from app.models import Event
from app.services.events import SHOW_MAX_DURATION_HOURS, extend_event_end


def _make_event(*, starts_at: datetime, ends_at: datetime | None) -> Event:
    return Event(
        dj_profile_id=1,
        venue_id=1,
        starts_at=starts_at,
        ends_at=ends_at,
    )


def test_extend_event_end_adds_minutes_to_scheduled_end() -> None:
    now = datetime(2026, 7, 7, 21, 0, tzinfo=UTC)
    starts_at = now - timedelta(hours=1)
    ends_at = starts_at + timedelta(hours=2)
    event = _make_event(starts_at=starts_at, ends_at=ends_at)

    new_end = extend_event_end(event, 15, now=now)

    assert new_end == ends_at + timedelta(minutes=15)
    assert event.ends_at == new_end


def test_extend_event_end_respects_max_duration() -> None:
    now = datetime(2026, 7, 7, 21, 0, tzinfo=UTC)
    starts_at = now - timedelta(hours=SHOW_MAX_DURATION_HOURS) + timedelta(minutes=10)
    ends_at = starts_at + timedelta(hours=SHOW_MAX_DURATION_HOURS) - timedelta(minutes=5)
    event = _make_event(starts_at=starts_at, ends_at=ends_at)

    new_end = extend_event_end(event, 30, now=now)

    assert new_end == starts_at + timedelta(hours=SHOW_MAX_DURATION_HOURS)
    assert event.ends_at == new_end


def test_extend_event_end_rejects_when_already_at_max() -> None:
    now = datetime(2026, 7, 7, 21, 0, tzinfo=UTC)
    starts_at = now - timedelta(hours=SHOW_MAX_DURATION_HOURS)
    ends_at = starts_at + timedelta(hours=SHOW_MAX_DURATION_HOURS)
    event = _make_event(starts_at=starts_at, ends_at=ends_at)

    with pytest.raises(ValueError):
        extend_event_end(event, 15, now=now)
