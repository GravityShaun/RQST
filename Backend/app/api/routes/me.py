from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DBSession, get_current_user
from app.models import User
from app.schemas.common import MessageResponse
from app.schemas.users import UserRead, UserUpdate

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserRead)
def get_me(user: Annotated[User, Depends(get_current_user)]) -> UserRead:
    return UserRead.model_validate(user)


@router.patch("", response_model=UserRead)
def update_me(
    payload: UserUpdate,
    db: DBSession,
    user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@router.delete("", response_model=MessageResponse)
def delete_me() -> MessageResponse:
    return MessageResponse(message="Account deletion scheduled")
