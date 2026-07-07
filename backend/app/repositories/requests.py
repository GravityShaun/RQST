from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Contribution,
    ContributionStatus,
    DJProfile,
    DJSession,
    Event,
    Payment,
    RequestStatus,
    Song,
    SongRequest,
    User,
    Venue,
)
from app.services.queue import INACTIVE_QUEUE_STATUSES, QUEUE_INACTIVE_STATUSES
from app.schemas.requests import RequestContributorRead, RequestRead

VISIBLE_CONTRIBUTION_STATUSES = {
    ContributionStatus.PENDING_PAYMENT,
    ContributionStatus.SUCCEEDED,
}

ACCOUNTED_CONTRIBUTION_STATUSES = {
    ContributionStatus.SUCCEEDED,
}


def _aggregate_contributors_per_user(
    contributions: list[Contribution],
    users_by_id: dict[int, User],
) -> list[RequestContributorRead]:
    grouped: dict[int, list[Contribution]] = {}
    for item in contributions:
        grouped.setdefault(item.user_id, []).append(item)

    aggregated: list[RequestContributorRead] = []
    for user_id, user_contributions in grouped.items():
        user_contributions.sort(key=lambda item: (item.created_at, item.id))
        earliest = user_contributions[0]
        user = users_by_id.get(user_id)
        aggregated.append(
            RequestContributorRead(
                id=earliest.id,
                user_id=user_id,
                display_name=user.display_name if user else "RQST listener",
                avatar_url=user.avatar_url if user else None,
                amount_cents=sum(item.amount_cents for item in user_contributions),
                currency=earliest.currency,
                is_initial=any(item.is_initial for item in user_contributions),
                status=(
                    ContributionStatus.PENDING_PAYMENT
                    if any(item.status == ContributionStatus.PENDING_PAYMENT for item in user_contributions)
                    else ContributionStatus.SUCCEEDED
                ),
                created_at=earliest.created_at,
            )
        )

    aggregated.sort(key=lambda item: (item.created_at, item.id))
    return aggregated


def _compute_contribution_amounts(
    contributions: list[Contribution],
    *,
    current_user_id: int | None,
    requested_by_user_id: int,
) -> dict[str, int]:
    visible_contributions = [
        item for item in contributions if item.status in VISIBLE_CONTRIBUTION_STATUSES
    ]
    succeeded_contributions = sorted(
        [item for item in contributions if item.status in ACCOUNTED_CONTRIBUTION_STATUSES],
        key=lambda item: (item.created_at, item.id),
    )
    pool_total_cents = sum(item.amount_cents for item in succeeded_contributions)
    pool_original_cents = sum(item.amount_cents for item in succeeded_contributions if item.is_initial)
    added_amount_cents = sum(
        item.amount_cents for item in succeeded_contributions if not item.is_initial
    )

    if current_user_id is None:
        return {
            "my_contribution_cents": 0,
            "my_original_contribution_cents": 0,
            "my_added_contribution_cents": 0,
            "pool_total_cents": pool_total_cents,
            "pool_original_cents": pool_original_cents,
            "added_amount_cents": added_amount_cents,
        }

    user_visible = [item for item in visible_contributions if item.user_id == current_user_id]
    user_succeeded = [item for item in succeeded_contributions if item.user_id == current_user_id]
    my_contribution_cents = sum(item.amount_cents for item in user_visible)

    if current_user_id == requested_by_user_id:
        my_original_contribution_cents = sum(
            item.amount_cents for item in user_visible if item.is_initial
        )
        my_added_contribution_cents = sum(
            item.amount_cents for item in user_succeeded if not item.is_initial
        )
    else:
        my_original_contribution_cents = 0
        my_added_contribution_cents = sum(
            item.amount_cents for item in user_succeeded if not item.is_initial
        )

    return {
        "my_contribution_cents": my_contribution_cents,
        "my_original_contribution_cents": my_original_contribution_cents,
        "my_added_contribution_cents": my_added_contribution_cents,
        "pool_total_cents": pool_total_cents,
        "pool_original_cents": pool_original_cents,
        "added_amount_cents": added_amount_cents,
    }


def get_session_queue(db: Session, session_id: int) -> list[SongRequest]:
    session = db.get(DJSession, session_id)
    if session is None:
        return []

    filters = [
        SongRequest.session_id == session_id,
        SongRequest.status.not_in(QUEUE_INACTIVE_STATUSES),
    ]
    if session.event_id is not None:
        filters.append(SongRequest.event_id == session.event_id)

    stmt = (
        select(SongRequest)
        .where(*filters)
        .order_by(
            SongRequest.total_amount_cents.desc(),
            SongRequest.created_at.asc(),
            SongRequest.id.asc(),
        )
    )
    return list(db.scalars(stmt))


def find_active_song_request(db: Session, session: DJSession, song_id: int) -> SongRequest | None:
    filters = [
        SongRequest.session_id == session.id,
        SongRequest.song_id == song_id,
        SongRequest.status.not_in(QUEUE_INACTIVE_STATUSES),
    ]
    if session.event_id is not None:
        filters.append(SongRequest.event_id == session.event_id)

    return db.scalar(select(SongRequest).where(*filters))


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
    event_id = request.event_id or (session.event_id if session else None)
    event = db.get(Event, event_id) if event_id else None
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

    contribution_amounts = _compute_contribution_amounts(
        contributions,
        current_user_id=current_user_id,
        requested_by_user_id=request.requested_by_user_id,
    )
    individual_contributor_reads = [
        RequestContributorRead(
            id=item.id,
            user_id=item.user_id,
            display_name=users_by_id.get(item.user_id).display_name
            if users_by_id.get(item.user_id)
            else "RQST listener",
            avatar_url=users_by_id.get(item.user_id).avatar_url if users_by_id.get(item.user_id) else None,
            amount_cents=item.amount_cents,
            currency=item.currency,
            is_initial=item.is_initial,
            status=item.status,
            created_at=item.created_at,
        )
        for item in contributions
    ]
    contributor_reads = _aggregate_contributors_per_user(contributions, users_by_id)
    my_added_contributions = [
        item
        for item in individual_contributor_reads
        if current_user_id is not None and item.user_id == current_user_id and not item.is_initial
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
        event_id=event_id,
        event_name=event.name if event else None,
        requester_display_name=requester.display_name if requester else None,
        requester_avatar_url=requester.avatar_url if requester else None,
        my_contribution_cents=contribution_amounts["my_contribution_cents"],
        my_original_contribution_cents=contribution_amounts["my_original_contribution_cents"],
        my_added_contribution_cents=contribution_amounts["my_added_contribution_cents"],
        total_pool_cents=contribution_amounts["pool_total_cents"],
        pool_original_cents=contribution_amounts["pool_original_cents"],
        added_amount_cents=contribution_amounts["added_amount_cents"],
        my_added_contributions=my_added_contributions,
        contributor_count=len(contributor_reads),
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
