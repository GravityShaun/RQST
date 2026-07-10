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
from app.services.queue import apply_successful_contribution, cancel_contribution, set_play_deadline_expiry
from app.realtime.queue import schedule_session_queue_broadcast
settings = get_settings()


def should_auto_complete_payments() -> bool:
    current_settings = get_settings()
    return current_settings.environment == "local" and current_settings.auto_complete_payments


def complete_successful_payment(
    db: Session,
    *,
    payment: Payment | None,
    contribution: Contribution,
    request: SongRequest,
    provider_payment_id: str | None = None,
    is_complimentary: bool = False,
) -> None:
    if payment is not None:
        payment.status = PaymentStatus.PAYMENT_SUCCEEDED
        payment.provider_payment_id = provider_payment_id
        payment.succeeded_at = datetime.now(UTC)
    contribution.status = ContributionStatus.SUCCEEDED
    is_initial = request.status == RequestStatus.PENDING_PAYMENT
    apply_successful_contribution(
        request,
        amount_cents=contribution.amount_cents,
        is_initial=is_initial,
    )
    if is_initial and request.play_deadline_minutes:
        set_play_deadline_expiry(request)
    if payment is not None and not is_complimentary and not request.is_complimentary:
        deadline_amount_cents = request.play_deadline_amount_cents or 0
        dj_gross = max(0, payment.gross_amount_cents - deadline_amount_cents)
        _, _, dj_net = calculate_fees(dj_gross)
        ledger_amount = dj_net if deadline_amount_cents > 0 else payment.net_amount_cents
        db.add(
            DJEarningsLedger(
                dj_profile_id=payment.dj_profile_id,
                session_id=payment.session_id,
                song_request_id=payment.song_request_id,
                payment_id=payment.id,
                amount_cents=ledger_amount,
                currency=payment.currency,
                status=LedgerStatus.PENDING_CONFIRMATION,
            )
        )
    schedule_session_queue_broadcast(request.session_id)


def maybe_auto_complete_payment(
    db: Session,
    *,
    payment: Payment,
    contribution: Contribution,
    request: SongRequest,
) -> None:
    if not should_auto_complete_payments():
        return
    complete_successful_payment(db, payment=payment, contribution=contribution, request=request)


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
    gross_amount_cents: int,
    song_request_id: int | None = None,
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
    from app.models import Tip, TipStatus
    from app.services.tips import complete_successful_tip_payment

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

    tip = db.scalar(select(Tip).where(Tip.payment_id == payment.id))
    if tip is not None:
        match payload["event_type"]:
            case "payment.succeeded":
                complete_successful_tip_payment(
                    db,
                    payment=payment,
                    tip=tip,
                    provider_payment_id=payload["data"].get("provider_payment_id"),
                )
            case "payment.failed":
                payment.status = PaymentStatus.PAYMENT_FAILED
                payment.failed_at = datetime.now(UTC)
                tip.status = TipStatus.CANCELLED
            case "payment.refunded":
                payment.status = PaymentStatus.PAYMENT_REFUNDED
                payment.refunded_at = datetime.now(UTC)
                tip.status = TipStatus.REFUNDED
            case "payment.disputed":
                payment.status = PaymentStatus.PAYMENT_DISPUTED
            case _:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported event type")
        return

    if payment.song_request_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request contribution not found")

    request = db.get(SongRequest, payment.song_request_id)
    contribution = db.scalar(select(Contribution).where(Contribution.payment_id == payment.id))
    if not request or not contribution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request contribution not found")

    match payload["event_type"]:
        case "payment.succeeded":
            complete_successful_payment(
                db,
                payment=payment,
                contribution=contribution,
                request=request,
                provider_payment_id=payload["data"].get("provider_payment_id"),
            )
        case "payment.failed":
            payment.status = PaymentStatus.PAYMENT_FAILED
            payment.failed_at = datetime.now(UTC)
        case "payment.refunded":
            payment.status = PaymentStatus.PAYMENT_REFUNDED
            payment.refunded_at = datetime.now(UTC)
            contribution.status = ContributionStatus.REFUNDED
            if request.status == RequestStatus.OPEN:
                cancel_contribution(request, contribution.amount_cents)
                schedule_session_queue_broadcast(request.session_id)
        case "payment.disputed":
            payment.status = PaymentStatus.PAYMENT_DISPUTED
            contribution.status = ContributionStatus.DISPUTED
        case _:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported event type")

