from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DJSession, Event, SessionStatus
from app.schemas.sessions import SessionRead


def get_active_dj_session(db: Session, dj_profile_id: int) -> DJSession | None:
    live_session = db.scalar(
        select(DJSession)
        .where(
            DJSession.dj_profile_id == dj_profile_id,
            DJSession.status == SessionStatus.LIVE,
        )
        .order_by(DJSession.started_at.desc(), DJSession.id.desc())
    )
    if live_session:
        return live_session

    return db.scalar(
        select(DJSession)
        .where(DJSession.dj_profile_id == dj_profile_id)
        .order_by(DJSession.created_at.desc(), DJSession.id.desc())
    )


def serialize_session_read(db: Session, session: DJSession) -> SessionRead:
    event = db.get(Event, session.event_id) if session.event_id else None
    return SessionRead(
        id=session.id,
        dj_profile_id=session.dj_profile_id,
        venue_id=session.venue_id,
        event_id=session.event_id,
        status=session.status,
        minimum_request_amount_cents=session.minimum_request_amount_cents,
        currency=session.currency,
        accepting_requests=session.accepting_requests,
        allow_explicit=session.allow_explicit,
        allow_any_song=session.allow_any_song,
        started_at=session.started_at,
        paused_at=session.paused_at,
        ended_at=session.ended_at,
        event_name=event.name if event else None,
        event_starts_at=event.starts_at if event else None,
    )
