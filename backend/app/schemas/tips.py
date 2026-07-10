from datetime import datetime

from app.models.enums import TipStatus
from app.schemas.common import APIModel


class TipCreate(APIModel):
    amount_cents: int


class TipRead(APIModel):
    id: int
    session_id: int
    dj_profile_id: int
    user_id: int
    sender_display_name: str
    sender_avatar_url: str | None = None
    dj_artist_name: str | None = None
    venue_name: str | None = None
    amount_cents: int
    currency: str
    status: TipStatus
    payment_id: int | None = None
    checkout_url: str | None = None
    thanked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ListenerProfileRead(APIModel):
    id: int
    display_name: str
    avatar_url: str | None = None
    handle: str
    role: str
    requests_made: int
    songs_supported: int
    tips_sent: int
    tips_sent_cents: int
    total_spent_cents: int
    member_since: datetime
    is_email_verified: bool
