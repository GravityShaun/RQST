from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.core.security import create_token_pair
from app.main import app
from app.models import (
    ComplimentarySongCode,
    ComplimentarySongCredit,
    Contribution,
    DJEarningsLedger,
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
from app.services.complimentary import MAX_COMPLIMENTARY_USES_PER_SHOW


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


def auth_headers(user: User) -> dict[str, str]:
    token_pair = create_token_pair(str(user.id), user.role)
    return {"Authorization": f"Bearer {token_pair.access_token}"}


def seed_complimentary_world(db: Session) -> dict[str, object]:
    listener = User(
        email="listener@example.com",
        password_hash="hash",
        display_name="Maya Listener",
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

    now = datetime.now(UTC)
    event = Event(
        dj_profile_id=profile.id,
        venue_id=venue.id,
        name="Friday Fever",
        starts_at=now - timedelta(hours=1),
        ends_at=now + timedelta(hours=3),
    )
    db.add(event)
    db.flush()

    session = DJSession(
        dj_profile_id=profile.id,
        venue_id=venue.id,
        event_id=event.id,
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
        "event": event,
        "session": session,
    }


def test_dj_gets_one_shared_complimentary_code_per_show(client: TestClient, db_session: Session) -> None:
    world = seed_complimentary_world(db_session)
    dj_user = world["dj_user"]
    event = world["event"]

    first = client.post(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    assert first.status_code == 201, first.text
    first_body = first.json()
    assert first_body["code"]
    assert len(first_body["code"]) >= 12
    assert first_body["used_count"] == 0
    assert first_body["max_uses"] == MAX_COMPLIMENTARY_USES_PER_SHOW
    assert first_body["remaining_uses"] == MAX_COMPLIMENTARY_USES_PER_SHOW

    second = client.post(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    assert second.status_code == 201
    assert second.json()["code"] == first_body["code"]
    assert second.json()["id"] == first_body["id"]

    summary = client.get(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    assert summary.status_code == 200
    body = summary.json()
    assert body["used_count"] == 0
    assert body["max_uses"] == MAX_COMPLIMENTARY_USES_PER_SHOW
    assert body["code"]["code"] == first_body["code"]


def test_ending_show_voids_complimentary_code(client: TestClient, db_session: Session) -> None:
    world = seed_complimentary_world(db_session)
    listener = world["listener"]
    dj_user = world["dj_user"]
    event = world["event"]

    issued = client.post(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    code = issued.json()["code"]

    ended = client.post(
        f"/api/v1/djs/events/{event.id}/end",
        headers=auth_headers(dj_user),
    )
    assert ended.status_code == 200

    blocked = client.post(
        "/api/v1/me/complimentary-credits/redeem",
        json={"code": code},
        headers=auth_headers(listener),
    )
    assert blocked.status_code == 409
    assert "no longer valid" in blocked.json()["detail"].lower()

    code_row = db_session.scalar(select(ComplimentarySongCode).where(ComplimentarySongCode.code == code))
    assert code_row is not None
    assert code_row.voided_at is not None


def test_shared_code_can_be_redeemed_by_multiple_listeners(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_complimentary_world(db_session)
    listener = world["listener"]
    other_listener = world["other_listener"]
    dj_user = world["dj_user"]
    event = world["event"]

    issued = client.post(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    code = issued.json()["code"]

    first = client.post(
        "/api/v1/me/complimentary-credits/redeem",
        json={"code": code},
        headers=auth_headers(listener),
    )
    assert first.status_code == 200

    second = client.post(
        "/api/v1/me/complimentary-credits/redeem",
        json={"code": code.lower()},
        headers=auth_headers(other_listener),
    )
    assert second.status_code == 200

    summary = client.get(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    assert summary.json()["used_count"] == 2
    assert summary.json()["remaining_uses"] == MAX_COMPLIMENTARY_USES_PER_SHOW - 2


def test_same_listener_blocked_from_reusing_code_by_default(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_complimentary_world(db_session)
    listener = world["listener"]
    dj_user = world["dj_user"]
    event = world["event"]
    session = world["session"]
    song = world["song"]
    other_song = world["other_song"]

    issued = client.post(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    assert issued.status_code == 201
    assert issued.json()["allow_multiple_uses_per_user"] is False
    code = issued.json()["code"]

    first_redeem = client.post(
        "/api/v1/me/complimentary-credits/redeem",
        json={"code": code},
        headers=auth_headers(listener),
    )
    assert first_redeem.status_code == 200

    first_request = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 900, "use_complimentary": True},
        headers=auth_headers(listener),
    )
    assert first_request.status_code == 201

    blocked = client.post(
        "/api/v1/me/complimentary-credits/redeem",
        json={"code": code},
        headers=auth_headers(listener),
    )
    assert blocked.status_code == 409
    assert "already used" in blocked.json()["detail"].lower()

    # Enabling the setting lets the same listener redeem again after using a credit.
    updated = client.patch(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        json={"allow_multiple_uses_per_user": True},
        headers=auth_headers(dj_user),
    )
    assert updated.status_code == 200
    assert updated.json()["allow_multiple_uses_per_user"] is True

    second_redeem = client.post(
        "/api/v1/me/complimentary-credits/redeem",
        json={"code": code},
        headers=auth_headers(listener),
    )
    assert second_redeem.status_code == 200
    assert second_redeem.json()["id"] != first_redeem.json()["id"]
    assert second_redeem.json()["used_at"] is None

    second_request = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": other_song.id, "amount_cents": 800, "use_complimentary": True},
        headers=auth_headers(listener),
    )
    assert second_request.status_code == 201, second_request.text
    assert second_request.json()["is_complimentary"] is True

    summary = client.get(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    assert summary.status_code == 200
    assert summary.json()["used_count"] == 2
    assert summary.json()["code"]["allow_multiple_uses_per_user"] is True


def test_listener_redeems_code_and_creates_complimentary_request_without_payment(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_complimentary_world(db_session)
    listener = world["listener"]
    dj_user = world["dj_user"]
    event = world["event"]
    session = world["session"]
    song = world["song"]

    issued = client.post(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    assert issued.status_code == 201
    code = issued.json()["code"]

    redeemed = client.post(
        "/api/v1/me/complimentary-credits/redeem",
        json={"code": code},
        headers=auth_headers(listener),
    )
    assert redeemed.status_code == 200
    credit_body = redeemed.json()
    assert credit_body["event_id"] == event.id
    assert credit_body["used_at"] is None
    assert credit_body["dj_artist_name"] == "DJ Solace"
    assert credit_body["dj_slug"] == "dj-solace"
    assert credit_body["venue_name"] == "Moonlight Room"
    assert credit_body["live_session_id"] == session.id

    created = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={
            "song_id": song.id,
            "amount_cents": 900,
            "shoutout_amount_cents": 500,
            "note": "Happy birthday from table seven",
            "use_complimentary": True,
        },
        headers=auth_headers(listener),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == RequestStatus.OPEN
    assert body["is_complimentary"] is True  # visible to the requester
    assert body["total_amount_cents"] == 1400
    assert body["original_amount_cents"] == 900
    assert body["latest_payment_id"] is None
    assert body["checkout_url"] is None

    public_queue = client.get(f"/api/v1/sessions/{session.id}/requests")
    assert public_queue.status_code == 200
    public_row = next(item for item in public_queue.json() if item["id"] == body["id"])
    assert public_row["is_complimentary"] is False  # hidden from public queue

    request = db_session.get(SongRequest, body["id"])
    assert request is not None
    assert request.is_complimentary is True
    assert request.shoutout_amount_cents == 500
    assert db_session.scalar(select(Payment).where(Payment.song_request_id == request.id)) is None
    assert db_session.scalar(select(DJEarningsLedger).where(DJEarningsLedger.song_request_id == request.id)) is None

    contribution = db_session.scalar(select(Contribution).where(Contribution.song_request_id == request.id))
    assert contribution is not None
    assert contribution.amount_cents == 1400
    assert contribution.payment_id is None

    credit = db_session.get(ComplimentarySongCredit, credit_body["id"])
    assert credit is not None
    assert credit.used_at is not None
    assert credit.used_song_request_id == request.id

    dj_queue = client.get("/api/v1/dj/requests/current", headers=auth_headers(dj_user))
    assert dj_queue.status_code == 200
    complimentary_row = next(item for item in dj_queue.json() if item["id"] == request.id)
    assert complimentary_row["is_complimentary"] is True
    assert complimentary_row["total_amount_cents"] == 1400

    confirm = client.post(
        f"/api/v1/dj/requests/{request.id}/confirm",
        headers=auth_headers(dj_user),
    )
    assert confirm.status_code == 200

    played = client.post(
        f"/api/v1/dj/requests/{request.id}/played",
        headers=auth_headers(dj_user),
    )
    assert played.status_code == 200
    db_session.refresh(request)
    assert request.status == RequestStatus.PLAYED
    assert db_session.scalar(select(DJEarningsLedger).where(DJEarningsLedger.song_request_id == request.id)) is None


def test_complimentary_request_enforces_amount_and_deadline_limits(
    client: TestClient,
    db_session: Session,
) -> None:
    world = seed_complimentary_world(db_session)
    listener = world["listener"]
    dj_user = world["dj_user"]
    event = world["event"]
    session = world["session"]
    song = world["song"]

    issued = client.post(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    code = issued.json()["code"]
    client.post(
        "/api/v1/me/complimentary-credits/redeem",
        json={"code": code},
        headers=auth_headers(listener),
    )

    too_expensive = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={"song_id": song.id, "amount_cents": 5001, "use_complimentary": True},
        headers=auth_headers(listener),
    )
    assert too_expensive.status_code == 422

    with_deadline = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={
            "song_id": song.id,
            "amount_cents": 900,
            "play_deadline_minutes": 15,
            "play_deadline_amount_cents": 2000,
            "use_complimentary": True,
        },
        headers=auth_headers(listener),
    )
    assert with_deadline.status_code == 422

    shoutout_too_high = client.post(
        f"/api/v1/sessions/{session.id}/requests",
        json={
            "song_id": song.id,
            "amount_cents": 900,
            "shoutout_amount_cents": 2001,
            "note": "Too much",
            "use_complimentary": True,
        },
        headers=auth_headers(listener),
    )
    assert shoutout_too_high.status_code == 422


def test_complimentary_code_blocks_eleventh_redemption(client: TestClient, db_session: Session) -> None:
    world = seed_complimentary_world(db_session)
    dj_user = world["dj_user"]
    event = world["event"]

    issued = client.post(
        f"/api/v1/djs/events/{event.id}/complimentary-codes",
        headers=auth_headers(dj_user),
    )
    code = issued.json()["code"]
    code_row = db_session.scalar(select(ComplimentarySongCode).where(ComplimentarySongCode.code == code))
    assert code_row is not None

    for index in range(MAX_COMPLIMENTARY_USES_PER_SHOW):
        user = User(
            email=f"friend{index}@example.com",
            password_hash="hash",
            display_name=f"Friend {index}",
            role=UserRole.LISTENER,
        )
        db_session.add(user)
        db_session.flush()
        response = client.post(
            "/api/v1/me/complimentary-credits/redeem",
            json={"code": code},
            headers=auth_headers(user),
        )
        assert response.status_code == 200, response.text

    blocked_user = User(
        email="blocked@example.com",
        password_hash="hash",
        display_name="Blocked Friend",
        role=UserRole.LISTENER,
    )
    db_session.add(blocked_user)
    db_session.commit()

    blocked = client.post(
        "/api/v1/me/complimentary-credits/redeem",
        json={"code": code},
        headers=auth_headers(blocked_user),
    )
    assert blocked.status_code == 409
