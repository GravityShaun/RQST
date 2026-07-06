from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import (
    ContributionStatus,
    LedgerStatus,
    PaymentStatus,
    RequestStatus,
    SessionStatus,
    UserRole,
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120))
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[UserRole] = mapped_column(String(32), default=UserRole.LISTENER)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DJProfile(Base, TimestampMixin):
    __tablename__ = "dj_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    artist_name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    genres_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    website_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    instagram_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tiktok_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    youtube_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    spotify_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    soundcloud_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    booking_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)


class Venue(Base, TimestampMixin):
    __tablename__ = "venues"
    __table_args__ = (Index("ix_venues_lat_lng", "latitude", "longitude"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    country: Mapped[str] = mapped_column(String(120), default="US")
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    place_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    dj_profile_id: Mapped[int] = mapped_column(ForeignKey("dj_profiles.id"), index=True)
    venue_id: Mapped[int] = mapped_column(ForeignKey("venues.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ticket_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    flyer_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class DJSession(Base, TimestampMixin):
    __tablename__ = "dj_sessions"
    __table_args__ = (Index("ix_dj_sessions_status_venue", "status", "venue_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    dj_profile_id: Mapped[int] = mapped_column(ForeignKey("dj_profiles.id"), index=True)
    venue_id: Mapped[int] = mapped_column(ForeignKey("venues.id"), index=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), nullable=True)
    status: Mapped[SessionStatus] = mapped_column(String(32), default=SessionStatus.NOT_STARTED)
    minimum_request_amount_cents: Mapped[int] = mapped_column(Integer, default=500)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    accepting_requests: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_explicit: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_any_song: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Song(Base, TimestampMixin):
    __tablename__ = "songs"
    __table_args__ = (
        UniqueConstraint("external_source", "external_id", name="uq_songs_external"),
        Index("ix_songs_title_artist", "title", "artist"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    artist: Mapped[str] = mapped_column(String(255))
    album: Mapped[str | None] = mapped_column(String(255), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    album_art_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    isrc: Mapped[str | None] = mapped_column(String(32), nullable=True)
    external_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    explicit: Mapped[bool] = mapped_column(Boolean, default=False)


class SongRequest(Base, TimestampMixin):
    __tablename__ = "song_requests"
    __table_args__ = (
        Index("ix_song_requests_session_status_amount", "session_id", "status", "total_amount_cents"),
        UniqueConstraint("session_id", "song_id", name="uq_song_request_per_song_session"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("dj_sessions.id"), index=True)
    song_id: Mapped[int] = mapped_column(ForeignKey("songs.id"), index=True)
    requested_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[RequestStatus] = mapped_column(String(32), default=RequestStatus.PENDING_PAYMENT)
    original_amount_cents: Mapped[int] = mapped_column(Integer)
    total_amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rank_snapshot: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confirmed_by_dj_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    song: Mapped[Song] = relationship()


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"
    __table_args__ = (Index("ix_payments_provider_payment_id", "provider_payment_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    dj_profile_id: Mapped[int] = mapped_column(ForeignKey("dj_profiles.id"), index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("dj_sessions.id"), index=True)
    song_request_id: Mapped[int] = mapped_column(ForeignKey("song_requests.id"), index=True)
    provider: Mapped[str] = mapped_column(String(64), default="polar")
    provider_checkout_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True)
    gross_amount_cents: Mapped[int] = mapped_column(Integer)
    platform_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    processing_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    net_amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[PaymentStatus] = mapped_column(String(32), default=PaymentStatus.PAYMENT_CREATED)
    checkout_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    succeeded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Contribution(Base, TimestampMixin):
    __tablename__ = "contributions"

    id: Mapped[int] = mapped_column(primary_key=True)
    song_request_id: Mapped[int] = mapped_column(ForeignKey("song_requests.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    is_initial: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[ContributionStatus] = mapped_column(
        String(32), default=ContributionStatus.PENDING_PAYMENT
    )
    payment_id: Mapped[int | None] = mapped_column(ForeignKey("payments.id"), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PaymentEvent(Base):
    __tablename__ = "payment_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(64))
    provider_event_id: Mapped[str] = mapped_column(String(255), unique=True)
    event_type: Mapped[str] = mapped_column(String(120))
    payload_json: Mapped[dict] = mapped_column(JSON)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DJEarningsLedger(Base):
    __tablename__ = "dj_earnings_ledger"

    id: Mapped[int] = mapped_column(primary_key=True)
    dj_profile_id: Mapped[int] = mapped_column(ForeignKey("dj_profiles.id"), index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("dj_sessions.id"), index=True)
    song_request_id: Mapped[int] = mapped_column(ForeignKey("song_requests.id"), index=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"), index=True)
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[LedgerStatus] = mapped_column(String(32), default=LedgerStatus.PENDING_CONFIRMATION)
    available_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    data_json: Mapped[dict] = mapped_column(JSON, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DeviceToken(Base, TimestampMixin):
    __tablename__ = "device_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String(32))
    token: Mapped[str] = mapped_column(String(255))


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_type: Mapped[str] = mapped_column(String(64))
    target_id: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="open")

