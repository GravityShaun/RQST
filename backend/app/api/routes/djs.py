from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, require_role
from app.models import DJProfile, Event, User, UserRole
from app.schemas.common import MessageResponse
from app.schemas.djs import DJProfileCreate, DJProfileRead, EventCreate

router = APIRouter(prefix="/djs", tags=["djs"])
dj_router = APIRouter(prefix="/dj", tags=["dj"])


@router.get("", response_model=list[DJProfileRead])
def list_djs(db: DBSession) -> list[DJProfileRead]:
    profiles = list(db.scalars(select(DJProfile).where(DJProfile.is_public.is_(True)).order_by(DJProfile.artist_name)))
    return [DJProfileRead.model_validate(profile) for profile in profiles]


@router.get("/{slug}", response_model=DJProfileRead)
def get_dj(slug: str, db: DBSession) -> DJProfileRead:
    profile = db.scalar(select(DJProfile).where(DJProfile.slug == slug))
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DJ not found")
    return DJProfileRead.model_validate(profile)


@router.post("/profile", response_model=DJProfileRead, status_code=status.HTTP_201_CREATED)
def create_profile(
    payload: DJProfileCreate,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> DJProfileRead:
    existing = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="DJ profile already exists")
    profile = DJProfile(
        user_id=user.id,
        artist_name=payload.artist_name,
        slug=payload.slug,
        bio=payload.bio,
        city=payload.city,
        genres_json=payload.genres,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return DJProfileRead.model_validate(profile)


@router.patch("/profile", response_model=MessageResponse)
def update_profile(
    payload: DJProfileCreate,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> MessageResponse:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DJ profile not found")
    profile.artist_name = payload.artist_name
    profile.slug = payload.slug
    profile.bio = payload.bio
    profile.city = payload.city
    profile.genres_json = payload.genres
    db.commit()
    return MessageResponse(message="Profile updated")


@router.get("/{slug}/events", response_model=list[dict])
def list_dj_events(slug: str, db: DBSession) -> list[dict]:
    profile = db.scalar(select(DJProfile).where(DJProfile.slug == slug))
    if not profile:
        return []
    events = list(db.scalars(select(Event).where(Event.dj_profile_id == profile.id)))
    return [{"id": event.id, "name": event.name} for event in events]


@router.post("/events", response_model=MessageResponse)
def create_event(
    payload: EventCreate,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> MessageResponse:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if not profile:
        return MessageResponse(message="Create a DJ profile first")
    event = Event(
        dj_profile_id=profile.id,
        venue_id=payload.venue_id,
        name=payload.name,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        ticket_url=payload.ticket_url,
    )
    db.add(event)
    db.commit()
    return MessageResponse(message="Event created")


@dj_router.get("/payments", response_model=list[dict])
def get_dj_payments() -> list[dict]:
    return []


@dj_router.get("/earnings", response_model=dict)
def get_dj_earnings() -> dict:
    return {"pending_cents": 0, "available_cents": 0}
