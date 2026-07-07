from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import SessionStatus
from app.schemas.common import APIModel


class SessionCreate(BaseModel):
    venue_id: int
    event_id: int | None = None
    minimum_request_amount_cents: int = Field(ge=100, default=500)
    allow_explicit: bool = True
    allow_any_song: bool = False
    accepting_requests: bool = True


class SessionUpdate(BaseModel):
    minimum_request_amount_cents: int | None = Field(default=None, ge=100)
    accepting_requests: bool | None = None
    allow_explicit: bool | None = None
    allow_any_song: bool | None = None
    venue_id: int | None = None
    event_id: int | None = None


class SessionRead(APIModel):
    id: int
    dj_profile_id: int
    venue_id: int
    event_id: int | None = None
    status: SessionStatus
    minimum_request_amount_cents: int
    currency: str
    accepting_requests: bool
    allow_explicit: bool
    allow_any_song: bool
    started_at: datetime | None = None
    paused_at: datetime | None = None
    ended_at: datetime | None = None
    event_name: str | None = None
    event_starts_at: datetime | None = None

