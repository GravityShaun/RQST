from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DJSession, Event, SessionStatus


def _now() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def is_event_live(event: Event, *, now: datetime | None = None) -> bool:
    current = now or _now()
    if _as_utc(event.starts_at) > current:
        return False
    if event.ends_at is None:
        return True
    return _as_utc(event.ends_at) > current


def sync_live_sessions_for_events(db: Session) -> None:
    """Start live sessions for active shows and end sessions for finished shows."""
    now = _now()
    changed = False

    for session in db.scalars(
        select(DJSession).where(
            DJSession.status == SessionStatus.LIVE,
            DJSession.event_id.isnot(None),
        )
    ):
        event = db.get(Event, session.event_id)
        if event is None or not is_event_live(event, now=now):
            session.status = SessionStatus.ENDED
            session.ended_at = now
            session.accepting_requests = False
            changed = True

    active_events = [
        event
        for event in db.scalars(select(Event).order_by(Event.starts_at.desc(), Event.id.desc()))
        if is_event_live(event, now=now)
    ]
    active_by_profile: dict[int, Event] = {}
    for event in active_events:
        active_by_profile.setdefault(event.dj_profile_id, event)

    for event in active_by_profile.values():
        live_session = db.scalar(
            select(DJSession).where(
                DJSession.dj_profile_id == event.dj_profile_id,
                DJSession.status == SessionStatus.LIVE,
            )
        )
        if live_session:
            if live_session.event_id != event.id or live_session.venue_id != event.venue_id:
                live_session.event_id = event.id
                live_session.venue_id = event.venue_id
                changed = True
            continue

        linked_session = db.scalar(
            select(DJSession).where(
                DJSession.event_id == event.id,
                DJSession.status != SessionStatus.ENDED,
            )
        )
        if linked_session:
            linked_session.status = SessionStatus.LIVE
            linked_session.started_at = linked_session.started_at or now
            linked_session.venue_id = event.venue_id
            linked_session.accepting_requests = True
            changed = True
            continue

        db.add(
            DJSession(
                dj_profile_id=event.dj_profile_id,
                venue_id=event.venue_id,
                event_id=event.id,
                status=SessionStatus.LIVE,
                started_at=now,
                minimum_request_amount_cents=500,
                accepting_requests=True,
            )
        )
        changed = True

    if changed:
        db.commit()
