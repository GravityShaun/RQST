from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, require_role
from app.models import DJProfile, DJSession, SessionStatus, User, UserRole
from app.schemas.tips import ListenerProfileRead, TipCreate, TipRead
from app.services.dj_sessions import get_active_dj_session
from app.services.tips import (
    build_listener_profile,
    create_session_tip,
    list_current_dj_tips,
    list_open_session_tips,
    list_thanked_dj_tips,
    serialize_tip,
    thank_tip,
)

router = APIRouter(tags=["tips"])
dj_router = APIRouter(prefix="/dj", tags=["dj-tips"])


@router.post(
    "/sessions/{session_id}/tips",
    response_model=TipRead,
    status_code=status.HTTP_201_CREATED,
)
def create_tip(
    session_id: int,
    payload: TipCreate,
    db: DBSession,
    user: Annotated[User, Depends(get_current_user)],
) -> TipRead:
    tip = create_session_tip(db, session_id=session_id, user=user, amount_cents=payload.amount_cents)
    db.commit()
    db.refresh(tip)
    return serialize_tip(db, tip)


@router.get("/sessions/{session_id}/tips", response_model=list[TipRead])
def get_session_tips(session_id: int, db: DBSession) -> list[TipRead]:
    session = db.get(DJSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return [serialize_tip(db, tip) for tip in list_open_session_tips(db, session_id)]


@dj_router.get("/tips/current", response_model=list[TipRead])
def get_current_dj_tips(
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> list[TipRead]:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DJ profile not found")
    session = get_active_dj_session(db, profile.id)
    if not session or session.status != SessionStatus.LIVE:
        return []
    return [serialize_tip(db, tip) for tip in list_current_dj_tips(db, profile.id, session.id)]


@dj_router.get("/tips/thanked", response_model=list[TipRead])
def get_thanked_dj_tips(
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> list[TipRead]:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DJ profile not found")
    session = get_active_dj_session(db, profile.id)
    if not session:
        return []
    return [serialize_tip(db, tip) for tip in list_thanked_dj_tips(db, profile.id, session.id)]


@dj_router.get("/listeners/{user_id}", response_model=ListenerProfileRead)
def get_listener_profile(
    user_id: int,
    db: DBSession,
    _user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> ListenerProfileRead:
    return build_listener_profile(db, user_id)


@dj_router.post("/tips/{tip_id}/thank", response_model=TipRead)
def thank_tip_route(
    tip_id: int,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> TipRead:
    tip = thank_tip(db, tip_id=tip_id, dj_user=user)
    db.commit()
    db.refresh(tip)
    return serialize_tip(db, tip)
