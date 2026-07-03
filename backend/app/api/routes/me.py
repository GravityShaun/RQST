from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.models import Contribution, SongRequest, User
from app.repositories.requests import build_request_reads
from app.schemas.common import MessageResponse
from app.schemas.requests import RequestRead
from app.schemas.users import UserRead, UserUpdate

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserRead)
def get_me(user: Annotated[User, Depends(get_current_user)]) -> UserRead:
    return UserRead.model_validate(user)


@router.get("/requests", response_model=list[RequestRead])
def get_my_requests(
    db: DBSession,
    user: Annotated[User, Depends(get_current_user)],
) -> list[RequestRead]:
    contributed_request_ids = select(Contribution.song_request_id).where(Contribution.user_id == user.id)
    requests = list(
        db.scalars(
            select(SongRequest)
            .where(
                (SongRequest.requested_by_user_id == user.id)
                | (SongRequest.id.in_(contributed_request_ids))
            )
            .order_by(SongRequest.created_at.desc(), SongRequest.id.desc())
        )
    )
    return build_request_reads(db, requests, current_user_id=user.id)


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
