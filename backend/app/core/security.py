from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any
from uuid import uuid4

import jwt
from argon2 import PasswordHasher
from fastapi import HTTPException, status

from app.core.config import get_settings

password_hasher = PasswordHasher()
settings = get_settings()


@dataclass(slots=True)
class TokenPair:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except Exception:
        return False


def _encode_token(subject: str, role: str, expires_delta: timedelta, token_kind: str) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "kind": token_kind,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_token_pair(subject: str, role: str) -> TokenPair:
    access_token = _encode_token(
        subject=subject,
        role=role,
        expires_delta=timedelta(minutes=settings.access_token_ttl_minutes),
        token_kind="access",
    )
    refresh_token = _encode_token(
        subject=subject,
        role=role,
        expires_delta=timedelta(days=settings.refresh_token_ttl_days),
        token_kind="refresh",
    )
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


def decode_token(token: str, expected_kind: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if payload.get("kind") != expected_kind:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    return payload


def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()

