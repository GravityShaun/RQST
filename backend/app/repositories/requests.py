from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Contribution,
    ContributionStatus,
    DJProfile,
    DJSession,
    Payment,
    Song,
    SongRequest,
    User,
    Venue,
)
from app.schemas.requests import RequestContributorRead, RequestRead

VISIBLE_CONTRIBUTION_STATUSES = {
    ContributionStatus.PENDING_PAYMENT,
    ContributionStatus.SUCCEEDED,
}


def get_session_queue(db: Session, session_id: int) -> list[SongRequest]:
    stmt = (
        select(SongRequest)
        .where(SongRequest.session_id == session_id)
        .order_by(
            SongRequest.total_amount_cents.desc(),
            SongRequest.created_at.asc(),
            SongRequest.id.asc(),
        )
    )
    return list(db.scalars(stmt))


def build_request_read(
    db: Session,
    request: SongRequest,
    *,
    current_user_id: int | None = None,
) -> RequestRead:
    song = db.get(Song, request.song_id)
    session = db.get(DJSession, request.session_id)
    profile = db.get(DJProfile, session.dj_profile_id) if session else None
    venue = db.get(Venue, session.venue_id) if session else None
    requester = db.get(User, request.requested_by_user_id)
    contributions = list(
        db.scalars(
            select(Contribution)
            .where(
                Contribution.song_request_id == request.id,
                Contribution.status.in_(VISIBLE_CONTRIBUTION_STATUSES),
            )
            .order_by(Contribution.created_at.asc(), Contribution.id.asc())
        )
    )
    users_by_id = {
        user.id: user
        for user in db.scalars(select(User).where(User.id.in_({item.user_id for item in contributions})))
    }
    latest_payment = db.scalar(
        select(Payment)
        .where(Payment.song_request_id == request.id)
        .order_by(Payment.created_at.desc(), Payment.id.desc())
    )

    my_contribution_cents = sum(
        item.amount_cents for item in contributions if current_user_id is not None and item.user_id == current_user_id
    )
    contributor_user_ids = {item.user_id for item in contributions}
    contributor_reads = [
        RequestContributorRead(
            id=item.id,
            user_id=item.user_id,
            display_name=users_by_id.get(item.user_id).display_name
            if users_by_id.get(item.user_id)
            else "RQST listener",
            avatar_url=users_by_id.get(item.user_id).avatar_url if users_by_id.get(item.user_id) else None,
            amount_cents=item.amount_cents,
            currency=item.currency,
            status=item.status,
            created_at=item.created_at,
        )
        for item in contributions
    ]

    return RequestRead(
        id=request.id,
        session_id=request.session_id,
        song_id=request.song_id,
        requested_by_user_id=request.requested_by_user_id,
        status=request.status,
        original_amount_cents=request.original_amount_cents,
        total_amount_cents=request.total_amount_cents,
        currency=request.currency,
        note=request.note,
        rank_snapshot=request.rank_snapshot,
        confirmed_by_dj_at=request.confirmed_by_dj_at,
        played_at=request.played_at,
        rejected_at=request.rejected_at,
        cancelled_at=request.cancelled_at,
        created_at=request.created_at,
        updated_at=request.updated_at,
        song_title=song.title if song else None,
        song_artist=song.artist if song else None,
        song_album=song.album if song else None,
        song_album_art_url=song.album_art_url if song else None,
        dj_profile_id=profile.id if profile else None,
        dj_artist_name=profile.artist_name if profile else None,
        venue_id=venue.id if venue else None,
        venue_name=venue.name if venue else None,
        event_id=session.event_id if session else None,
        requester_display_name=requester.display_name if requester else None,
        requester_avatar_url=requester.avatar_url if requester else None,
        my_contribution_cents=my_contribution_cents,
        contributor_count=len(contributor_user_ids),
        latest_payment_id=latest_payment.id if latest_payment else None,
        latest_payment_status=latest_payment.status if latest_payment else None,
        checkout_url=latest_payment.checkout_url if latest_payment else None,
        contributors=contributor_reads,
    )


def build_request_reads(
    db: Session,
    requests: list[SongRequest],
    *,
    current_user_id: int | None = None,
) -> list[RequestRead]:
    return [build_request_read(db, item, current_user_id=current_user_id) for item in requests]
