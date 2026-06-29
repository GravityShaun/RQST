from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    Contribution,
    ContributionStatus,
    DJEarningsLedger,
    LedgerStatus,
    Payment,
    PaymentEvent,
    PaymentStatus,
    RequestStatus,
    SongRequest,
)
from app.payments.polar import build_checkout_url, verify_webhook_signature
from app.services.queue import apply_successful_contribution, cancel_contribution

settings = get_settings()


def calculate_fees(amount_cents: int) -> tuple[int, int, int]:
    platform_fee = round(amount_cents * settings.platform_fee_bps / 10000)
    processing_fee = round(amount_cents * 0.029) + 30
    net_amount = max(0, amount_cents - platform_fee - processing_fee)
    return platform_fee, processing_fee, net_amount


def create_payment(
    *,
    db: Session,
    user_id: int,
    dj_profile_id: int,
    session_id: int,
    song_request_id: int,
    gross_amount_cents: int,
) -> Payment:
    platform_fee, processing_fee, net_amount = calculate_fees(gross_amount_cents)
    payment = Payment(
        user_id=user_id,
        dj_profile_id=dj_profile_id,
        session_id=session_id,
        song_request_id=song_request_id,
        idempotency_key=str(uuid4()),
        gross_amount_cents=gross_amount_cents,
        platform_fee_cents=platform_fee,
        processing_fee_cents=processing_fee,
        net_amount_cents=net_amount,
        status=PaymentStatus.CHECKOUT_STARTED,
    )
    db.add(payment)
    db.flush()
    payment.checkout_url = build_checkout_url(payment.id)
    return payment


def handle_webhook(db: Session, payload: dict, signature: str | None = None) -> None:
    verify_webhook_signature(payload, signature)

    event_id = payload["event_id"]
    if db.scalar(select(PaymentEvent).where(PaymentEvent.provider_event_id == event_id)):
        return

    event = PaymentEvent(
        provider="polar",
        provider_event_id=event_id,
        event_type=payload["event_type"],
        payload_json=payload,
        processed_at=datetime.now(UTC),
    )
    db.add(event)

    payment_id = int(payload["data"]["payment_id"])
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    request = db.get(SongRequest, payment.song_request_id)
    contribution = db.scalar(select(Contribution).where(Contribution.payment_id == payment.id))
    if not request or not contribution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request contribution not found")

    match payload["event_type"]:
        case "payment.succeeded":
            payment.status = PaymentStatus.PAYMENT_SUCCEEDED
            payment.provider_payment_id = payload["data"].get("provider_payment_id")
            payment.succeeded_at = datetime.now(UTC)
            contribution.status = ContributionStatus.SUCCEEDED
            apply_successful_contribution(
                request,
                amount_cents=contribution.amount_cents,
                is_initial=request.status == RequestStatus.PENDING_PAYMENT,
            )
            ledger = DJEarningsLedger(
                dj_profile_id=payment.dj_profile_id,
                session_id=payment.session_id,
                song_request_id=payment.song_request_id,
                payment_id=payment.id,
                amount_cents=payment.net_amount_cents,
                currency=payment.currency,
                status=LedgerStatus.PENDING_CONFIRMATION,
            )
            db.add(ledger)
        case "payment.failed":
            payment.status = PaymentStatus.PAYMENT_FAILED
            payment.failed_at = datetime.now(UTC)
        case "payment.refunded":
            payment.status = PaymentStatus.PAYMENT_REFUNDED
            payment.refunded_at = datetime.now(UTC)
            contribution.status = ContributionStatus.REFUNDED
            if request.status == RequestStatus.OPEN:
                cancel_contribution(request, contribution.amount_cents)
        case "payment.disputed":
            payment.status = PaymentStatus.PAYMENT_DISPUTED
            contribution.status = ContributionStatus.DISPUTED
        case _:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported event type")

