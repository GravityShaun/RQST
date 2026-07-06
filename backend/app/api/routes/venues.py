from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import DBSession, require_role
from app.models import User, UserRole
from app.schemas.venues import PlaceSearchResult, VenueCreate, VenueRead
from app.services.discover import list_venues as fetch_venues
from app.services.events import find_or_create_venue, serialize_venue
from app.services.venue_search import search_venue_suggestions

router = APIRouter(prefix="/venues", tags=["venues"])


@router.get("", response_model=list[VenueRead])
def list_venues(db: DBSession, q: str | None = None) -> list[VenueRead]:
    venues = fetch_venues(db, q)
    return [serialize_venue(venue) for venue in venues]


@router.get("/search", response_model=list[VenueRead])
def search_venues(db: DBSession, q: str | None = None) -> list[VenueRead]:
    venues = fetch_venues(db, q)
    return [serialize_venue(venue) for venue in venues]


@router.get("/places/search", response_model=list[PlaceSearchResult])
def search_places_online(
    q: str,
    db: DBSession,
    _: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> list[PlaceSearchResult]:
    results = search_venue_suggestions(db, q)
    return [
        PlaceSearchResult(
            place_id=result.place_id,
            name=result.name,
            address=result.address,
            city=result.city,
            state=result.state,
            country=result.country,
            latitude=result.latitude,
            longitude=result.longitude,
            display_name=result.display_name,
            source=result.source,
            venue_id=result.venue_id,
        )
        for result in results
    ]


@router.post("", response_model=VenueRead, status_code=status.HTTP_201_CREATED)
def create_venue(
    payload: VenueCreate,
    db: DBSession,
    _: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> VenueRead:
    venue = find_or_create_venue(db, payload)
    db.commit()
    db.refresh(venue)
    return serialize_venue(venue)


@router.get("/nearby", response_model=list[dict])
def nearby_venues(
    db: DBSession,
    latitude: float | None = None,
    longitude: float | None = None,
    q: str | None = None,
) -> list[dict]:
    venues = fetch_venues(db, q)
    return [
        {
            **serialize_venue(venue).model_dump(),
            "query_latitude": latitude,
            "query_longitude": longitude,
        }
        for venue in venues
    ]
