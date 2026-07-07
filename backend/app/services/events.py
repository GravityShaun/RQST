from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Event, Venue
from app.schemas.events import EventRead
from app.schemas.venues import VenueCreate, VenueRead

SHOW_MAX_DURATION_HOURS = 8


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _now() -> datetime:
    return datetime.now(UTC)


def _max_event_end(starts_at: datetime) -> datetime:
    return _as_utc(starts_at) + timedelta(hours=SHOW_MAX_DURATION_HOURS)


def extend_event_end(event: Event, extend_minutes: int, *, now: datetime | None = None) -> datetime:
    """Push a live show's end time forward and return the new end timestamp."""
    if extend_minutes <= 0:
        raise ValueError("Extension must be greater than zero minutes.")

    current = now or _now()
    starts_at = _as_utc(event.starts_at)
    max_end = _max_event_end(starts_at)

    if event.ends_at is None:
        base_end = max(current, starts_at)
    else:
        base_end = max(_as_utc(event.ends_at), current)

    if base_end >= max_end:
        raise ValueError("This show is already at the maximum duration.")

    proposed_end = base_end + timedelta(minutes=extend_minutes)
    new_end = min(proposed_end, max_end)

    if new_end <= base_end:
        raise ValueError("This show is already at the maximum duration.")

    event.ends_at = new_end
    return new_end


def end_event_now(event: Event, *, now: datetime | None = None) -> datetime:
    """End a show immediately."""
    ended_at = now or _now()
    event.ends_at = ended_at
    return ended_at


def serialize_venue(venue: Venue) -> VenueRead:
    return VenueRead(
        id=venue.id,
        name=venue.name,
        address=venue.address,
        city=venue.city,
        state=venue.state,
        country=venue.country,
        latitude=float(venue.latitude) if venue.latitude is not None else None,
        longitude=float(venue.longitude) if venue.longitude is not None else None,
        place_id=venue.place_id,
    )


def serialize_event(db: Session, event: Event) -> EventRead:
    venue = db.get(Venue, event.venue_id)
    if venue is None:
        raise ValueError(f"Venue {event.venue_id} not found for event {event.id}")

    return EventRead(
        id=event.id,
        dj_profile_id=event.dj_profile_id,
        name=event.name,
        description=event.description,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        ticket_url=event.ticket_url,
        flyer_url=event.flyer_url,
        venue=serialize_venue(venue),
    )


def find_or_create_venue(db: Session, payload: VenueCreate) -> Venue:
    if payload.place_id:
        existing = db.scalar(select(Venue).where(Venue.place_id == payload.place_id))
        if existing:
            return existing

    venue = Venue(
        name=payload.name.strip(),
        address=payload.address.strip(),
        city=payload.city.strip(),
        state=payload.state.strip() if payload.state else None,
        country=payload.country.strip() or "US",
        latitude=payload.latitude,
        longitude=payload.longitude,
        place_id=payload.place_id,
    )
    db.add(venue)
    db.flush()
    return venue


def list_events_for_profile(db: Session, dj_profile_id: int) -> list[EventRead]:
    events = list(
        db.scalars(
            select(Event)
            .where(Event.dj_profile_id == dj_profile_id)
            .order_by(Event.starts_at.asc(), Event.id.asc())
        )
    )
    return [serialize_event(db, event) for event in events]
