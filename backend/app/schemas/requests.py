from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ContributionStatus, RequestStatus
from app.schemas.common import APIModel


class RequestSongCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    artist: str = Field(min_length=1, max_length=255)
    album: str | None = Field(default=None, max_length=255)
    duration_ms: int | None = Field(default=None, ge=1)
    album_art_url: str | None = Field(default=None, max_length=500)
    isrc: str | None = Field(default=None, max_length=32)
    external_source: str | None = Field(default=None, max_length=64)
    external_id: str | None = Field(default=None, max_length=128)
    explicit: bool = False


class RequestCreate(BaseModel):
    song_id: int | None = None
    amount_cents: int = Field(ge=100)
    shoutout_amount_cents: int = Field(default=0, ge=0)
    play_deadline_minutes: int | None = Field(default=None)
    play_deadline_amount_cents: int = Field(default=0, ge=0)
    note: str | None = Field(default=None, max_length=240)
    use_complimentary: bool = False
    song: RequestSongCreate | None = None

    @model_validator(mode="after")
    def validate_addons(self) -> RequestCreate:
        if self.use_complimentary:
            from app.services.complimentary import (
                MAX_COMPLIMENTARY_SHOUTOUT_AMOUNT_CENTS,
                MAX_COMPLIMENTARY_SONG_AMOUNT_CENTS,
            )

            if self.amount_cents > MAX_COMPLIMENTARY_SONG_AMOUNT_CENTS:
                raise ValueError("Complimentary song amount cannot exceed $50")
            if self.play_deadline_minutes is not None or self.play_deadline_amount_cents > 0:
                raise ValueError("Complimentary songs cannot include a play deadline")
            if self.shoutout_amount_cents > MAX_COMPLIMENTARY_SHOUTOUT_AMOUNT_CENTS:
                raise ValueError("Complimentary shoutout amount cannot exceed $20")
            if self.shoutout_amount_cents > 0:
                if not self.note or not self.note.strip():
                    raise ValueError("Shoutout message is required when shoutout amount is provided")
            elif self.note:
                raise ValueError("Shoutout amount is required when a shoutout message is provided")
            return self

        if self.shoutout_amount_cents > 0:
            if not self.note or not self.note.strip():
                raise ValueError("Shoutout message is required when shoutout amount is provided")
        elif self.note:
            raise ValueError("Shoutout amount is required when a shoutout message is provided")

        from app.services.deadlines import validate_play_deadline

        validate_play_deadline(self.play_deadline_minutes, self.play_deadline_amount_cents)
        return self


class ContributionCreate(BaseModel):
    amount_cents: int = Field(ge=1)


class RequestContributorRead(APIModel):
    id: int
    user_id: int
    display_name: str
    avatar_url: str | None = None
    amount_cents: int
    currency: str
    is_initial: bool = False
    status: ContributionStatus
    created_at: datetime


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
    shoutout_amount_cents: int = 0
    shoutout_fulfilled: bool | None = None
    play_deadline_minutes: int | None = None
    play_deadline_amount_cents: int = 0
    play_deadline_expires_at: datetime | None = None
    play_deadline_remaining_seconds: int | None = None
    play_deadline_elapsed_seconds: int | None = None
    expired_at: datetime | None = None
    rank_snapshot: int | None = None
    confirmed_by_dj_at: datetime | None = None
    played_at: datetime | None = None
    rejected_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    song_title: str | None = None
    song_artist: str | None = None
    song_album: str | None = None
    song_album_art_url: str | None = None
    dj_profile_id: int | None = None
    dj_artist_name: str | None = None
    venue_id: int | None = None
    venue_name: str | None = None
    event_id: int | None = None
    event_name: str | None = None
    requester_display_name: str | None = None
    requester_avatar_url: str | None = None
    my_contribution_cents: int = 0
    my_original_contribution_cents: int = 0
    my_added_contribution_cents: int = 0
    total_pool_cents: int = 0
    pool_original_cents: int = 0
    added_amount_cents: int = 0
    my_added_contributions: list[RequestContributorRead] = Field(default_factory=list)
    contributor_count: int = 0
    latest_payment_id: int | None = None
    latest_payment_status: str | None = None
    checkout_url: str | None = None
    contributors: list[RequestContributorRead] = Field(default_factory=list)
    is_complimentary: bool = False


class MarkPlayedRequest(BaseModel):
    include_shoutout: bool = False


class ContributionRead(APIModel):
    id: int
    song_request_id: int
    user_id: int
    amount_cents: int
    currency: str
    status: ContributionStatus
    payment_id: int | None = None
