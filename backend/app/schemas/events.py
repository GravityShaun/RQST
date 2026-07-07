from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import APIModel
from app.schemas.venues import VenueCreate, VenueRead


class EventCreate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    ticket_url: str | None = Field(default=None, max_length=500)
    venue_id: int | None = None
    venue: VenueCreate | None = None

    @model_validator(mode="after")
    def validate_venue(self) -> "EventCreate":
        if self.venue_id is None and self.venue is None:
            raise ValueError("Provide either venue_id or venue details.")
        if self.venue_id is not None and self.venue is not None:
            raise ValueError("Provide venue_id or venue details, not both.")
        return self


class EventUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    ticket_url: str | None = Field(default=None, max_length=500)
    venue_id: int | None = None
    venue: VenueCreate | None = None


class EventExtend(BaseModel):
    minutes: int = Field(ge=1, le=480)


class EventRead(APIModel):
    id: int
    dj_profile_id: int
    name: str | None = None
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    ticket_url: str | None = None
    flyer_url: str | None = None
    venue: VenueRead
