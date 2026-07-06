from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.main import app
from app.models import DJProfile, DJSession, Event, SessionStatus, User, UserRole, Venue
from app.schemas.auth import RegisterRequest
from app.services.auth import register_user


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


@pytest.fixture()
def client(db_session: Session) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _seed_registered_dj(db_session: Session, *, email: str, display_name: str, slug: str) -> DJProfile:
    user = register_user(
        db_session,
        RegisterRequest(
            email=email,
            password="password123",
            display_name=display_name,
            role=UserRole.DJ,
        ),
    )
    profile = db_session.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    assert profile is not None
    profile.slug = slug
    profile.artist_name = display_name
    db_session.commit()
    db_session.refresh(profile)
    return profile


def test_list_djs_returns_registered_profiles_only(client: TestClient, db_session: Session) -> None:
    _seed_registered_dj(db_session, email="shaun@example.com", display_name="Dj Shaun", slug="dj-shaun")

    response = client.get("/api/v1/djs")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["artist_name"] == "Dj Shaun"
    assert payload[0]["is_live"] is False


def test_search_djs_filters_by_display_name(client: TestClient, db_session: Session) -> None:
    _seed_registered_dj(db_session, email="shaun-search@example.com", display_name="dj shaun", slug="dj-shaun-search")

    response = client.get("/api/v1/djs", params={"q": "shaun"})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["artist_name"] == "dj shaun"


def test_list_djs_marks_live_dj(client: TestClient, db_session: Session) -> None:
    profile = _seed_registered_dj(db_session, email="live@example.com", display_name="Live DJ", slug="live-dj")
    venue = Venue(name="Harbor Room", address="1 Wharf", city="Charleston", state="SC")
    db_session.add(venue)
    db_session.flush()
    db_session.add(
        DJSession(
            dj_profile_id=profile.id,
            venue_id=venue.id,
            status=SessionStatus.LIVE,
            minimum_request_amount_cents=700,
            accepting_requests=True,
        )
    )
    db_session.commit()

    response = client.get("/api/v1/djs")

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["is_live"] is True
    assert payload[0]["live_session_id"] is not None
    assert payload[0]["venue_name"] == "Harbor Room"


def test_list_djs_marks_live_dj_when_show_is_active(client: TestClient, db_session: Session) -> None:
    profile = _seed_registered_dj(db_session, email="show-live@example.com", display_name="Show DJ", slug="show-dj")
    venue = Venue(name="Ritual", address="123 Charleston Ave", city="Charleston", state="SC")
    db_session.add(venue)
    db_session.flush()
    db_session.add(
        Event(
            dj_profile_id=profile.id,
            venue_id=venue.id,
            name="Tonight Set",
            starts_at=datetime.now(UTC) - timedelta(minutes=5),
            ends_at=None,
        )
    )
    db_session.commit()

    response = client.get("/api/v1/djs")

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["is_live"] is True
    assert payload[0]["live_session_id"] is not None
    assert payload[0]["venue_name"] == "Ritual"

    session = db_session.scalar(
        select(DJSession).where(
            DJSession.dj_profile_id == profile.id,
            DJSession.status == SessionStatus.LIVE,
        )
    )
    assert session is not None
    assert session.event_id is not None


def test_register_dj_creates_public_profile(db_session: Session) -> None:
    user = register_user(
        db_session,
        RegisterRequest(
            email="new-dj@example.com",
            password="password123",
            display_name="DJ Shaun",
            role=UserRole.DJ,
        ),
    )
    db_session.commit()

    profile = db_session.scalar(select(DJProfile).where(DJProfile.user_id == user.id))

    assert profile is not None
    assert profile.artist_name == "DJ Shaun"
    assert profile.slug == "dj-shaun"
    assert profile.is_public is True


def test_list_venues_returns_only_database_venues(client: TestClient, db_session: Session) -> None:
    db_session.add(Venue(name="Harbor Room", address="1 Wharf", city="Charleston", state="SC"))
    db_session.commit()

    response = client.get("/api/v1/venues")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["name"] == "Harbor Room"


def test_search_venues_filters_by_name(client: TestClient, db_session: Session) -> None:
    db_session.add(Venue(name="Harbor Room", address="1 Wharf", city="Charleston", state="SC"))
    db_session.commit()

    response = client.get("/api/v1/venues/search", params={"q": "harbor"})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["name"] == "Harbor Room"
