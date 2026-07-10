from typing import Annotated

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.deps import DBSession, require_role
from app.core.config import get_settings
from app.models import DJProfile, Event, User, UserRole, Venue
from app.schemas.djs import DJDiscoverRead, DJProfileCreate, DJProfileRead
from app.schemas.earnings import DjEarningsDashboardRead, LedgerEntryRead, WithdrawRequest, WithdrawResponse
from app.schemas.events import EventCreate, EventExtend, EventRead, EventUpdate
from app.schemas.complimentary import (
    ComplimentaryCodeIssueCreate,
    ComplimentaryCodeIssueRead,
    ComplimentaryCodeSummaryRead,
    ComplimentaryCodeUpdate,
)
from app.services.earnings import build_earnings_dashboard, list_ledger_entries, request_withdrawal
from app.services.discover import get_discover_dj, list_discover_djs, list_public_djs
from app.services.complimentary import (
    issue_complimentary_code,
    list_complimentary_codes_for_event,
    update_complimentary_code_settings,
    void_active_codes_for_event,
)
from app.services.event_sessions import is_event_live, sync_live_sessions_for_events
from app.services.events import (
    end_event_now,
    extend_event_end,
    find_or_create_venue,
    list_events_for_profile,
    serialize_event,
)
from app.services.flyers import FlyerValidationError, save_event_flyer

router = APIRouter(prefix="/djs", tags=["djs"])
dj_router = APIRouter(prefix="/dj", tags=["dj"])
settings = get_settings()


def _get_profile(db: DBSession, user: User) -> DJProfile:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DJ profile not found")
    return profile


def _resolve_venue_id(db: DBSession, *, venue_id: int | None, venue_payload) -> int:
    if venue_id is not None:
        venue = db.get(Venue, venue_id)
        if venue is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue not found")
        return venue.id

    if venue_payload is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Venue is required")

    venue = find_or_create_venue(db, venue_payload)
    return venue.id


def _get_owned_event(db: DBSession, profile: DJProfile, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None or event.dj_profile_id != profile.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.get("", response_model=list[DJDiscoverRead])
def list_djs(db: DBSession, q: str | None = None) -> list[DJDiscoverRead]:
    return [DJDiscoverRead.model_validate(profile) for profile in list_discover_djs(db, q)]


@router.get("/profile", response_model=DJProfileRead)
def get_my_profile(
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> DJProfileRead:
    return DJProfileRead.model_validate(_get_profile(db, user))


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


@router.patch("/profile", response_model=DJProfileRead)
def update_profile(
    payload: DJProfileCreate,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> DJProfileRead:
    profile = _get_profile(db, user)
    profile.artist_name = payload.artist_name
    profile.slug = payload.slug
    profile.bio = payload.bio
    profile.city = payload.city
    profile.genres_json = payload.genres
    db.commit()
    db.refresh(profile)
    return DJProfileRead.model_validate(profile)


@router.get("/events", response_model=list[EventRead])
def list_my_events(
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> list[EventRead]:
    profile = _get_profile(db, user)
    return list_events_for_profile(db, profile.id)


@router.post("/events", response_model=EventRead, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> EventRead:
    profile = _get_profile(db, user)
    venue_id = _resolve_venue_id(db, venue_id=payload.venue_id, venue_payload=payload.venue)
    event = Event(
        dj_profile_id=profile.id,
        venue_id=venue_id,
        name=payload.name.strip() if payload.name and payload.name.strip() else None,
        description=payload.description.strip() if payload.description else None,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        ticket_url=payload.ticket_url,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    sync_live_sessions_for_events(db)
    return serialize_event(db, event)


@router.patch("/events/{event_id}", response_model=EventRead)
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> EventRead:
    profile = _get_profile(db, user)
    event = _get_owned_event(db, profile, event_id)

    if payload.name is not None:
        event.name = payload.name.strip() or None
    if payload.description is not None:
        event.description = payload.description.strip() or None
    if payload.starts_at is not None:
        event.starts_at = payload.starts_at
    if payload.ends_at is not None:
        event.ends_at = payload.ends_at
    if payload.ticket_url is not None:
        event.ticket_url = payload.ticket_url or None

    if payload.venue_id is not None or payload.venue is not None:
        event.venue_id = _resolve_venue_id(
            db,
            venue_id=payload.venue_id,
            venue_payload=payload.venue,
        )

    db.commit()
    db.refresh(event)
    sync_live_sessions_for_events(db)
    return serialize_event(db, event)


@router.post("/events/{event_id}/extend", response_model=EventRead)
def extend_event(
    event_id: int,
    payload: EventExtend,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> EventRead:
    profile = _get_profile(db, user)
    event = _get_owned_event(db, profile, event_id)

    if not is_event_live(event):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only live shows can be extended.")

    try:
        extend_event_end(event, payload.minutes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    db.commit()
    db.refresh(event)
    sync_live_sessions_for_events(db)
    return serialize_event(db, event)


@router.post("/events/{event_id}/end", response_model=EventRead)
def end_event(
    event_id: int,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> EventRead:
    profile = _get_profile(db, user)
    event = _get_owned_event(db, profile, event_id)

    if not is_event_live(event):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This show is not live.")

    end_event_now(event)
    void_active_codes_for_event(db, event.id)
    db.commit()
    db.refresh(event)
    sync_live_sessions_for_events(db)
    return serialize_event(db, event)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> None:
    profile = _get_profile(db, user)
    event = _get_owned_event(db, profile, event_id)
    void_active_codes_for_event(db, event.id)
    db.delete(event)
    db.commit()
    sync_live_sessions_for_events(db)


@router.post("/events/{event_id}/flyer", response_model=EventRead)
async def upload_event_flyer(
    event_id: int,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
    file: UploadFile = File(...),
) -> EventRead:
    profile = _get_profile(db, user)
    event = _get_owned_event(db, profile, event_id)
    content = await file.read()

    try:
        flyer_path = save_event_flyer(
            event_id=event.id,
            uploads_dir=settings.uploads_dir,
            content=content,
            content_type=file.content_type,
        )
    except FlyerValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    event.flyer_url = flyer_path
    db.commit()
    db.refresh(event)
    return serialize_event(db, event)


@router.get("/events/{event_id}/complimentary-codes", response_model=ComplimentaryCodeSummaryRead)
def list_event_complimentary_codes(
    event_id: int,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> ComplimentaryCodeSummaryRead:
    profile = _get_profile(db, user)
    event = _get_owned_event(db, profile, event_id)
    return list_complimentary_codes_for_event(db, event=event)


@router.post(
    "/events/{event_id}/complimentary-codes",
    response_model=ComplimentaryCodeIssueRead,
    status_code=status.HTTP_201_CREATED,
)
def issue_event_complimentary_code(
    event_id: int,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
    payload: Annotated[ComplimentaryCodeIssueCreate, Body()] = ComplimentaryCodeIssueCreate(),
) -> ComplimentaryCodeIssueRead:
    profile = _get_profile(db, user)
    event = _get_owned_event(db, profile, event_id)
    issued = issue_complimentary_code(
        db,
        event=event,
        dj_profile=profile,
        allow_multiple_uses_per_user=payload.allow_multiple_uses_per_user,
    )
    db.commit()
    return issued


@router.patch(
    "/events/{event_id}/complimentary-codes",
    response_model=ComplimentaryCodeIssueRead,
)
def update_event_complimentary_code(
    event_id: int,
    payload: ComplimentaryCodeUpdate,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> ComplimentaryCodeIssueRead:
    profile = _get_profile(db, user)
    event = _get_owned_event(db, profile, event_id)
    updated = update_complimentary_code_settings(
        db,
        event=event,
        allow_multiple_uses_per_user=payload.allow_multiple_uses_per_user,
    )
    db.commit()
    return updated


@router.get("/{slug}/events", response_model=list[EventRead])
def list_dj_events(slug: str, db: DBSession) -> list[EventRead]:
    profile = db.scalar(select(DJProfile).where(DJProfile.slug == slug))
    if not profile:
        return []
    return list_events_for_profile(db, profile.id)


@router.get("/{slug}", response_model=DJDiscoverRead)
def get_dj(slug: str, db: DBSession) -> DJDiscoverRead:
    profile = db.scalar(select(DJProfile).where(DJProfile.slug == slug))
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DJ not found")
    return DJDiscoverRead.model_validate(get_discover_dj(db, profile))


@dj_router.get("/earnings", response_model=DjEarningsDashboardRead)
def get_dj_earnings(
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> DjEarningsDashboardRead:
    profile = _get_profile(db, user)
    return build_earnings_dashboard(db, profile.id)


@dj_router.get("/payments", response_model=list[LedgerEntryRead])
def get_dj_payments(
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
    limit: int = 100,
) -> list[LedgerEntryRead]:
    profile = _get_profile(db, user)
    return list_ledger_entries(db, profile.id, limit=min(limit, 200))


@dj_router.post("/payouts/withdraw", response_model=WithdrawResponse)
def withdraw_earnings(
    payload: WithdrawRequest,
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> WithdrawResponse:
    profile = _get_profile(db, user)
    message, polar_connected = request_withdrawal(db, profile.id, payload.amount_cents)
    if polar_connected:
        db.commit()
    return WithdrawResponse(message=message, polar_connected=polar_connected)
