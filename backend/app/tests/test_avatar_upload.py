from collections.abc import Iterator
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.core.security import create_token_pair
from app.main import app
from app.models import User, UserRole


@pytest.fixture()
def db_session(tmp_path) -> Iterator[Session]:
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
def client(db_session: Session, tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setattr("app.api.routes.me.settings.uploads_dir", tmp_path / "uploads")

    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def auth_headers(user: User) -> dict[str, str]:
    tokens = create_token_pair(str(user.id), user.role.value)
    return {"Authorization": f"Bearer {tokens.access_token}"}


def make_png_bytes(size: tuple[int, int] = (800, 600)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, color="#E05A47").save(buffer, format="PNG")
    return buffer.getvalue()


def test_upload_avatar_stores_compressed_jpeg(client: TestClient, db_session: Session, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.api.routes.me.settings.uploads_dir", tmp_path / "uploads")

    user = User(
        email="avatar@example.com",
        password_hash="hash",
        display_name="Avatar User",
        role=UserRole.LISTENER,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    response = client.post(
        "/api/v1/me/avatar",
        headers=auth_headers(user),
        files={"file": ("avatar.png", make_png_bytes(), "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["avatar_url"] == f"/uploads/avatars/{user.id}.jpg"

    saved_path = tmp_path / "uploads" / "avatars" / f"{user.id}.jpg"
    assert saved_path.exists()

    with Image.open(saved_path) as image:
        assert image.size == (256, 256)
        assert image.format == "JPEG"
