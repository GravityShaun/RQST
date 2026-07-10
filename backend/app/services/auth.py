from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_token_pair, decode_token, hash_password, hash_token, verify_password
from app.models import RefreshToken, User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.dj_profiles import ensure_dj_profile_for_user


def register_user(db: Session, payload: RegisterRequest) -> User:
    role = payload.role if payload.role in UserRole else UserRole.LISTENER
    existing = db.scalar(
        select(User).where(User.email == payload.email.lower(), User.role == role)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered for this role",
        )

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        role=role,
    )
    db.add(user)
    db.flush()
    ensure_dj_profile_for_user(db, user)
    return user


def login_user(db: Session, payload: LoginRequest) -> User:
    user = db.scalar(
        select(User).where(User.email == payload.email.lower(), User.role == payload.role)
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return user


def issue_tokens(db: Session, user: User):
    tokens = create_token_pair(subject=str(user.id), role=user.role)
    refresh = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(tokens.refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    db.add(refresh)
    db.flush()
    return tokens


def rotate_refresh_token(db: Session, refresh_token: str):
    payload = decode_token(refresh_token, expected_kind="refresh")
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)))
    if not stored or stored.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid")

    stored.revoked_at = datetime.now(UTC)
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return issue_tokens(db, user)
