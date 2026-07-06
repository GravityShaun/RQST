from fastapi import APIRouter, status

from app.api.deps import DBSession
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from app.schemas.common import MessageResponse
from app.services.auth import issue_tokens, login_user, register_user, rotate_refresh_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DBSession) -> TokenResponse:
    user = register_user(db, payload)
    tokens = issue_tokens(db, user)
    db.commit()
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DBSession) -> TokenResponse:
    user = login_user(db, payload)
    tokens = issue_tokens(db, user)
    db.commit()
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: DBSession) -> TokenResponse:
    tokens = rotate_refresh_token(db, payload.refresh_token)
    db.commit()
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
    )


@router.post("/logout", response_model=MessageResponse)
def logout() -> MessageResponse:
    return MessageResponse(message="Logged out")
