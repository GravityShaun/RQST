from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.models import Venue
from app.services.discover import list_venues
from app.services.places import PlaceCandidate, PlaceSearchError, search_places

VenueSearchSource = Literal["database", "online"]


@dataclass(frozen=True)
class VenueSearchResult:
    place_id: str
    name: str
    address: str
    city: str
    state: str | None
    country: str
    latitude: float | None
    longitude: float | None
    display_name: str
    source: VenueSearchSource
    venue_id: int | None = None


def _normalize_key(name: str, address: str, city: str) -> str:
    return "|".join(part.strip().lower() for part in (name, address, city))


def _format_display_name(*, name: str, address: str, city: str, state: str | None) -> str:
    parts = [name, address, city]
    if state:
        parts.append(state)
    return ", ".join(part.strip() for part in parts if part.strip())


def _venue_to_result(venue: Venue) -> VenueSearchResult:
    return VenueSearchResult(
        place_id=venue.place_id or f"db:{venue.id}",
        name=venue.name,
        address=venue.address,
        city=venue.city,
        state=venue.state,
        country=venue.country,
        latitude=float(venue.latitude) if venue.latitude is not None else None,
        longitude=float(venue.longitude) if venue.longitude is not None else None,
        display_name=_format_display_name(
            name=venue.name,
            address=venue.address,
            city=venue.city,
            state=venue.state,
        ),
        source="database",
        venue_id=venue.id,
    )


def _place_to_result(place: PlaceCandidate) -> VenueSearchResult:
    return VenueSearchResult(
        place_id=place.place_id,
        name=place.name,
        address=place.address,
        city=place.city,
        state=place.state,
        country=place.country,
        latitude=place.latitude,
        longitude=place.longitude,
        display_name=place.display_name,
        source="online",
        venue_id=None,
    )


def search_venue_suggestions(
    db: Session,
    query: str,
    *,
    db_limit: int = 6,
    online_limit: int = 6,
) -> list[VenueSearchResult]:
    trimmed = query.strip()
    if len(trimmed) < 2:
        return []

    results: list[VenueSearchResult] = []
    seen_place_ids: set[str] = set()
    seen_keys: set[str] = set()

    for venue in list_venues(db, trimmed)[:db_limit]:
        result = _venue_to_result(venue)
        seen_place_ids.add(result.place_id)
        seen_keys.add(_normalize_key(result.name, result.address, result.city))
        results.append(result)

    try:
        online_results = search_places(trimmed, limit=online_limit)
    except PlaceSearchError:
        online_results = []

    for place in online_results:
        if place.place_id in seen_place_ids:
            continue

        key = _normalize_key(place.name, place.address, place.city)
        if key in seen_keys:
            continue

        seen_place_ids.add(place.place_id)
        seen_keys.add(key)
        results.append(_place_to_result(place))

    return results
