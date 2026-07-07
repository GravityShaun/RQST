from datetime import datetime

from app.models.enums import LedgerStatus, SessionStatus
from app.schemas.common import APIModel


class EarningsSummaryRead(APIModel):
    lifetime_gross_cents: int
    lifetime_net_cents: int
    pending_confirmation_cents: int
    show_pool_cents: int
    wallet_available_cents: int
    paid_out_cents: int
    platform_fees_cents: int
    processing_fees_cents: int
    polar_connected: bool
    currency: str


class ShowEarningsRead(APIModel):
    session_id: int
    event_id: int | None = None
    event_name: str | None = None
    venue_name: str
    status: SessionStatus
    started_at: datetime | None = None
    ended_at: datetime | None = None
    gross_cents: int
    net_cents: int
    show_pool_cents: int
    wallet_cents: int
    pending_cents: int
    songs_played: int
    songs_pending: int


class LedgerEntryRead(APIModel):
    id: int
    session_id: int
    song_request_id: int
    payment_id: int
    song_title: str | None = None
    song_artist: str | None = None
    gross_amount_cents: int
    net_amount_cents: int
    amount_cents: int
    status: LedgerStatus
    venue_name: str | None = None
    event_name: str | None = None
    played_at: datetime | None = None
    available_at: datetime | None = None
    paid_out_at: datetime | None = None
    created_at: datetime


class PlayedSongEarningsRead(APIModel):
    song_request_id: int
    session_id: int
    song_title: str | None = None
    song_artist: str | None = None
    song_total_cents: int
    venue_name: str | None = None
    event_name: str | None = None
    played_at: datetime
    payout_status: str


class DjEarningsDashboardRead(APIModel):
    summary: EarningsSummaryRead
    shows: list[ShowEarningsRead]
    recent_entries: list[PlayedSongEarningsRead]


class WithdrawRequest(APIModel):
    amount_cents: int


class WithdrawResponse(APIModel):
    message: str
    polar_connected: bool
