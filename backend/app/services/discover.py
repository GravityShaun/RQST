from __future__ import annotations

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models import DJProfile, DJSession, SessionStatus, User, Venue
from app.services.event_sessions import sync_live_sessions_for_events


def _like(term: str) -> str:
    return f"%{term.strip().lower()}%"


def apply_dj_search(stmt: Select, q: str | None) -> Select:
    if not q or not q.strip():
        return stmt

    pattern = _like(q)
    return stmt.where(
        or_(
            func.lower(DJProfile.artist_name).like(pattern),
            func.lower(DJProfile.slug).like(pattern),
            func.lower(func.coalesce(DJProfile.city, "")).like(pattern),
            func.lower(func.coalesce(DJProfile.bio, "")).like(pattern),
            func.lower(User.display_name).like(pattern),
        )
    )


def apply_venue_search(stmt: Select, q: str | None) -> Select:
    if not q or not q.strip():
        return stmt

    pattern = _like(q)
    return stmt.where(
        or_(
            func.lower(Venue.name).like(pattern),
            func.lower(Venue.address).like(pattern),
            func.lower(Venue.city).like(pattern),
            func.lower(func.coalesce(Venue.state, "")).like(pattern),
        )
    )


def list_public_djs(db: Session, q: str | None = None) -> list[DJProfile]:
    stmt = (
        select(DJProfile)
        .join(User, DJProfile.user_id == User.id)
        .where(DJProfile.is_public.is_(True))
        .order_by(DJProfile.artist_name)
    )
    stmt = apply_dj_search(stmt, q)
    return list(db.scalars(stmt))


def serialize_discover_dj(db: Session, profile: DJProfile) -> dict:
    live_session = db.scalar(
        select(DJSession).where(
            DJSession.dj_profile_id == profile.id,
            DJSession.status == SessionStatus.LIVE,
        )
    )
    venue = db.get(Venue, live_session.venue_id) if live_session else None

    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "artist_name": profile.artist_name,
        "slug": profile.slug,
        "bio": profile.bio,
        "city": profile.city,
        "genres_json": profile.genres_json or [],
        "is_public": profile.is_public,
        "live_session_id": live_session.id if live_session else None,
        "is_live": live_session is not None,
        "venue_name": venue.name if venue else None,
    }


def list_discover_djs(db: Session, q: str | None = None) -> list[dict]:
    sync_live_sessions_for_events(db)
    profiles = list_public_djs(db, q)
    return [serialize_discover_dj(db, profile) for profile in profiles]


def get_discover_dj(db: Session, profile: DJProfile) -> dict:
    sync_live_sessions_for_events(db)
    return serialize_discover_dj(db, profile)


def list_venues(db: Session, q: str | None = None) -> list[Venue]:
    stmt = select(Venue).order_by(Venue.name)
    stmt = apply_venue_search(stmt, q)
    return list(db.scalars(stmt))
