from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class DJProfileCreate(BaseModel):
    artist_name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=120)
    bio: str | None = None
    city: str | None = None
    genres: list[str] = Field(default_factory=list)


class DJProfileRead(APIModel):
    id: int
    user_id: int
    artist_name: str
    slug: str
    bio: str | None = None
    city: str | None = None
    genres_json: list[str]
    is_public: bool


class EventCreate(BaseModel):
    venue_id: int
    name: str
    starts_at: datetime
    ends_at: datetime | None = None
    ticket_url: str | None = None

