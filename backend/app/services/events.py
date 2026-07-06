from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Event, Venue
from app.schemas.events import EventRead
from app.schemas.venues import VenueCreate, VenueRead


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
