from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, require_role
from app.models import (
    Contribution,
    ContributionStatus,
    DJProfile,
    DJSession,
    RequestStatus,
    SessionStatus,
    Song,
    SongRequest,
    User,
    UserRole,
)
from app.repositories.requests import build_request_read, build_request_reads, find_active_song_request, get_session_queue
from app.realtime.queue import schedule_session_queue_broadcast
from app.schemas.common import MessageResponse
from app.schemas.requests import ContributionCreate, RequestCreate, RequestRead
from app.services.dj_sessions import get_active_dj_session
from app.services.earnings import credit_ledger_for_played_request, reverse_ledger_for_request
from app.services.event_sessions import resolve_event_id_for_session
from app.services.payments import create_payment, maybe_auto_complete_payment
from app.services.queue import (
    assert_request_undo_allowed,
    cancel_contribution,
    cancel_mismatched_open_requests,
    confirm_request,
    delete_song_request,
    mark_request_played,
)

router = APIRouter(tags=["requests"])
dj_router = APIRouter(prefix="/dj/requests", tags=["dj-requests"])


def _get_live_session_or_none(db: DBSession, session_id: int) -> DJSession | None:
    session = db.get(DJSession, session_id)
    if not session or session.status != SessionStatus.LIVE:
        return None
    return session


@router.get("/sessions/{session_id}/queue", response_model=list[RequestRead])
def get_queue(session_id: int, db: DBSession) -> list[RequestRead]:
    if _get_live_session_or_none(db, session_id) is None:
        return []
    queue = get_session_queue(db, session_id)
    return build_request_reads(db, queue)


@router.get("/sessions/{session_id}/requests", response_model=list[RequestRead])
def get_session_requests(session_id: int, db: DBSession) -> list[RequestRead]:
    if _get_live_session_or_none(db, session_id) is None:
        return []
    queue = get_session_queue(db, session_id)
    return build_request_reads(db, queue)


@router.post("/sessions/{session_id}/requests", response_model=RequestRead, status_code=status.HTTP_201_CREATED)
def create_request(
    session_id: int,
    payload: RequestCreate,
    db: DBSession,
    user: Annotated[User, Depends(get_current_user)],
) -> RequestRead:
    session = db.get(DJSession, session_id)
    if (
        not session
        or session.status != SessionStatus.LIVE
        or not session.accepting_requests
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session not accepting requests")
    if payload.amount_cents < session.minimum_request_amount_cents:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Below minimum request amount")

    song = _resolve_request_song(db, payload)
    if not song:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Song metadata is required")

    event_id = resolve_event_id_for_session(db, session)
    cancel_mismatched_open_requests(db, session)
    existing = find_active_song_request(db, session, song.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Song already exists in queue; contribute instead")

    profile = db.get(DJProfile, session.dj_profile_id)
    request = SongRequest(
        session_id=session_id,
        event_id=event_id,
        song_id=song.id,
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
        is_initial=True,
        status=ContributionStatus.PENDING_PAYMENT,
        payment_id=payment.id,
    )
    db.add(contribution)
    db.flush()
    maybe_auto_complete_payment(db, payment=payment, contribution=contribution, request=request)
    db.commit()
    db.refresh(request)
    schedule_session_queue_broadcast(session_id)
    return build_request_read(db, request, current_user_id=user.id)


def _resolve_request_song(db: DBSession, payload: RequestCreate) -> Song | None:
    song = db.get(Song, payload.song_id) if payload.song_id is not None else None
    snapshot = payload.song

    if not song and snapshot and snapshot.external_source and snapshot.external_id:
        song = db.scalar(
            select(Song).where(
                Song.external_source == snapshot.external_source,
                Song.external_id == snapshot.external_id,
            )
        )

    if not song and snapshot:
        song = db.scalar(
            select(Song).where(
                Song.title == snapshot.title,
                Song.artist == snapshot.artist,
                Song.album == snapshot.album,
            )
        )

    if not song and snapshot:
        song = Song(
            title=snapshot.title,
            artist=snapshot.artist,
            album=snapshot.album,
            duration_ms=snapshot.duration_ms,
            album_art_url=snapshot.album_art_url,
            isrc=snapshot.isrc,
            external_source=snapshot.external_source,
            external_id=snapshot.external_id,
            explicit=snapshot.explicit,
        )
        db.add(song)
        db.flush()
        return song

    if song and snapshot:
        song.title = snapshot.title
        song.artist = snapshot.artist
        if snapshot.album is not None:
            song.album = snapshot.album
        if snapshot.duration_ms is not None:
            song.duration_ms = snapshot.duration_ms
        if snapshot.album_art_url is not None:
            song.album_art_url = snapshot.album_art_url
        if snapshot.isrc is not None:
            song.isrc = snapshot.isrc
        if snapshot.external_source is not None:
            song.external_source = snapshot.external_source
        if snapshot.external_id is not None:
            song.external_id = snapshot.external_id
        song.explicit = snapshot.explicit
        db.flush()

    return song


@router.get("/requests/{request_id}", response_model=RequestRead)
def get_request(request_id: int, db: DBSession) -> RequestRead:
    request = db.get(SongRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return build_request_read(db, request)


@router.post("/requests/{request_id}/contribute", response_model=RequestRead)
def contribute_to_request(
    request_id: int,
    payload: ContributionCreate,
    db: DBSession,
    user: Annotated[User, Depends(get_current_user)],
) -> RequestRead:
    request = db.get(SongRequest, request_id)
    if not request or request.status != RequestStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not open for contributions")
    session = db.get(DJSession, request.session_id)
    payment = create_payment(
        db=db,
        user_id=user.id,
        dj_profile_id=session.dj_profile_id,
        session_id=request.session_id,
        song_request_id=request.id,
        gross_amount_cents=payload.amount_cents,
    )
    contribution = Contribution(
        song_request_id=request.id,
        user_id=user.id,
        amount_cents=payload.amount_cents,
        currency=request.currency,
        is_initial=False,
        status=ContributionStatus.PENDING_PAYMENT,
        payment_id=payment.id,
    )
    db.add(contribution)
    db.flush()
    maybe_auto_complete_payment(db, payment=payment, contribution=contribution, request=request)
    db.commit()
    db.refresh(request)
    schedule_session_queue_broadcast(request.session_id)
    return build_request_read(db, request, current_user_id=user.id)


@dj_router.get("/current", response_model=list[RequestRead])
def get_current_dj_requests(
    db: DBSession,
    user: Annotated[User, Depends(require_role(UserRole.DJ, UserRole.ADMIN))],
) -> list[RequestRead]:
    profile = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if not profile:
        return []
    session = get_active_dj_session(db, profile.id)
    if not session:
        return []
    return build_request_reads(db, get_session_queue(db, session.id))


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
    schedule_session_queue_broadcast(request.session_id)
    return MessageResponse(message="Contribution cancelled")


@router.post("/requests/{request_id}/undo", response_model=MessageResponse)
def undo_request(
    request_id: int,
    db: DBSession,
    user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    request = db.get(SongRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if request.requested_by_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your request")

    assert_request_undo_allowed(request)

    if request.status not in {RequestStatus.PENDING_PAYMENT, RequestStatus.OPEN}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request can no longer be undone")

    session_id = request.session_id
    delete_song_request(db, request)
    db.commit()
    schedule_session_queue_broadcast(session_id)
    return MessageResponse(message="Request removed")


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
    schedule_session_queue_broadcast(request.session_id)
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
    credit_ledger_for_played_request(db, request.id)
    db.commit()
    schedule_session_queue_broadcast(request.session_id)
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
    reverse_ledger_for_request(db, request.id)
    db.commit()
    schedule_session_queue_broadcast(request.session_id)
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
    schedule_session_queue_broadcast(request.session_id)
    return MessageResponse(message="Request locked")
