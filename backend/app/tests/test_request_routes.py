from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

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
    Event,
    Payment,
    RequestStatus,
    SessionStatus,
    Song,
    SongRequest,
    User,
    UserRole,
    Venue,
)


@pytest.fixture(autouse=True)
def disable_auto_complete_payments(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.payments.should_auto_complete_payments", lambda: False)


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
    assert body["my_original_contribution_cents"] == 900
    assert body["my_added_contribution_cents"] == 0
    assert body["added_amount_cents"] == 0
    assert body["contributors"][0]["is_initial"] is True
    assert body["contributor_count"] == 1
    assert body["latest_payment_id"] is not None
    assert body["checkout_url"]

    request = db_session.get(SongRequest, body["id"])
    payment = db_session.get(Payment, body["latest_payment_id"])
    assert request is not None
    assert payment is not None
    assert request.status == RequestStatus.PENDING_PAYMENT
    assert request.total_amount_cents == 0
    assert request.event_id is None
    assert payment.gross_amount_cents == 900


def test_create_request_records_event_id_for_show(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    session = world["session"]
    song = world["song"]
    profile = world["profile"]
    venue = world["venue"]

    event = Event(
        dj_profile_id=profile.id,
        venue_id=venue.id,
        name="Friday Night Set",
        starts_at=datetime.now(UTC) - timedelta(minutes=10),
        ends_at=None,
    )
    db_session.add(event)
    session.event_id = event.id
    db_session.commit()

    response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["event_id"] == event.id
    assert body["event_name"] == "Friday Night Set"

    request = db_session.get(SongRequest, body["id"])
    assert request is not None
    assert request.event_id == event.id


def test_create_request_rejects_ended_session(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    session = world["session"]
    song = world["song"]

    session.status = SessionStatus.ENDED
    session.accepting_requests = False
    db_session.commit()

    response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Session not accepting requests"


def test_create_request_persists_song_snapshot_and_returns_it_in_session_list(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    session = world["session"]

    response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={
            "amount_cents": 900,
            "shoutout_amount_cents": 500,
            "note": "Happy birthday from table seven",
            "song": {
                "title": "Midnight City",
                "artist": "M83",
                "album": "Hurry Up, We're Dreaming",
                "duration_ms": 244000,
                "album_art_url": "https://example.com/midnight-city.jpg",
                "isrc": "GB55H1100002",
                "external_source": "apple_music",
                "external_id": "420790606",
                "explicit": False,
            },
        },
        headers=auth_headers(listener),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["song_title"] == "Midnight City"
    assert body["song_artist"] == "M83"
    assert body["song_album"] == "Hurry Up, We're Dreaming"
    assert body["song_album_art_url"] == "https://example.com/midnight-city.jpg"
    assert body["note"] == "Happy birthday from table seven"
    assert body["shoutout_amount_cents"] == 500

    song = db_session.get(Song, body["song_id"])
    request = db_session.get(SongRequest, body["id"])
    assert song is not None
    assert request is not None
    assert song.external_source == "apple_music"
    assert song.external_id == "420790606"
    assert song.duration_ms == 244000
    assert song.isrc == "GB55H1100002"
    assert request.note == "Happy birthday from table seven"
    assert request.shoutout_amount_cents == 500
    assert request.original_amount_cents == 900

    list_response = client.get(f"/api/v1/sessions/{session.id}/requests")
    assert list_response.status_code == 200
    list_item = list_response.json()[0]
    assert list_item["id"] == body["id"]
    assert list_item["song_title"] == "Midnight City"
    assert list_item["song_album_art_url"] == "https://example.com/midnight-city.jpg"
    assert list_item["note"] is None
    assert list_item["shoutout_amount_cents"] == 0


def test_session_queue_excludes_played_and_filters_by_event(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    session = world["session"]
    song = world["song"]
    profile = world["profile"]
    venue = world["venue"]

    event = Event(
        dj_profile_id=profile.id,
        venue_id=venue.id,
        name="Friday Night Set",
        starts_at=datetime.now(UTC) - timedelta(minutes=10),
        ends_at=None,
    )
    db_session.add(event)
    session.event_id = event.id
    db_session.commit()

    create_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )
    assert create_response.status_code == 201
    request_id = create_response.json()["id"]

    request = db_session.get(SongRequest, request_id)
    assert request is not None
    request.status = RequestStatus.PLAYED
    db_session.commit()

    queue_response = client.get(f"/api/v1/sessions/{session.id}/requests")
    assert queue_response.status_code == 200
    assert queue_response.json() == []


def test_session_requests_returns_empty_queue_when_session_ended(
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

    live_response = client.get(f"/api/v1/sessions/{session.id}/requests")
    assert live_response.status_code == 200
    assert len(live_response.json()) == 1

    session.status = SessionStatus.ENDED
    db_session.commit()

    ended_response = client.get(f"/api/v1/sessions/{session.id}/requests")
    assert ended_response.status_code == 200
    assert ended_response.json() == []


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


def test_contribute_to_open_request_updates_total_and_my_contribution(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    other_listener = world["other_listener"]
    session = world["session"]
    song = world["song"]

    create_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )
    assert create_response.status_code == 201
    created = create_response.json()

    webhook_response = client.post(
        "/api/v1/payments/webhooks/polar",
        headers={"X-Polar-Signature": "polar-dev-secret"},
        json={
            "event_id": "evt-open-request",
            "event_type": "payment.succeeded",
            "data": {
                "payment_id": created["latest_payment_id"],
                "provider_payment_id": "provider-open",
            },
        },
    )
    assert webhook_response.status_code == 200

    contribute_response = client.post(
        f"/api/v1/requests/{created['id']}/contribute",
        json={"amount_cents": 500},
        headers=auth_headers(other_listener),
    )
    assert contribute_response.status_code == 200
    contributed = contribute_response.json()

    contribution_webhook_response = client.post(
        "/api/v1/payments/webhooks/polar",
        headers={"X-Polar-Signature": "polar-dev-secret"},
        json={
            "event_id": "evt-contribution-succeeded",
            "event_type": "payment.succeeded",
            "data": {
                "payment_id": contributed["latest_payment_id"],
                "provider_payment_id": "provider-contribution",
            },
        },
    )
    assert contribution_webhook_response.status_code == 200

    refreshed_response = client.get(f"/api/v1/requests/{created['id']}")
    assert refreshed_response.status_code == 200
    body = refreshed_response.json()
    assert body["total_amount_cents"] == 1400
    assert body["contributor_count"] == 2

    queue_response = client.get(f"/api/v1/sessions/{session.id}/requests")
    assert queue_response.status_code == 200
    queue_item = next(item for item in queue_response.json() if item["id"] == created["id"])
    assert queue_item["total_amount_cents"] == 1400

    my_requests_response = client.get("/api/v1/me/requests", headers=auth_headers(other_listener))
    assert my_requests_response.status_code == 200
    contributed_request = next(item for item in my_requests_response.json() if item["id"] == created["id"])
    assert contributed_request["my_contribution_cents"] == 500
    assert contributed_request["total_amount_cents"] == 1400


def test_local_auto_complete_payments_open_request_on_create(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.payments.should_auto_complete_payments", lambda: True)

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
    assert body["status"] == RequestStatus.OPEN
    assert body["total_amount_cents"] == 900


def test_local_auto_complete_payments_applies_contribution_immediately(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.payments.should_auto_complete_payments", lambda: True)

    world = seed_request_world(db_session)
    listener = world["listener"]
    other_listener = world["other_listener"]
    session = world["session"]
    song = world["song"]

    create_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )
    assert create_response.status_code == 201
    created = create_response.json()

    contribute_response = client.post(
        f"/api/v1/requests/{created['id']}/contribute",
        json={"amount_cents": 500},
        headers=auth_headers(other_listener),
    )
    assert contribute_response.status_code == 200
    body = contribute_response.json()
    assert body["status"] == RequestStatus.OPEN
    assert body["total_amount_cents"] == 1400
    assert body["my_contribution_cents"] == 500


def test_requester_added_contribution_is_logged_separately_from_original(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.payments.should_auto_complete_payments", lambda: True)

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

    contribute_response = client.post(
        f"/api/v1/requests/{created['id']}/contribute",
        json={"amount_cents": 500},
        headers=auth_headers(listener),
    )
    assert contribute_response.status_code == 200
    body = contribute_response.json()
    assert body["total_amount_cents"] == 1400
    assert body["total_pool_cents"] == 1400
    assert body["pool_original_cents"] == 900
    assert body["added_amount_cents"] == 500
    assert body["pool_original_cents"] + body["added_amount_cents"] == body["total_pool_cents"]
    assert body["contributor_count"] == 1
    assert len(body["contributors"]) == 1
    assert body["contributors"][0]["amount_cents"] == 1400
    assert body["contributors"][0]["is_initial"] is True
    assert len(body["my_added_contributions"]) == 1
    assert body["my_added_contributions"][0]["amount_cents"] == 500
    assert body["my_added_contributions"][0]["is_initial"] is False


def test_undo_request_within_window_cancels_pending_request(client: TestClient, db_session: Session) -> None:
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
    request_id = create_response.json()["id"]

    undo_response = client.post(
        f"/api/v1/requests/{request_id}/undo",
        headers=auth_headers(listener),
    )

    assert undo_response.status_code == 200
    request = db_session.get(SongRequest, request_id)
    assert request is None


def test_undo_request_after_window_expires(client: TestClient, db_session: Session) -> None:
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
    request_id = create_response.json()["id"]

    request = db_session.get(SongRequest, request_id)
    assert request is not None
    request.created_at = datetime.now(UTC) - timedelta(seconds=31)
    db_session.commit()

    undo_response = client.post(
        f"/api/v1/requests/{request_id}/undo",
        headers=auth_headers(listener),
    )

    assert undo_response.status_code == 409
    assert undo_response.json()["detail"] == "Undo window has expired"


def test_undo_request_after_dj_confirm_is_rejected(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.payments.should_auto_complete_payments", lambda: True)
    world = seed_request_world(db_session)
    listener = world["listener"]
    dj_user = world["dj_user"]
    session = world["session"]
    song = world["song"]

    create_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )
    assert create_response.status_code == 201
    request_id = create_response.json()["id"]

    confirm_response = client.post(
        f"/api/v1/dj/requests/{request_id}/confirm",
        headers=auth_headers(dj_user),
    )
    assert confirm_response.status_code == 200

    undo_response = client.post(
        f"/api/v1/requests/{request_id}/undo",
        headers=auth_headers(listener),
    )

    assert undo_response.status_code == 409
    assert undo_response.json()["detail"] == "DJ already confirmed this request"


def test_reset_current_session_queue_clears_open_and_inactive_requests(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    dj_user = world["dj_user"]
    session = world["session"]
    song = world["song"]

    create_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900},
        headers=auth_headers(listener),
    )
    assert create_response.status_code == 201
    request_id = create_response.json()["id"]

    cancel_response = client.post(
        f"/api/v1/requests/{request_id}/undo",
        headers=auth_headers(listener),
    )
    assert cancel_response.status_code == 200

    reset_response = client.post(
        "/api/v1/dj/sessions/current/queue/reset",
        headers=auth_headers(dj_user),
    )
    assert reset_response.status_code == 200
    assert reset_response.json()["message"] == "Live queue cleared"

    queue_response = client.get(f"/api/v1/sessions/{session.id}/requests")
    assert queue_response.status_code == 200
    assert queue_response.json() == []

    remaining = db_session.get(SongRequest, request_id)
    assert remaining is None


def test_dj_played_requests_returns_played_songs_with_shoutout_fields(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_request_world(db_session)
    listener = world["listener"]
    dj_user = world["dj_user"]
    session = world["session"]
    song = world["song"]

    create_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={
            "song_id": song.id,
            "amount_cents": 900,
            "shoutout_amount_cents": 500,
            "note": "For Alex",
        },
        headers=auth_headers(listener),
    )
    assert create_response.status_code == 201
    request_id = create_response.json()["id"]

    request = db_session.get(SongRequest, request_id)
    assert request is not None
    request.status = RequestStatus.PLAYED
    request.shoutout_fulfilled = True
    db_session.commit()

    current_queue = client.get("/api/v1/dj/requests/current", headers=auth_headers(dj_user))
    assert current_queue.status_code == 200
    assert current_queue.json() == []

    played_response = client.get("/api/v1/dj/requests/played", headers=auth_headers(dj_user))
    assert played_response.status_code == 200
    played = played_response.json()
    assert len(played) == 1
    assert played[0]["id"] == request_id
    assert played[0]["status"] == RequestStatus.PLAYED
    assert played[0]["shoutout_amount_cents"] == 500
    assert played[0]["note"] == "For Alex"
    assert played[0]["shoutout_fulfilled"] is True


def test_me_requests_keeps_played_requests(
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
    request_id = create_response.json()["id"]

    request = db_session.get(SongRequest, request_id)
    assert request is not None
    request.status = RequestStatus.PLAYED
    db_session.commit()

    response = client.get("/api/v1/me/requests", headers=auth_headers(listener))
    assert response.status_code == 200
    requests = response.json()
    assert len(requests) == 1
    assert requests[0]["id"] == request_id
    assert requests[0]["status"] == RequestStatus.PLAYED


def test_me_requests_includes_queued_shoutout_for_requester(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.payments.should_auto_complete_payments", lambda: True)

    world = seed_request_world(db_session)
    listener = world["listener"]
    session = world["session"]
    song = world["song"]

    create_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={
            "song_id": song.id,
            "amount_cents": 900,
            "shoutout_amount_cents": 500,
            "note": "For Alex",
        },
        headers=auth_headers(listener),
    )
    assert create_response.status_code == 201
    request_id = create_response.json()["id"]

    response = client.get("/api/v1/me/requests", headers=auth_headers(listener))
    assert response.status_code == 200
    requests = response.json()
    assert len(requests) == 1
    assert requests[0]["id"] == request_id
    assert requests[0]["status"] == RequestStatus.OPEN
    assert requests[0]["note"] == "For Alex"
    assert requests[0]["shoutout_amount_cents"] == 500


def test_me_requests_includes_played_shoutout_for_requester(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.payments.should_auto_complete_payments", lambda: True)

    world = seed_request_world(db_session)
    listener = world["listener"]
    session = world["session"]
    song = world["song"]

    create_response = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={
            "song_id": song.id,
            "amount_cents": 900,
            "shoutout_amount_cents": 500,
            "note": "For Alex",
        },
        headers=auth_headers(listener),
    )
    assert create_response.status_code == 201
    request_id = create_response.json()["id"]

    request = db_session.get(SongRequest, request_id)
    assert request is not None
    request.status = RequestStatus.PLAYED
    request.shoutout_fulfilled = True
    db_session.commit()

    response = client.get("/api/v1/me/requests", headers=auth_headers(listener))
    assert response.status_code == 200
    requests = response.json()
    assert len(requests) == 1
    assert requests[0]["note"] == "For Alex"
    assert requests[0]["shoutout_amount_cents"] == 500
    assert requests[0]["shoutout_fulfilled"] is True
