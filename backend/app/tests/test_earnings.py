from datetime import UTC, datetime
from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base

from app.models import (
    Contribution,
    ContributionStatus,
    DJEarningsLedger,
    DJProfile,
    DJSession,
    LedgerStatus,
    Payment,
    PaymentStatus,
    RequestStatus,
    SessionStatus,
    Song,
    SongRequest,
    User,
    UserRole,
    Venue,
)
from app.services.earnings import (
    build_earnings_dashboard,
    credit_ledger_for_played_request,
    settle_session_earnings,
)
from app.services.payments import complete_successful_payment
from app.services.queue import confirm_request, mark_request_played


@pytest.fixture()
def db_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    db = testing_session_local()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _seed_payment_flow(db: Session) -> tuple[DJProfile, DJSession, SongRequest, Payment]:
    user = User(
        email="earnings-listener@example.com",
        password_hash="hash",
        display_name="Listener",
        role=UserRole.LISTENER,
    )
    dj_user = User(
        email="earnings-dj@example.com",
        password_hash="hash",
        display_name="Earnings DJ",
        role=UserRole.DJ,
    )
    db.add_all([user, dj_user])
    db.flush()

    profile = DJProfile(user_id=dj_user.id, artist_name="Earnings DJ", slug="earnings-dj")
    venue = Venue(name="Club Test", address="1 Main", city="NYC")
    db.add_all([profile, venue])
    db.flush()

    session = DJSession(
        dj_profile_id=profile.id,
        venue_id=venue.id,
        status=SessionStatus.LIVE,
        started_at=datetime.now(UTC),
    )
    song = Song(title="Test Track", artist="Test Artist")
    db.add_all([session, song])
    db.flush()

    request = SongRequest(
        session_id=session.id,
        song_id=song.id,
        requested_by_user_id=user.id,
        status=RequestStatus.OPEN,
        original_amount_cents=1000,
        total_amount_cents=1000,
    )
    db.add(request)
    db.flush()

    payment = Payment(
        user_id=user.id,
        dj_profile_id=profile.id,
        session_id=session.id,
        song_request_id=request.id,
        idempotency_key="earnings-test-key",
        gross_amount_cents=1000,
        platform_fee_cents=100,
        processing_fee_cents=59,
        net_amount_cents=841,
        status=PaymentStatus.CHECKOUT_STARTED,
    )
    db.add(payment)
    db.flush()

    contribution = Contribution(
        song_request_id=request.id,
        user_id=user.id,
        amount_cents=1000,
        is_initial=True,
        status=ContributionStatus.PENDING_PAYMENT,
        payment_id=payment.id,
    )
    db.add(contribution)
    db.flush()

    complete_successful_payment(db, payment=payment, contribution=contribution, request=request)
    db.commit()
    return profile, session, request, payment


def test_play_moves_ledger_into_show_pool(db_session: Session) -> None:
    profile, _session, request, _payment = _seed_payment_flow(db_session)

    confirm_request(request)
    mark_request_played(request)
    credit_ledger_for_played_request(db_session, request.id)
    db_session.commit()

    dashboard = build_earnings_dashboard(db_session, profile.id)
    assert dashboard.summary.pending_confirmation_cents == 0
    assert dashboard.summary.show_pool_cents == 841
    assert dashboard.summary.wallet_available_cents == 0


def test_session_end_moves_show_pool_to_wallet(db_session: Session) -> None:
    profile, session, request, _payment = _seed_payment_flow(db_session)

    confirm_request(request)
    mark_request_played(request)
    credit_ledger_for_played_request(db_session, request.id)
    session.status = SessionStatus.ENDED
    session.ended_at = datetime.now(UTC)
    settle_session_earnings(db_session, session.id)
    db_session.commit()

    dashboard = build_earnings_dashboard(db_session, profile.id)
    assert dashboard.summary.show_pool_cents == 0
    assert dashboard.summary.wallet_available_cents == 841


def test_unplayed_payment_stays_pending(db_session: Session) -> None:
    profile, _session, _request, _payment = _seed_payment_flow(db_session)

    dashboard = build_earnings_dashboard(db_session, profile.id)
    assert dashboard.summary.pending_confirmation_cents == 841
    assert dashboard.summary.show_pool_cents == 0
    assert dashboard.recent_entries == []


def test_recent_entries_only_include_played_songs_with_total_amount(db_session: Session) -> None:
    profile, _session, request, _payment = _seed_payment_flow(db_session)

    confirm_request(request)
    mark_request_played(request)
    credit_ledger_for_played_request(db_session, request.id)
    db_session.commit()

    dashboard = build_earnings_dashboard(db_session, profile.id)
    assert len(dashboard.recent_entries) == 1
    entry = dashboard.recent_entries[0]
    assert entry.song_request_id == request.id
    assert entry.song_total_cents == request.total_amount_cents
    assert entry.played_at is not None
    assert entry.payout_status == "show_pool"
