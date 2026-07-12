from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    Contribution,
    ContributionStatus,
    DJProfile,
    DJSession,
    Payment,
    PaymentStatus,
    SessionStatus,
    SongRequest,
    User,
    UserRole,
    Venue,
)
from app.core.security import hash_password
from app.services.payments import complete_successful_payment, should_auto_complete_payments

CONSOLE_DJ_EMAIL = "dj-console@example.com"
CONSOLE_DJ_PASSWORD = "rqst-dj-console"
CONSOLE_ADMIN_EMAIL = "admin-console@example.com"
CONSOLE_ADMIN_PASSWORD = "rqst-admin-console"


def ensure_admin_user(db: Session) -> User | None:
    settings = get_settings()
    if settings.environment != "local":
        return None

    user = db.scalar(select(User).where(User.email == CONSOLE_ADMIN_EMAIL))
    if user:
        return user

    user = User(
        email=CONSOLE_ADMIN_EMAIL,
        password_hash=hash_password(CONSOLE_ADMIN_PASSWORD),
        display_name="RQST Admin",
        role=UserRole.ADMIN,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def ensure_console_dj_user(db: Session) -> User | None:
    settings = get_settings()
    if settings.environment != "local":
        return None

    user = db.scalar(select(User).where(User.email == CONSOLE_DJ_EMAIL))
    if user:
        return user

    user = User(
        email=CONSOLE_DJ_EMAIL,
        password_hash=hash_password(CONSOLE_DJ_PASSWORD),
        display_name="RQST Console",
        role=UserRole.DJ,
    )
    db.add(user)
    db.flush()
    return user


def ensure_local_demo_session(db: Session) -> DJSession | None:
    settings = get_settings()
    if settings.environment != "local":
        return None

    ensure_console_dj_user(db)

    live_session = db.scalar(
        select(DJSession).where(DJSession.status == SessionStatus.LIVE).order_by(DJSession.id.asc())
    )
    if live_session:
        return live_session

    profile = db.scalar(select(DJProfile).order_by(DJProfile.id.asc()))
    if not profile:
        return None

    venue = db.scalar(select(Venue).order_by(Venue.id.asc()))
    if not venue:
        return None

    session = DJSession(
        dj_profile_id=profile.id,
        venue_id=venue.id,
        status=SessionStatus.LIVE,
        minimum_request_amount_cents=700,
        accepting_requests=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


LOCAL_DISCOVER_VENUES = [
    {
        "name": "Moonlight Room",
        "address": "1 Dance Floor",
        "city": "Brooklyn",
        "state": "NY",
        "country": "US",
    },
    {
        "name": "King Street Social",
        "address": "155 King St",
        "city": "Charleston",
        "state": "SC",
        "country": "US",
    },
]


def ensure_local_discover_directory(db: Session) -> list[Venue]:
    settings = get_settings()
    if settings.environment != "local":
        return []

    venues: list[Venue] = []
    for spec in LOCAL_DISCOVER_VENUES:
        venue = db.scalar(select(Venue).where(Venue.name == spec["name"]))
        if not venue:
            venue = Venue(**spec)
            db.add(venue)
        venues.append(venue)

    db.commit()
    for venue in venues:
        db.refresh(venue)
    return venues


def reconcile_local_pending_payments(db: Session) -> None:
    if not should_auto_complete_payments():
        return

    pending_contributions = list(
        db.scalars(select(Contribution).where(Contribution.status == ContributionStatus.PENDING_PAYMENT))
    )
    if not pending_contributions:
        return

    for contribution in pending_contributions:
        payment = db.get(Payment, contribution.payment_id) if contribution.payment_id else None
        request = db.get(SongRequest, contribution.song_request_id)
        if not payment or not request or payment.status == PaymentStatus.PAYMENT_SUCCEEDED:
            continue
        complete_successful_payment(db, payment=payment, contribution=contribution, request=request)

    db.commit()
