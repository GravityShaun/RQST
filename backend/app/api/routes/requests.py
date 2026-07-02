from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, require_role
from app.models import (
    Contribution,
    ContributionStatus,
    DJProfile,
    DJSession,
    Payment,
    RequestStatus,
    SongRequest,
    User,
    UserRole,
)
from app.repositories.requests import get_session_queue
from app.schemas.common import MessageResponse
from app.schemas.requests import ContributionCreate, RequestCreate, RequestRead
from app.services.payments import create_payment
from app.services.queue import cancel_contribution, confirm_request, mark_request_played

router = APIRouter(tags=["requests"])
dj_router = APIRouter(prefix="/dj/requests", tags=["dj-requests"])


@router.get("/sessions/{session_id}/queue", response_model=list[RequestRead])
def get_queue(session_id: int, db: DBSession) -> list[RequestRead]:
    queue = get_session_queue(db, session_id)
    return [RequestRead.model_validate(item) for item in queue]


@router.post("/sessions/{session_id}/requests", response_model=RequestRead, status_code=status.HTTP_201_CREATED)
def create_request(
    session_id: int,
    payload: RequestCreate,
    db: DBSession,
    user: Annotated[User, Depends(get_current_user)],
) -> RequestRead:
    session = db.get(DJSession, session_id)
    if not session or not session.accepting_requests:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session not accepting requests")
    if payload.amount_cents < session.minimum_request_amount_cents:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Below minimum request amount")

    existing = db.scalar(
        select(SongRequest).where(SongRequest.session_id == session_id, SongRequest.song_id == payload.song_id)
    )
    if existing and existing.status in {RequestStatus.OPEN, RequestStatus.LOCKED, RequestStatus.CONFIRMED_BY_DJ}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Song already exists in queue; contribute instead")

    profile = db.get(DJProfile, session.dj_profile_id)
    request = SongRequest(
        session_id=session_id,
        song_id=payload.song_id,
        requested_by_user_id=user.id,
        status=RequestStatus.PENDING_PAYMENT,
        original_amount_cents=payload.amount_cents,
        total_amount_cents=0,
        currency=session.currency,
        note=payload.note,
    )
    db.add(request)
    db.flush()

    payment = create_payment(
        db=db,
        user_id=user.id,
        dj_profile_id=profile.id if profile else session.dj_profile_id,
        session_id=session_id,
        song_request_id=request.id,
        gross_amount_cents=payload.amount_cents,
    )
    contribution = Contribution(
        song_request_id=request.id,
        user_id=user.id,
        amount_cents=payload.amount_cents,
        currency=session.currency,
        status=ContributionStatus.PENDING_PAYMENT,
        payment_id=payment.id,
    )
    db.add(contribution)
    db.commit()
    db.refresh(request)
    return RequestRead.model_validate(request)


@router.get("/requests/{request_id}", response_model=RequestRead)
def get_request(request_id: int, db: DBSession) -> RequestRead:
    request = db.get(SongRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return RequestRead.model_validate(request)


@router.post("/requests/{request_id}/contribute", response_model=MessageResponse)
def contribute_to_request(
    request_id: int,
    payload: ContributionCreate,
    db: DBSession,
    user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    request = db.get(SongRequest, request_id)
    if not request or request.status != RequestStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not open for contributions")
    payment = create_payment(
        db=db,
        user_id=user.id,
        dj_profile_id=db.get(DJSession, request.session_id).dj_profile_id,
        session_id=request.session_id,
        song_request_id=request.id,
        gross_amount_cents=payload.amount_cents,
    )
    db.add(
        Contribution(
            song_request_id=request.id,
            user_id=user.id,
            amount_cents=payload.amount_cents,
            currency=request.currency,
            status=ContributionStatus.PENDING_PAYMENT,
            payment_id=payment.id,
        )
    )
    db.commit()
    return MessageResponse(message="Contribution checkout created")


@router.post("/requests/{request_id}/cancel", response_model=MessageResponse)
def cancel_request_contribution(
    request_id: int,
    db: DBSession,
    user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    request = db.get(SongRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    contribution = db.scalar(
        select(Contribution)
        .where(
            Contribution.song_request_id == request_id,
            Contribution.user_id == user.id,
            Contribution.status == ContributionStatus.SUCCEEDED,
        )
        .order_by(Contribution.created_at.desc())
    )
    if not contribution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No eligible contribution found")
    cancel_contribution(request, contribution.amount_cents)
    contribution.status = ContributionStatus.CANCELLED
    db.commit()
    return MessageResponse(message="Contribution cancelled")


@dj_router.post("/{request_id}/confirm", response_model=MessageResponse)
def confirm_song(
    request_id: int,
    db: DBSession,
    _user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> MessageResponse:
    request = db.get(SongRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    confirm_request(request)
    db.commit()
    return MessageResponse(message="Request confirmed")


@dj_router.post("/{request_id}/played", response_model=MessageResponse)
def mark_played(
    request_id: int,
    db: DBSession,
    _user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> MessageResponse:
    request = db.get(SongRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    mark_request_played(request)
    db.commit()
    return MessageResponse(message="Request marked played")


@dj_router.post("/{request_id}/reject", response_model=MessageResponse)
def reject_request(
    request_id: int,
    db: DBSession,
    _user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> MessageResponse:
    request = db.get(SongRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    request.status = RequestStatus.REJECTED
    db.commit()
    return MessageResponse(message="Request rejected")


@dj_router.post("/{request_id}/lock", response_model=MessageResponse)
def lock_request(
    request_id: int,
    db: DBSession,
    _user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> MessageResponse:
    request = db.get(SongRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    request.status = RequestStatus.LOCKED
    db.commit()
    return MessageResponse(message="Request locked")

