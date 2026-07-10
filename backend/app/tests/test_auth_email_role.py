from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.main import app
from app.models import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth import login_user, register_user


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


def test_same_email_can_register_as_listener_and_dj(db_session: Session) -> None:
    email = "shared@example.com"
    listener = register_user(
        db_session,
        RegisterRequest(
            email=email,
            password="password123",
            display_name="Listener",
            role=UserRole.LISTENER,
        ),
    )
    dj = register_user(
        db_session,
        RegisterRequest(
            email=email,
            password="password456",
            display_name="DJ Shared",
            role=UserRole.DJ,
        ),
    )
    db_session.commit()

    assert listener.id != dj.id
    assert listener.role == UserRole.LISTENER
    assert dj.role == UserRole.DJ

    users = list(db_session.scalars(select(User).where(User.email == email)))
    assert len(users) == 2


def test_duplicate_email_same_role_is_rejected(client: TestClient) -> None:
    payload = {
        "email": "dup@example.com",
        "password": "password123",
        "display_name": "First",
        "role": "listener",
    }
    first = client.post("/api/v1/auth/register", json=payload)
    second = client.post("/api/v1/auth/register", json={**payload, "display_name": "Second"})

    assert first.status_code == 201
    assert second.status_code == 409
    assert "role" in second.json()["detail"].lower()


def test_login_requires_matching_role(db_session: Session) -> None:
    email = "role-login@example.com"
    register_user(
        db_session,
        RegisterRequest(
            email=email,
            password="listener-pass",
            display_name="Listener",
            role=UserRole.LISTENER,
        ),
    )
    register_user(
        db_session,
        RegisterRequest(
            email=email,
            password="dj-password",
            display_name="DJ",
            role=UserRole.DJ,
        ),
    )
    db_session.commit()

    listener = login_user(
        db_session,
        LoginRequest(email=email, password="listener-pass", role=UserRole.LISTENER),
    )
    dj = login_user(
        db_session,
        LoginRequest(email=email, password="dj-password", role=UserRole.DJ),
    )

    assert listener.role == UserRole.LISTENER
    assert dj.role == UserRole.DJ

    with pytest.raises(Exception) as exc_info:
        login_user(
            db_session,
            LoginRequest(email=email, password="listener-pass", role=UserRole.DJ),
        )
    assert getattr(exc_info.value, "status_code", None) == 401


def test_login_endpoint_scopes_by_role(client: TestClient) -> None:
    email = "api-role@example.com"
    assert (
        client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "password123",
                "display_name": "Listener",
                "role": "listener",
            },
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "password456",
                "display_name": "DJ",
                "role": "dj",
            },
        ).status_code
        == 201
    )

    listener_login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123", "role": "listener"},
    )
    dj_login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password456", "role": "dj"},
    )
    wrong_role = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123", "role": "dj"},
    )
    missing_role = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )

    assert listener_login.status_code == 200
    assert dj_login.status_code == 200
    assert wrong_role.status_code == 401
    assert missing_role.status_code == 422
