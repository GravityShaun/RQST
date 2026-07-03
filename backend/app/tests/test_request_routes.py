from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.core.security import create_token_pair
from app.main import app
from app.models import (
    DJProfile,
    DJSession,
    Payment,
    RequestStatus,
    SessionStatus,
    Song,
    SongRequest,
    User,
    UserRole,
    Venue,
)


@pytest.fixture()
def db_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
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
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def seed_request_world(db: Session) -> dict[str, object]:
    listener = User(
        email="listener@example.com",
        password_hash="hash",
        display_name="Maya Listener",
        avatar_url="https://example.com/maya.jpg",
        role=UserRole.LISTENER,
    )
    other_listener = User(
        email="other@example.com",
        password_hash="hash",
        display_name="Other Listener",
        role=UserRole.LISTENER,
    )
    dj_user = User(
        email="dj@example.com",
        password_hash="hash",
        display_name="DJ User",
        role=UserRole.DJ,
    )
    db.add_all([listener, other_listener, dj_user])
    db.flush()

    profile = DJProfile(
        user_id=dj_user.id,
        artist_name="DJ Solace",
        slug="dj-solace",
        city="Brooklyn",
    )
    venue = Venue(
        name="Moonlight Room",
        address="1 Dance Floor",
        city="Brooklyn",
        state="NY",
    )
    song = Song(
        title="One More Time",
        artist="Daft Punk",
        album="Discovery",
        album_art_url="https://example.com/one-more-time.jpg",
        external_source="apple_music",
        external_id="123",
    )
    other_song = Song(
        title="Levels",
        artist="Avicii",
        external_source="apple_music",
        external_id="456",
    )
    db.add_all([profile, venue, song, other_song])
    db.flush()

    session = DJSession(
        dj_profile_id=profile.id,
        venue_id=venue.id,
        status=SessionStatus.LIVE,
        minimum_request_amount_cents=700,
        accepting_requests=True,
    )
    db.add(session)
    db.commit()

    return {
        "listener": listener,
        "other_listener": other_listener,
        "dj_user": dj_user,
        "profile": profile,
        "venue": venue,
        "song": song,
        "other_song": other_song,
        "session": session,
    }


def auth_headers(user: User) -> dict[str, str]:
    token_pair = create_token_pair(str(user.id), user.role)
    return {"Authorization": f"Bearer {token_pair.access_token}"}


def test_create_request_persists_payment_contribution_and_returns_metadata(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    session = world["session"]
    song = world["song"]

    response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == RequestStatus.PENDING_PAYMENT
    assert body["song_title"] == "One More Time"
    assert body["song_artist"] == "Daft Punk"
    assert body["dj_artist_name"] == "DJ Solace"
    assert body["venue_name"] == "Moonlight Room"
    assert body["original_amount_cents"] == 900
    assert body["my_contribution_cents"] == 900
    assert body["contributor_count"] == 1
    assert body["latest_payment_id"] is not None
    assert body["checkout_url"]

    request = db_session.get(SongRequest, body["id"])
    payment = db_session.get(Payment, body["latest_payment_id"])
    assert request is not None
    assert payment is not None
    assert request.status == RequestStatus.PENDING_PAYMENT
    assert request.total_amount_cents == 0
    assert payment.gross_amount_cents == 900


def test_me_requests_returns_only_current_users_requests(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    other_listener = world["other_listener"]
    session = world["session"]
    song = world["song"]
    other_song = world["other_song"]

    own_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )
    assert own_response.status_code == 201
    other_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": other_song.id, "amount_cents": 900},
        headers=auth_headers(other_listener),
    )
    assert other_response.status_code == 201

    response = client.get("/api/v1/me/requests", headers=auth_headers(listener))

    assert response.status_code == 200
    requests = response.json()
    assert [item["song_title"] for item in requests] == ["One More Time"]


def test_session_queue_includes_pending_then_open_after_payment_success(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    session = world["session"]
    song = world["song"]

    create_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )
    assert create_response.status_code == 201
    created = create_response.json()

    queue_response = client.get(f"/api/v1/sessions/{session.id}/requests")
    assert queue_response.status_code == 200
    assert queue_response.json()[0]["status"] == RequestStatus.PENDING_PAYMENT

    webhook_response = client.post(
        "/api/v1/payments/webhooks/polar",
        headers={"X-Polar-Signature": "polar-dev-secret"},
        json={
            "event_id": "evt-payment-succeeded",
            "event_type": "payment.succeeded",
            "data": {
                "payment_id": created["latest_payment_id"],
                "provider_payment_id": "provider-123",
            },
        },
    )
    assert webhook_response.status_code == 200

    queue_response = client.get(f"/api/v1/sessions/{session.id}/requests")
    assert queue_response.status_code == 200
    queue_item = queue_response.json()[0]
    assert queue_item["status"] == RequestStatus.OPEN
    assert queue_item["total_amount_cents"] == 900


def test_duplicate_song_request_returns_conflict(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    session = world["session"]
    song = world["song"]

    response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )
    assert response.status_code == 201

    duplicate_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )

    assert duplicate_response.status_code == 409
