from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.main import app
from app.models import DJProfile, Event, User, UserRole, Venue
from app.services.dev_bootstrap import ensure_local_discover_directory


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
def client(db_session: Session, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("RQST_ENVIRONMENT", "local")

    from app.core.config import get_settings

    get_settings.cache_clear()
    ensure_local_discover_directory(db_session)

    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _register_dj(client: TestClient, email: str) -> tuple[str, DJProfile]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "super-secure-password",
            "display_name": "Tour DJ",
            "role": "dj",
        },
    )
    assert response.status_code == 201
    token = response.json()["access_token"]

    profile_response = client.post(
        "/api/v1/djs/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "artist_name": "Tour DJ",
            "slug": email.split("@")[0].replace(".", "-"),
            "bio": "On the road",
            "city": "Charleston",
            "genres": ["House"],
        },
    )
    assert profile_response.status_code == 201
    profile = profile_response.json()
    return token, profile


def test_create_and_list_events(client: TestClient, db_session: Session) -> None:
    token, profile = _register_dj(client, "shows@example.com")
    starts_at = datetime(2026, 8, 15, 21, 0, tzinfo=UTC).isoformat()

    create_response = client.post(
        "/api/v1/djs/events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Harbor Night",
            "description": "Sunset set",
            "starts_at": starts_at,
            "ticket_url": "https://tickets.example.com/harbor",
            "venue": {
                "name": "Harbor Static",
                "address": "22 Market St",
                "city": "Charleston",
                "state": "SC",
                "country": "US",
            },
        },
    )

    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["name"] == "Harbor Night"
    assert payload["venue"]["name"] == "Harbor Static"
    assert payload["flyer_url"] is None

    list_response = client.get(
        "/api/v1/djs/events",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    public_response = client.get(f"/api/v1/djs/{profile['slug']}/events")
    assert public_response.status_code == 200
    assert public_response.json()[0]["name"] == "Harbor Night"

    event = db_session.scalar(select(Event).where(Event.dj_profile_id == profile["id"]))
    assert event is not None
    venue = db_session.get(Venue, event.venue_id)
    assert venue is not None
    assert venue.name == "Harbor Static"


def test_create_event_without_name(client: TestClient, db_session: Session) -> None:
    token, _ = _register_dj(client, "unnamed-show@example.com")
    starts_at = datetime(2026, 9, 2, 20, 30, tzinfo=UTC).isoformat()

    create_response = client.post(
        "/api/v1/djs/events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "starts_at": starts_at,
            "venue": {
                "name": "Late Room",
                "address": "9 King St",
                "city": "Charleston",
                "state": "SC",
                "country": "US",
            },
        },
    )

    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["name"] is None
    assert payload["starts_at"] is not None

    event = db_session.scalar(select(Event).where(Event.name.is_(None)))
    assert event is not None


def test_search_venue_suggestions_includes_database_venues(client: TestClient, monkeypatch) -> None:
    token, _ = _register_dj(client, "places@example.com")

    monkeypatch.setattr("app.services.venue_search.search_places", lambda query, limit=6: [])

    response = client.get(
        "/api/v1/venues/places/search",
        params={"q": "moonlight"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 1
    assert payload[0]["name"] == "Moonlight Room"
    assert payload[0]["source"] == "database"
    assert payload[0]["venue_id"] is not None


def test_search_venue_suggestions_merges_online_results(client: TestClient, monkeypatch) -> None:
    token, _ = _register_dj(client, "places-online@example.com")

    monkeypatch.setattr(
        "app.services.venue_search.search_places",
        lambda query, limit=6: [
            type(
                "PlaceCandidate",
                (),
                {
                    "place_id": "online-123",
                    "name": "New Rooftop",
                    "address": "500 King St",
                    "city": "Charleston",
                    "state": "SC",
                    "country": "US",
                    "latitude": 32.7765,
                    "longitude": -79.9311,
                    "display_name": "New Rooftop, 500 King St, Charleston, SC",
                },
            )()
        ],
    )

    response = client.get(
        "/api/v1/venues/places/search",
        params={"q": "king"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    sources = {item["source"] for item in payload}
    assert "database" in sources
    assert "online" in sources
