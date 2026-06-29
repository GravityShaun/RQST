from datetime import datetime

from pydantic import BaseModel

from app.models.enums import PaymentStatus
from app.schemas.common import APIModel


class CheckoutRequest(BaseModel):
    song_request_id: int
    amount_cents: int


class CheckoutResponse(APIModel):
    payment_id: int
    checkout_url: str
    status: PaymentStatus


class PaymentRead(APIModel):
    id: int
    user_id: int
    dj_profile_id: int
    session_id: int
    song_request_id: int
    provider: str
    idempotency_key: str
    gross_amount_cents: int
    platform_fee_cents: int
    processing_fee_cents: int
    net_amount_cents: int
    currency: str
    status: PaymentStatus
    checkout_url: str | None = None
    created_at: datetime
    updated_at: datetime


class PolarWebhookPayload(BaseModel):
    event_id: str
    event_type: str
    data: dict

