from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    DJEarningsLedger,
    DJSession,
    Event,
    LedgerStatus,
    Payment,
    RequestStatus,
    SessionStatus,
    Song,
    SongRequest,
    Venue,
)
from app.schemas.earnings import (
    DjEarningsDashboardRead,
    EarningsSummaryRead,
    LedgerEntryRead,
    PlayedSongEarningsRead,
    ShowEarningsRead,
)
from app.services.payments import calculate_fees

ACTIVE_SESSION_STATUSES = {SessionStatus.LIVE, SessionStatus.PAUSED}


def credit_ledger_for_played_request(
    db: Session,
    song_request_id: int,
    *,
    include_shoutout: bool = True,
) -> None:
    """Move paid-but-unplayed ledger rows into the active show pool."""
    request = db.get(SongRequest, song_request_id)
    for entry in db.scalars(
        select(DJEarningsLedger).where(
            DJEarningsLedger.song_request_id == song_request_id,
            DJEarningsLedger.status == LedgerStatus.PENDING_CONFIRMATION,
        )
    ):
        if (
            request
            and (request.shoutout_amount_cents or 0) > 0
            and not include_shoutout
        ):
            _, _, shoutout_net = calculate_fees(request.shoutout_amount_cents)
            entry.amount_cents = max(0, entry.amount_cents - shoutout_net)
        entry.status = LedgerStatus.AVAILABLE
    db.flush()


def settle_session_earnings(db: Session, session_id: int) -> None:
    """When a show ends, release pooled earnings into the withdrawable wallet."""
    now = datetime.now(UTC)
    db.flush()
    for entry in db.scalars(
        select(DJEarningsLedger).where(
            DJEarningsLedger.session_id == session_id,
            DJEarningsLedger.status == LedgerStatus.AVAILABLE,
            DJEarningsLedger.available_at.is_(None),
        )
    ):
        entry.available_at = now
    db.flush()


def reverse_ledger_for_request(db: Session, song_request_id: int) -> None:
    for entry in db.scalars(
        select(DJEarningsLedger).where(
            DJEarningsLedger.song_request_id == song_request_id,
            DJEarningsLedger.status.in_(
                (LedgerStatus.PENDING_CONFIRMATION, LedgerStatus.AVAILABLE),
            ),
        )
    ):
        entry.status = LedgerStatus.REVERSED


def _wallet_available_cents(entries: list[_LedgerContext]) -> int:
    return sum(
        entry.ledger.amount_cents
        for entry in entries
        if entry.ledger.status == LedgerStatus.AVAILABLE and entry.ledger.available_at is not None
    )


@dataclass(slots=True)
class _LedgerContext:
    ledger: DJEarningsLedger
    payment: Payment
    request: SongRequest | None
    song: Song | None
    session: DJSession
    venue: Venue | None
    event: Event | None


def _load_ledger_contexts(db: Session, dj_profile_id: int) -> list[_LedgerContext]:
    rows = db.execute(
        select(DJEarningsLedger, Payment, SongRequest, Song, DJSession, Venue, Event)
        .join(Payment, Payment.id == DJEarningsLedger.payment_id)
        .join(SongRequest, SongRequest.id == DJEarningsLedger.song_request_id, isouter=True)
        .join(Song, Song.id == SongRequest.song_id, isouter=True)
        .join(DJSession, DJSession.id == DJEarningsLedger.session_id)
        .join(Venue, Venue.id == DJSession.venue_id, isouter=True)
        .join(Event, Event.id == DJSession.event_id, isouter=True)
        .where(
            DJEarningsLedger.dj_profile_id == dj_profile_id,
            DJEarningsLedger.status != LedgerStatus.REVERSED,
        )
        .order_by(DJEarningsLedger.created_at.desc())
    ).all()

    return [
        _LedgerContext(
            ledger=ledger,
            payment=payment,
            request=request,
            song=song,
            session=session,
            venue=venue,
            event=event,
        )
        for ledger, payment, request, song, session, venue, event in rows
    ]


def _entry_show_pool_cents(entry: _LedgerContext) -> int:
    if entry.ledger.status != LedgerStatus.AVAILABLE or entry.ledger.available_at is not None:
        return 0
    if entry.session.status not in ACTIVE_SESSION_STATUSES:
        return 0
    return entry.ledger.amount_cents


def _entry_wallet_cents(entry: _LedgerContext) -> int:
    if entry.ledger.status != LedgerStatus.AVAILABLE or entry.ledger.available_at is None:
        return 0
    return entry.ledger.amount_cents


def _entry_pending_cents(entry: _LedgerContext) -> int:
    if entry.ledger.status != LedgerStatus.PENDING_CONFIRMATION:
        return 0
    return entry.ledger.amount_cents


def build_earnings_dashboard(db: Session, dj_profile_id: int) -> DjEarningsDashboardRead:
    contexts = _load_ledger_contexts(db, dj_profile_id)
    currency = contexts[0].ledger.currency if contexts else "USD"

    lifetime_gross = sum(item.payment.gross_amount_cents for item in contexts)
    lifetime_net = sum(item.ledger.amount_cents for item in contexts if item.ledger.status != LedgerStatus.PAID_OUT)
    platform_fees = sum(item.payment.platform_fee_cents for item in contexts)
    processing_fees = sum(item.payment.processing_fee_cents for item in contexts)
    pending_confirmation = sum(_entry_pending_cents(item) for item in contexts)
    show_pool = sum(_entry_show_pool_cents(item) for item in contexts)
    wallet_available = sum(_entry_wallet_cents(item) for item in contexts)
    paid_out = sum(
        item.ledger.amount_cents for item in contexts if item.ledger.status == LedgerStatus.PAID_OUT
    )

    summary = EarningsSummaryRead(
        lifetime_gross_cents=lifetime_gross,
        lifetime_net_cents=lifetime_net,
        pending_confirmation_cents=pending_confirmation,
        show_pool_cents=show_pool,
        wallet_available_cents=wallet_available,
        paid_out_cents=paid_out,
        platform_fees_cents=platform_fees,
        processing_fees_cents=processing_fees,
        polar_connected=False,
        currency=currency,
    )

    shows = _build_show_summaries(contexts)
    recent_entries = _build_recent_played_entries(contexts)

    return DjEarningsDashboardRead(
        summary=summary,
        shows=shows,
        recent_entries=recent_entries,
    )


def _build_show_summaries(contexts: list[_LedgerContext]) -> list[ShowEarningsRead]:
    by_session: dict[int, list[_LedgerContext]] = {}
    for item in contexts:
        by_session.setdefault(item.session.id, []).append(item)

    shows: list[ShowEarningsRead] = []
    for session_id, entries in by_session.items():
        session = entries[0].session
        venue = entries[0].venue
        event = entries[0].event
        played_request_ids = {
            entry.request.id
            for entry in entries
            if entry.request is not None and entry.request.status == RequestStatus.PLAYED
        }
        pending_request_ids = {
            entry.request.id
            for entry in entries
            if entry.request is not None and entry.ledger.status == LedgerStatus.PENDING_CONFIRMATION
        }

        shows.append(
            ShowEarningsRead(
                session_id=session_id,
                event_id=session.event_id,
                event_name=event.name if event else None,
                venue_name=venue.name if venue else "Unknown venue",
                status=session.status,
                started_at=session.started_at,
                ended_at=session.ended_at,
                gross_cents=sum(entry.payment.gross_amount_cents for entry in entries),
                net_cents=sum(entry.ledger.amount_cents for entry in entries),
                show_pool_cents=sum(_entry_show_pool_cents(entry) for entry in entries),
                wallet_cents=sum(_entry_wallet_cents(entry) for entry in entries),
                pending_cents=sum(_entry_pending_cents(entry) for entry in entries),
                songs_played=len(played_request_ids),
                songs_pending=len(pending_request_ids),
            )
        )

    shows.sort(
        key=lambda item: (
            item.started_at or datetime.min.replace(tzinfo=UTC),
            item.session_id,
        ),
        reverse=True,
    )
    return shows


def _derive_payout_status(entries: list[_LedgerContext]) -> str:
    active_entries = [entry for entry in entries if entry.ledger.status != LedgerStatus.REVERSED]
    if not active_entries:
        return "show_pool"

    if all(entry.ledger.status == LedgerStatus.PAID_OUT for entry in active_entries):
        return "paid_out"

    if any(
        entry.ledger.status == LedgerStatus.AVAILABLE and entry.ledger.available_at is not None
        for entry in active_entries
    ):
        return "in_wallet"

    return "show_pool"


def _build_recent_played_entries(contexts: list[_LedgerContext], *, limit: int = 50) -> list[PlayedSongEarningsRead]:
    by_request: dict[int, list[_LedgerContext]] = {}
    for item in contexts:
        if item.request is None or item.request.status != RequestStatus.PLAYED or item.request.played_at is None:
            continue
        by_request.setdefault(item.request.id, []).append(item)

    played_entries = [
        _serialize_played_song_entry(request_id, request_contexts)
        for request_id, request_contexts in by_request.items()
    ]
    played_entries.sort(key=lambda item: item.played_at, reverse=True)
    return played_entries[:limit]


def _serialize_played_song_entry(
    song_request_id: int,
    entries: list[_LedgerContext],
) -> PlayedSongEarningsRead:
    representative = entries[0]
    assert representative.request is not None
    return PlayedSongEarningsRead(
        song_request_id=song_request_id,
        session_id=representative.session.id,
        song_title=representative.song.title if representative.song else None,
        song_artist=representative.song.artist if representative.song else None,
        song_total_cents=representative.request.total_amount_cents,
        venue_name=representative.venue.name if representative.venue else None,
        event_name=representative.event.name if representative.event else None,
        played_at=representative.request.played_at,
        payout_status=_derive_payout_status(entries),
    )


def _serialize_ledger_entry(item: _LedgerContext) -> LedgerEntryRead:
    is_tip = item.ledger.tip_id is not None
    return LedgerEntryRead(
        id=item.ledger.id,
        session_id=item.ledger.session_id,
        song_request_id=item.ledger.song_request_id,
        payment_id=item.ledger.payment_id,
        song_title="Tip" if is_tip else (item.song.title if item.song else None),
        song_artist="Audience tip" if is_tip else (item.song.artist if item.song else None),
        gross_amount_cents=item.payment.gross_amount_cents,
        net_amount_cents=item.ledger.amount_cents,
        amount_cents=item.ledger.amount_cents,
        status=item.ledger.status,
        venue_name=item.venue.name if item.venue else None,
        event_name=item.event.name if item.event else None,
        played_at=item.request.played_at if item.request else None,
        available_at=item.ledger.available_at,
        paid_out_at=item.ledger.paid_out_at,
        created_at=item.ledger.created_at,
    )


def list_ledger_entries(db: Session, dj_profile_id: int, *, limit: int = 100) -> list[LedgerEntryRead]:
    contexts = _load_ledger_contexts(db, dj_profile_id)
    return [_serialize_ledger_entry(item) for item in contexts[:limit]]


def request_withdrawal(db: Session, dj_profile_id: int, amount_cents: int) -> tuple[str, bool]:
    if amount_cents <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Amount must be positive")

    contexts = _load_ledger_contexts(db, dj_profile_id)
    available = _wallet_available_cents(contexts)
    if amount_cents > available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Withdrawal amount exceeds available wallet balance",
        )

    polar_connected = False
    if not polar_connected:
        return (
            "Connect Polar payout onboarding before withdrawing to your bank account.",
            polar_connected,
        )

    now = datetime.now(UTC)
    remaining = amount_cents
    for item in sorted(
        (entry for entry in contexts if _entry_wallet_cents(entry) > 0),
        key=lambda entry: entry.ledger.available_at or now,
    ):
        if remaining <= 0:
            break
        item.ledger.status = LedgerStatus.PAID_OUT
        item.ledger.paid_out_at = now
        remaining -= item.ledger.amount_cents

    return ("Withdrawal initiated. Funds will arrive in 2–3 business days.", polar_connected)
