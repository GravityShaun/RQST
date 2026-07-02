from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ContributionStatus, RequestStatus
from app.schemas.common import APIModel


class RequestCreate(BaseModel):
    song_id: int
    amount_cents: int = Field(ge=100)
    note: str | None = Field(default=None, max_length=240)


class ContributionCreate(BaseModel):
    amount_cents: int = Field(ge=1)


class RequestRead(APIModel):
    id: int
    session_id: int
    song_id: int
    requested_by_user_id: int
    status: RequestStatus
    original_amount_cents: int
    total_amount_cents: int
    currency: str
    note: str | None = None
    rank_snapshot: int | None = None
    confirmed_by_dj_at: datetime | None = None
    played_at: datetime | None = None
    rejected_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ContributionRead(APIModel):
    id: int
    song_request_id: int
    user_id: int
    amount_cents: int
    currency: str
    status: ContributionStatus
    payment_id: int | None = None

