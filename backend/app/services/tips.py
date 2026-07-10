from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import (
    Contribution,
    ContributionStatus,
    DJEarningsLedger,
    DJProfile,
    DJSession,
    LedgerStatus,
    Notification,
    Payment,
    PaymentStatus,
    SessionStatus,
    Tip,
    TipStatus,
    User,
    Venue,
)
from app.realtime.manager import manager
from app.realtime.queue import session_queue_channel
from app.schemas.tips import ListenerProfileRead, TipRead
from app.services.payments import create_payment, should_auto_complete_payments


def serialize_tip(db: Session, tip: Tip) -> TipRead:
    sender = db.get(User, tip.user_id)
    payment = db.get(Payment, tip.payment_id) if tip.payment_id else None
    dj_profile = db.get(DJProfile, tip.dj_profile_id)
    session = db.get(DJSession, tip.session_id)
    venue = db.get(Venue, session.venue_id) if session and session.venue_id else None
    return TipRead(
        id=tip.id,
        session_id=tip.session_id,
        dj_profile_id=tip.dj_profile_id,
        user_id=tip.user_id,
        sender_display_name=sender.display_name if sender else "RQST listener",
        sender_avatar_url=sender.avatar_url if sender else None,
        dj_artist_name=dj_profile.artist_name if dj_profile else None,
        venue_name=venue.name if venue else None,
        amount_cents=tip.amount_cents,
        currency=tip.currency,
        status=tip.status,
        payment_id=tip.payment_id,
        checkout_url=payment.checkout_url if payment else None,
        thanked_at=tip.thanked_at,
        created_at=tip.created_at,
        updated_at=tip.updated_at,
    )


def build_listener_profile(db: Session, user_id: int) -> ListenerProfileRead:
    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listener not found")

    requests_made = (
        db.scalar(
            select(func.count())
            .select_from(Contribution)
            .where(
                Contribution.user_id == user_id,
                Contribution.is_initial.is_(True),
                Contribution.status == ContributionStatus.SUCCEEDED,
            )
        )
        or 0
    )
    songs_supported = (
        db.scalar(
            select(func.count(func.distinct(Contribution.song_request_id))).where(
                Contribution.user_id == user_id,
                Contribution.status == ContributionStatus.SUCCEEDED,
            )
        )
        or 0
    )
    tip_rows = list(
        db.scalars(
            select(Tip).where(
                Tip.user_id == user_id,
                Tip.status.in_((TipStatus.SUCCEEDED, TipStatus.THANKED)),
            )
        )
    )
    tips_sent = len(tip_rows)
    tips_sent_cents = sum(tip.amount_cents for tip in tip_rows)
    contribution_spent = (
        db.scalar(
            select(func.coalesce(func.sum(Contribution.amount_cents), 0)).where(
                Contribution.user_id == user_id,
                Contribution.status == ContributionStatus.SUCCEEDED,
            )
        )
        or 0
    )
    handle_base = "".join(ch for ch in user.display_name.lower() if ch.isalnum()) or "rqst"

    return ListenerProfileRead(
        id=user.id,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        handle=f"@{handle_base}",
        role=str(user.role),
        requests_made=int(requests_made),
        songs_supported=int(songs_supported),
        tips_sent=tips_sent,
        tips_sent_cents=tips_sent_cents,
        total_spent_cents=int(contribution_spent) + tips_sent_cents,
        member_since=user.created_at,
        is_email_verified=bool(user.is_email_verified),
    )


def complete_successful_tip_payment(
    db: Session,
    *,
    payment: Payment,
    tip: Tip,
    provider_payment_id: str | None = None,
) -> None:
    payment.status = PaymentStatus.PAYMENT_SUCCEEDED
    payment.provider_payment_id = provider_payment_id
    payment.succeeded_at = datetime.now(UTC)
    tip.status = TipStatus.SUCCEEDED
    tip.payment_id = payment.id
    db.add(
        DJEarningsLedger(
            dj_profile_id=payment.dj_profile_id,
            session_id=payment.session_id,
            song_request_id=None,
            tip_id=tip.id,
            payment_id=payment.id,
            amount_cents=payment.net_amount_cents,
            currency=payment.currency,
            status=LedgerStatus.AVAILABLE,
        )
    )
    schedule_session_tips_broadcast(payment.session_id)


def maybe_auto_complete_tip_payment(db: Session, *, payment: Payment, tip: Tip) -> None:
    if not should_auto_complete_payments():
        return
    complete_successful_tip_payment(db, payment=payment, tip=tip)


def create_session_tip(
    db: Session,
    *,
    session_id: int,
    user: User,
    amount_cents: int,
) -> Tip:
    if amount_cents <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tip amount must be positive")

    session = db.get(DJSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.status != SessionStatus.LIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not live")

    tip = Tip(
        session_id=session.id,
        dj_profile_id=session.dj_profile_id,
        user_id=user.id,
        amount_cents=amount_cents,
        status=TipStatus.PENDING_PAYMENT,
    )
    db.add(tip)
    db.flush()

    payment = create_payment(
        db=db,
        user_id=user.id,
        dj_profile_id=session.dj_profile_id,
        session_id=session.id,
        gross_amount_cents=amount_cents,
        song_request_id=None,
    )
    tip.payment_id = payment.id
    maybe_auto_complete_tip_payment(db, payment=payment, tip=tip)
    db.flush()
    schedule_session_tips_broadcast(session.id)
    return tip


def list_open_session_tips(db: Session, session_id: int) -> list[Tip]:
    return list(
        db.scalars(
            select(Tip)
            .where(
                Tip.session_id == session_id,
                Tip.status == TipStatus.SUCCEEDED,
            )
            .order_by(Tip.created_at.desc())
        )
    )


def list_current_dj_tips(db: Session, dj_profile_id: int, session_id: int) -> list[Tip]:
    return list(
        db.scalars(
            select(Tip)
            .where(
                Tip.dj_profile_id == dj_profile_id,
                Tip.session_id == session_id,
                Tip.status == TipStatus.SUCCEEDED,
            )
            .order_by(Tip.created_at.desc())
        )
    )


def list_thanked_dj_tips(db: Session, dj_profile_id: int, session_id: int) -> list[Tip]:
    return list(
        db.scalars(
            select(Tip)
            .where(
                Tip.dj_profile_id == dj_profile_id,
                Tip.session_id == session_id,
                Tip.status == TipStatus.THANKED,
            )
            .order_by(Tip.thanked_at.desc(), Tip.created_at.desc())
        )
    )


def list_my_tips(db: Session, user_id: int) -> list[Tip]:
    return list(
        db.scalars(
            select(Tip)
            .where(
                Tip.user_id == user_id,
                Tip.status.in_((TipStatus.SUCCEEDED, TipStatus.THANKED)),
            )
            .order_by(Tip.created_at.desc(), Tip.id.desc())
        )
    )


def thank_tip(db: Session, *, tip_id: int, dj_user: User) -> Tip:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == dj_user.id))
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DJ profile not found")

    tip = db.get(Tip, tip_id)
    if not tip or tip.dj_profile_id != profile.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tip not found")
    if tip.status != TipStatus.SUCCEEDED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tip cannot be thanked")

    tip.status = TipStatus.THANKED
    tip.thanked_at = datetime.now(UTC)
    db.add(
        Notification(
            user_id=tip.user_id,
            type="tip.thanked",
            title="Thank you",
            body="The DJ sent you a thank you for your tip.",
            data_json={"tip_id": tip.id, "session_id": tip.session_id, "dj_profile_id": tip.dj_profile_id},
        )
    )
    db.flush()
    schedule_tip_thanked_broadcast(tip)
    schedule_session_tips_broadcast(tip.session_id)
    return tip


async def broadcast_session_tips(session_id: int) -> None:
    with SessionLocal() as db:
        tips = list_open_session_tips(db, session_id)
        payload = {
            "type": "tips.updated",
            "session_id": session_id,
            "tips": [serialize_tip(db, tip).model_dump(mode="json") for tip in tips],
        }
        await manager.broadcast(session_queue_channel(session_id), payload)


async def broadcast_tip_thanked(tip: Tip) -> None:
    payload = {
        "type": "tip.thanked",
        "session_id": tip.session_id,
        "tip_id": tip.id,
        "user_id": tip.user_id,
    }
    await manager.broadcast(session_queue_channel(tip.session_id), payload)


def schedule_session_tips_broadcast(session_id: int) -> None:
    from app.realtime.queue import _main_loop

    if _main_loop is None:
        return
    asyncio.run_coroutine_threadsafe(broadcast_session_tips(session_id), _main_loop)


def schedule_tip_thanked_broadcast(tip: Tip) -> None:
    from app.realtime.queue import _main_loop

    if _main_loop is None:
        return
    asyncio.run_coroutine_threadsafe(broadcast_tip_thanked(tip), _main_loop)
