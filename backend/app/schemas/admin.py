from datetime import datetime

from pydantic import Field

from app.models.enums import PaymentStatus, SessionStatus, UserRole
from app.schemas.common import APIModel


class AdminPaymentsOverview(APIModel):
    total_gross_cents: int
    total_net_cents: int
    total_platform_fees_cents: int
    total_refunded_cents: int
    succeeded_count: int
    pending_count: int
    failed_count: int
    disputed_count: int
    currency: str


class AdminOverview(APIModel):
    total_users: int
    active_users: int
    total_djs: int
    live_sessions: int
    open_reports: int
    payments_overview: AdminPaymentsOverview


class AdminUserSummary(APIModel):
    id: int
    email: str
    display_name: str
    role: UserRole
    is_email_verified: bool
    deleted_at: datetime | None = None
    created_at: datetime
    request_count: int = 0
    payment_total_cents: int = 0


class AdminUserUpdate(APIModel):
    role: UserRole | None = None
    is_email_verified: bool | None = None
    display_name: str | None = Field(default=None, max_length=120)


class AdminPaymentSummary(APIModel):
    id: int
    user_id: int
    user_email: str
    user_display_name: str
    dj_profile_id: int
    dj_artist_name: str | None = None
    session_id: int
    song_request_id: int
    gross_amount_cents: int
    net_amount_cents: int
    platform_fee_cents: int
    processing_fee_cents: int
    currency: str
    status: PaymentStatus
    provider: str
    provider_payment_id: str | None = None
    succeeded_at: datetime | None = None
    refunded_at: datetime | None = None
    created_at: datetime
    song_title: str | None = None
    song_artist: str | None = None


class AdminPaymentActionRequest(APIModel):
    reason: str | None = Field(default=None, max_length=500)


class AdminDjSummary(APIModel):
    id: int
    user_id: int
    artist_name: str
    slug: str
    city: str | None = None
    is_public: bool
    user_email: str
    live_session_id: int | None = None
    total_earnings_cents: int = 0
    session_count: int = 0
    created_at: datetime


class AdminReportSummary(APIModel):
    id: int
    reporter_user_id: int
    reporter_display_name: str
    target_type: str
    target_id: int
    reason: str
    status: str
    created_at: datetime


class AdminSessionSummary(APIModel):
    id: int
    dj_profile_id: int
    dj_artist_name: str
    venue_name: str
    event_name: str | None = None
    status: SessionStatus
    accepting_requests: bool
    minimum_request_amount_cents: int
    started_at: datetime | None = None
    ended_at: datetime | None = None
    request_count: int = 0
    gross_payments_cents: int = 0


class AdminSessionUpdate(APIModel):
    accepting_requests: bool | None = None
    minimum_request_amount_cents: int | None = Field(default=None, ge=100)
