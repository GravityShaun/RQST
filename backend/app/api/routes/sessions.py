from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, require_role
from app.models import DJProfile, DJSession, SessionStatus, User, UserRole
from app.schemas.common import MessageResponse
from app.schemas.sessions import SessionCreate, SessionRead, SessionUpdate
from app.services.dj_sessions import get_active_dj_session, serialize_session_read
from app.services.earnings import settle_session_earnings
from app.services.queue import cancel_open_requests_for_session, purge_inactive_requests_for_session
from app.realtime.queue import schedule_session_queue_broadcast

router = APIRouter(prefix="/sessions", tags=["sessions"])
dj_router = APIRouter(prefix="/dj/sessions", tags=["dj-sessions"])


@router.get("/nearby", response_model=list[SessionRead])
def get_nearby_sessions(db: DBSession) -> list[SessionRead]:
    sessions = list(db.scalars(select(DJSession).where(DJSession.status == SessionStatus.LIVE)))
    return [serialize_session_read(db, session) for session in sessions]


@router.get("/{session_id}", response_model=SessionRead)
def get_session(session_id: int, db: DBSession) -> SessionRead:
    session = db.get(DJSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return serialize_session_read(db, session)


@dj_router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> SessionRead:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Create DJ profile first")
    session = DJSession(dj_profile_id=profile.id, **payload.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return serialize_session_read(db, session)


@dj_router.get("/current", response_model=SessionRead | None)
def get_current_session(
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> SessionRead | None:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if not profile:
        return None
    session = get_active_dj_session(db, profile.id)
    return serialize_session_read(db, session) if session else None


@dj_router.post("/current/queue/reset", response_model=MessageResponse)
def reset_current_session_queue(
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> MessageResponse:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DJ profile not found")

    session = get_active_dj_session(db, profile.id)
    if not session or session.status != SessionStatus.LIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No live session to reset")

    cancel_open_requests_for_session(
        db,
        session.id,
        event_id=session.event_id,
    )
    purge_inactive_requests_for_session(
        db,
        session.id,
        event_id=session.event_id,
    )
    db.commit()
    schedule_session_queue_broadcast(session.id)
    return MessageResponse(message="Live queue cleared")


@dj_router.patch("/{session_id}", response_model=SessionRead)
def update_session(session_id: int, payload: SessionUpdate, db: DBSession) -> SessionRead:
    session = db.get(DJSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(session, key, value)
    db.commit()
    db.refresh(session)
    return serialize_session_read(db, session)


@dj_router.post("/{session_id}/start", response_model=SessionRead)
def start_session(session_id: int, db: DBSession) -> SessionRead:
    session = db.get(DJSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.status = SessionStatus.LIVE
    session.started_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)
    return serialize_session_read(db, session)


@dj_router.post("/{session_id}/pause", response_model=SessionRead)
def pause_session(session_id: int, db: DBSession) -> SessionRead:
    session = db.get(DJSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.status = SessionStatus.PAUSED
    session.paused_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)
    return serialize_session_read(db, session)


@dj_router.post("/{session_id}/end", response_model=SessionRead)
def end_session(session_id: int, db: DBSession) -> SessionRead:
    session = db.get(DJSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.status = SessionStatus.ENDED
    session.ended_at = datetime.now(UTC)
    session.accepting_requests = False
    cancel_open_requests_for_session(db, session.id, event_id=session.event_id)
    settle_session_earnings(db, session.id)
    db.commit()
    db.refresh(session)
    return serialize_session_read(db, session)

