from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DJSession, SessionStatus


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
