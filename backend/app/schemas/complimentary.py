from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import APIModel


class ComplimentaryCodeRedeem(BaseModel):
    code: str = Field(min_length=4, max_length=32)


class ComplimentaryCodeIssueCreate(BaseModel):
    allow_multiple_uses_per_user: bool = False


class ComplimentaryCodeUpdate(BaseModel):
    allow_multiple_uses_per_user: bool


class ComplimentaryCodeIssueRead(APIModel):
    id: int
    event_id: int
    code: str
    created_at: datetime
    used_count: int
    max_uses: int
    remaining_uses: int
    allow_multiple_uses_per_user: bool = False
    voided_at: datetime | None = None


class ComplimentaryCodeSummaryRead(APIModel):
    event_id: int
    used_count: int
    max_uses: int
    remaining_uses: int
    code: ComplimentaryCodeIssueRead | None = None


class ComplimentaryCreditRead(APIModel):
    id: int
    event_id: int
    dj_profile_id: int
    dj_artist_name: str | None = None
    dj_slug: str | None = None
    event_name: str | None = None
    event_starts_at: datetime | None = None
    venue_name: str | None = None
    live_session_id: int | None = None
    used_at: datetime | None = None
    used_song_request_id: int | None = None
    created_at: datetime
