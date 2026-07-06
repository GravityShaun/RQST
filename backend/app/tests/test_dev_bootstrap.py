from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models import DJProfile, DJSession, SessionStatus, User, UserRole, Venue
from app.schemas.auth import RegisterRequest
from app.services.auth import register_user
from app.services.dev_bootstrap import CONSOLE_DJ_EMAIL, ensure_local_demo_session


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


def test_ensure_local_demo_session_creates_live_session(db_session: Session, monkeypatch) -> None:
    monkeypatch.setenv("RQST_ENVIRONMENT", "local")

    from app.core.config import get_settings

    get_settings.cache_clear()

    register_user(
        db_session,
        RegisterRequest(
            email="demo-dj@example.com",
            password="password123",
            display_name="Demo DJ",
            role=UserRole.DJ,
        ),
    )
    db_session.add(Venue(name="Harbor Room", address="1 Wharf", city="Charleston", state="SC"))
    db_session.commit()

    session = ensure_local_demo_session(db_session)

    assert session is not None
    assert session.status == SessionStatus.LIVE
    assert session.minimum_request_amount_cents == 700
    assert session.accepting_requests is True

    venue = db_session.get(Venue, session.venue_id)
    assert venue is not None

    profiles = list(db_session.scalars(select(DJProfile)))
    assert len(profiles) >= 1

    again = ensure_local_demo_session(db_session)
    assert again is not None
    assert again.id == session.id

    console_dj = db_session.scalar(select(User).where(User.email == CONSOLE_DJ_EMAIL))
    assert console_dj is not None
    assert console_dj.role == UserRole.DJ


def test_ensure_local_demo_session_skips_without_registered_dj(db_session: Session, monkeypatch) -> None:
    monkeypatch.setenv("RQST_ENVIRONMENT", "local")

    from app.core.config import get_settings

    get_settings.cache_clear()

    assert ensure_local_demo_session(db_session) is None


def test_ensure_local_demo_session_skips_outside_local(db_session: Session, monkeypatch) -> None:
    monkeypatch.setenv("RQST_ENVIRONMENT", "production")

    from app.core.config import get_settings

    get_settings.cache_clear()

    assert ensure_local_demo_session(db_session) is None
