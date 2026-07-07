from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, desc, func, select

from app.api.deps import DBSession, require_role
from app.models import (
    Contribution,
    ContributionStatus,
    DJEarningsLedger,
    DJProfile,
    DJSession,
    LedgerStatus,
    Payment,
    PaymentStatus,
    RefreshToken,
    Report,
    RequestStatus,
    SessionStatus,
    Song,
    SongRequest,
    User,
    UserRole,
    Venue,
)
from app.realtime.queue import schedule_session_queue_broadcast
from app.schemas.admin import (
    AdminDjSummary,
    AdminOverview,
    AdminPaymentActionRequest,
    AdminPaymentSummary,
    AdminPaymentsOverview,
    AdminReportSummary,
    AdminSessionSummary,
    AdminSessionUpdate,
    AdminUserSummary,
    AdminUserUpdate,
)
from app.schemas.common import MessageResponse
from app.services.dj_profiles import ensure_dj_profile_for_user
from app.services.queue import cancel_contribution

router = APIRouter(prefix="/admin", tags=["admin"])
AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]


def _payment_overview(db: DBSession) -> AdminPaymentsOverview:
    row = db.execute(
        select(
            func.coalesce(func.sum(Payment.gross_amount_cents), 0),
            func.coalesce(func.sum(Payment.net_amount_cents), 0),
            func.coalesce(func.sum(Payment.platform_fee_cents), 0),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status == PaymentStatus.PAYMENT_REFUNDED, Payment.gross_amount_cents),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(func.sum(case((Payment.status == PaymentStatus.PAYMENT_SUCCEEDED, 1), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(
                        (
                            Payment.status.in_(
                                [
                                    PaymentStatus.PAYMENT_CREATED,
                                    PaymentStatus.CHECKOUT_STARTED,
                                    PaymentStatus.PAYMENT_PENDING,
                                    PaymentStatus.PAYMENT_AUTHORIZED,
                                ]
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(func.sum(case((Payment.status == PaymentStatus.PAYMENT_FAILED, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Payment.status == PaymentStatus.PAYMENT_DISPUTED, 1), else_=0)), 0),
            func.coalesce(func.min(Payment.currency), "USD"),
        )
    ).one()

    return AdminPaymentsOverview(
        total_gross_cents=row[0],
        total_net_cents=row[1],
        total_platform_fees_cents=row[2],
        total_refunded_cents=row[3],
        succeeded_count=row[4],
        pending_count=row[5],
        failed_count=row[6],
        disputed_count=row[7],
        currency=row[8],
    )


@router.get("/overview", response_model=AdminOverview)
def get_admin_overview(db: DBSession, _user: AdminUser) -> AdminOverview:
    return AdminOverview(
        total_users=db.scalar(select(func.count()).select_from(User)) or 0,
        active_users=db.scalar(select(func.count()).select_from(User).where(User.deleted_at.is_(None))) or 0,
        total_djs=db.scalar(select(func.count()).select_from(DJProfile)) or 0,
        live_sessions=(
            db.scalar(select(func.count()).select_from(DJSession).where(DJSession.status == SessionStatus.LIVE)) or 0
        ),
        open_reports=db.scalar(select(func.count()).select_from(Report).where(Report.status == "open")) or 0,
        payments_overview=_payment_overview(db),
    )


@router.get("/users", response_model=list[AdminUserSummary])
def get_admin_users(db: DBSession, _user: AdminUser) -> list[AdminUserSummary]:
    request_counts = (
        select(SongRequest.requested_by_user_id.label("user_id"), func.count(SongRequest.id).label("request_count"))
        .group_by(SongRequest.requested_by_user_id)
        .subquery()
    )
    payment_totals = (
        select(Payment.user_id.label("user_id"), func.coalesce(func.sum(Payment.gross_amount_cents), 0).label("total"))
        .where(Payment.status == PaymentStatus.PAYMENT_SUCCEEDED)
        .group_by(Payment.user_id)
        .subquery()
    )
    rows = db.execute(
        select(User, func.coalesce(request_counts.c.request_count, 0), func.coalesce(payment_totals.c.total, 0))
        .outerjoin(request_counts, request_counts.c.user_id == User.id)
        .outerjoin(payment_totals, payment_totals.c.user_id == User.id)
        .order_by(desc(User.created_at))
    ).all()
    return [
        AdminUserSummary(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_email_verified=user.is_email_verified,
            deleted_at=user.deleted_at,
            created_at=user.created_at,
            request_count=request_count,
            payment_total_cents=payment_total,
        )
        for user, request_count, payment_total in rows
    ]


@router.patch("/users/{user_id}", response_model=AdminUserSummary)
def update_admin_user(user_id: int, payload: AdminUserUpdate, db: DBSession, _user: AdminUser) -> AdminUserSummary:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.role is not None:
        user.role = payload.role
    if payload.is_email_verified is not None:
        user.is_email_verified = payload.is_email_verified
    if payload.display_name is not None:
        user.display_name = payload.display_name

    ensure_dj_profile_for_user(db, user)
    db.commit()
    db.refresh(user)
    return AdminUserSummary(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_email_verified=user.is_email_verified,
        deleted_at=user.deleted_at,
        created_at=user.created_at,
    )


@router.delete("/users/{user_id}", response_model=MessageResponse)
def delete_admin_user(user_id: int, db: DBSession, admin_user: AdminUser) -> MessageResponse:
    if user_id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admins cannot delete themselves")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.deleted_at = datetime.now(UTC)
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).update(
        {"revoked_at": user.deleted_at},
        synchronize_session=False,
    )
    db.commit()
    return MessageResponse(message=f"User {user_id} deleted")


@router.post("/users/{user_id}/restore", response_model=MessageResponse)
def restore_admin_user(user_id: int, db: DBSession, _user: AdminUser) -> MessageResponse:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.deleted_at = None
    db.commit()
    return MessageResponse(message=f"User {user_id} restored")


@router.get("/payments", response_model=list[AdminPaymentSummary])
def get_admin_payments(db: DBSession, _user: AdminUser) -> list[AdminPaymentSummary]:
    rows = db.execute(
        select(Payment, User, DJProfile, SongRequest, Song)
        .join(User, User.id == Payment.user_id)
        .join(DJProfile, DJProfile.id == Payment.dj_profile_id)
        .join(SongRequest, SongRequest.id == Payment.song_request_id)
        .join(Song, Song.id == SongRequest.song_id)
        .order_by(desc(Payment.created_at))
    ).all()
    return [
        AdminPaymentSummary(
            id=payment.id,
            user_id=user.id,
            user_email=user.email,
            user_display_name=user.display_name,
            dj_profile_id=dj.id,
            dj_artist_name=dj.artist_name,
            session_id=payment.session_id,
            song_request_id=payment.song_request_id,
            gross_amount_cents=payment.gross_amount_cents,
            net_amount_cents=payment.net_amount_cents,
            platform_fee_cents=payment.platform_fee_cents,
            processing_fee_cents=payment.processing_fee_cents,
            currency=payment.currency,
            status=payment.status,
            provider=payment.provider,
            provider_payment_id=payment.provider_payment_id,
            succeeded_at=payment.succeeded_at,
            refunded_at=payment.refunded_at,
            created_at=payment.created_at,
            song_title=song.title,
            song_artist=song.artist,
        )
        for payment, user, dj, request, song in rows
    ]


def _apply_payment_action(db: DBSession, payment_id: int, action: PaymentStatus) -> MessageResponse:
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    request = db.get(SongRequest, payment.song_request_id)
    contribution = db.scalar(select(Contribution).where(Contribution.payment_id == payment.id))
    if not request or not contribution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment request not found")

    if action == PaymentStatus.PAYMENT_REFUNDED:
        payment.status = PaymentStatus.PAYMENT_REFUNDED
        payment.refunded_at = datetime.now(UTC)
        contribution.status = ContributionStatus.REFUNDED
        contribution.refunded_at = payment.refunded_at
        if request.status == RequestStatus.OPEN:
            cancel_contribution(request, contribution.amount_cents)
        if request.total_amount_cents <= 0:
            request.status = RequestStatus.REFUNDED
        ledger_status = LedgerStatus.REVERSED
        message = f"Payment {payment_id} refunded"
    else:
        payment.status = PaymentStatus.PAYMENT_DISPUTED
        contribution.status = ContributionStatus.DISPUTED
        request.status = RequestStatus.DISPUTED
        ledger_status = LedgerStatus.ON_HOLD
        message = f"Payment {payment_id} marked as chargeback"

    db.query(DJEarningsLedger).filter(DJEarningsLedger.payment_id == payment.id).update(
        {"status": ledger_status},
        synchronize_session=False,
    )
    db.commit()
    schedule_session_queue_broadcast(payment.session_id)
    return MessageResponse(message=message)


@router.post("/payments/{payment_id}/refund", response_model=MessageResponse)
def refund_admin_payment(
    payment_id: int,
    _payload: AdminPaymentActionRequest,
    db: DBSession,
    _user: AdminUser,
) -> MessageResponse:
    return _apply_payment_action(db, payment_id, PaymentStatus.PAYMENT_REFUNDED)


@router.post("/payments/{payment_id}/chargeback", response_model=MessageResponse)
def chargeback_admin_payment(
    payment_id: int,
    _payload: AdminPaymentActionRequest,
    db: DBSession,
    _user: AdminUser,
) -> MessageResponse:
    return _apply_payment_action(db, payment_id, PaymentStatus.PAYMENT_DISPUTED)


@router.get("/djs", response_model=list[AdminDjSummary])
def get_admin_djs(db: DBSession, _user: AdminUser) -> list[AdminDjSummary]:
    earnings = (
        select(
            DJEarningsLedger.dj_profile_id.label("dj_profile_id"),
            func.coalesce(func.sum(DJEarningsLedger.amount_cents), 0).label("total"),
        )
        .where(DJEarningsLedger.status != LedgerStatus.REVERSED)
        .group_by(DJEarningsLedger.dj_profile_id)
        .subquery()
    )
    sessions = (
        select(
            DJSession.dj_profile_id.label("dj_profile_id"),
            func.count(DJSession.id).label("session_count"),
            func.max(case((DJSession.status == SessionStatus.LIVE, DJSession.id), else_=None)).label("live_session_id"),
        )
        .group_by(DJSession.dj_profile_id)
        .subquery()
    )
    rows = db.execute(
        select(
            DJProfile,
            User,
            func.coalesce(earnings.c.total, 0),
            func.coalesce(sessions.c.session_count, 0),
            sessions.c.live_session_id,
        )
        .join(User, User.id == DJProfile.user_id)
        .outerjoin(earnings, earnings.c.dj_profile_id == DJProfile.id)
        .outerjoin(sessions, sessions.c.dj_profile_id == DJProfile.id)
        .order_by(DJProfile.artist_name)
    ).all()
    return [
        AdminDjSummary(
            id=dj.id,
            user_id=dj.user_id,
            artist_name=dj.artist_name,
            slug=dj.slug,
            city=dj.city,
            is_public=dj.is_public,
            user_email=user.email,
            live_session_id=live_session_id,
            total_earnings_cents=earnings_total,
            session_count=session_count,
            created_at=dj.created_at,
        )
        for dj, user, earnings_total, session_count, live_session_id in rows
    ]


@router.get("/sessions", response_model=list[AdminSessionSummary])
def get_admin_sessions(db: DBSession, _user: AdminUser) -> list[AdminSessionSummary]:
    request_counts = (
        select(SongRequest.session_id.label("session_id"), func.count(SongRequest.id).label("request_count"))
        .group_by(SongRequest.session_id)
        .subquery()
    )
    payment_totals = (
        select(Payment.session_id.label("session_id"), func.coalesce(func.sum(Payment.gross_amount_cents), 0).label("total"))
        .where(Payment.status == PaymentStatus.PAYMENT_SUCCEEDED)
        .group_by(Payment.session_id)
        .subquery()
    )
    rows = db.execute(
        select(
            DJSession,
            DJProfile,
            Venue,
            func.coalesce(request_counts.c.request_count, 0),
            func.coalesce(payment_totals.c.total, 0),
        )
        .join(DJProfile, DJProfile.id == DJSession.dj_profile_id)
        .join(Venue, Venue.id == DJSession.venue_id)
        .outerjoin(request_counts, request_counts.c.session_id == DJSession.id)
        .outerjoin(payment_totals, payment_totals.c.session_id == DJSession.id)
        .order_by(desc(DJSession.created_at))
    ).all()
    return [
        AdminSessionSummary(
            id=session.id,
            dj_profile_id=dj.id,
            dj_artist_name=dj.artist_name,
            venue_name=venue.name,
            event_name=None,
            status=session.status,
            accepting_requests=session.accepting_requests,
            minimum_request_amount_cents=session.minimum_request_amount_cents,
            started_at=session.started_at,
            ended_at=session.ended_at,
            request_count=request_count,
            gross_payments_cents=gross_payments,
        )
        for session, dj, venue, request_count, gross_payments in rows
    ]


@router.patch("/sessions/{session_id}", response_model=AdminSessionSummary)
def update_admin_session(
    session_id: int,
    payload: AdminSessionUpdate,
    db: DBSession,
    _user: AdminUser,
) -> AdminSessionSummary:
    session = db.get(DJSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if payload.accepting_requests is not None:
        session.accepting_requests = payload.accepting_requests
    if payload.minimum_request_amount_cents is not None:
        session.minimum_request_amount_cents = payload.minimum_request_amount_cents
    db.commit()
    schedule_session_queue_broadcast(session.id)

    dj = db.get(DJProfile, session.dj_profile_id)
    venue = db.get(Venue, session.venue_id)
    return AdminSessionSummary(
        id=session.id,
        dj_profile_id=session.dj_profile_id,
        dj_artist_name=dj.artist_name if dj else "Unknown DJ",
        venue_name=venue.name if venue else "Unknown venue",
        status=session.status,
        accepting_requests=session.accepting_requests,
        minimum_request_amount_cents=session.minimum_request_amount_cents,
        started_at=session.started_at,
        ended_at=session.ended_at,
    )


@router.get("/reports", response_model=list[AdminReportSummary])
def get_admin_reports(db: DBSession, _user: AdminUser) -> list[AdminReportSummary]:
    rows = db.execute(
        select(Report, User)
        .join(User, User.id == Report.reporter_user_id)
        .order_by(Report.status, desc(Report.created_at))
    ).all()
    return [
        AdminReportSummary(
            id=report.id,
            reporter_user_id=report.reporter_user_id,
            reporter_display_name=user.display_name,
            target_type=report.target_type,
            target_id=report.target_id,
            reason=report.reason,
            status=report.status,
            created_at=report.created_at,
        )
        for report, user in rows
    ]


@router.post("/reports/{report_id}/resolve", response_model=MessageResponse)
def resolve_report(
    report_id: int,
    db: DBSession,
    _user: AdminUser,
) -> MessageResponse:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report.status = "resolved"
    db.commit()
    return MessageResponse(message=f"Report {report_id} resolved")
