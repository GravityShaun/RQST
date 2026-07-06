from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class VenueRead(APIModel):
    id: int
    name: str
    address: str
    city: str
    state: str | None = None
    country: str
    latitude: float | None = None
    longitude: float | None = None
    place_id: str | None = None


class VenueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    country: str = Field(default="US", max_length=120)
    latitude: float | None = None
    longitude: float | None = None
    place_id: str | None = Field(default=None, max_length=255)


class PlaceSearchResult(APIModel):
    place_id: str
    name: str
    address: str
    city: str
    state: str | None = None
    country: str
    latitude: float | None = None
    longitude: float | None = None
    display_name: str
    source: str
    venue_id: int | None = None
