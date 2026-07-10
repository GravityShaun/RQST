from __future__ import annotations

import secrets
import string
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    ComplimentarySongCode,
    ComplimentarySongCredit,
    DJProfile,
    DJSession,
    Event,
    SessionStatus,
    SongRequest,
    Venue,
)
from app.schemas.complimentary import (
    ComplimentaryCodeIssueRead,
    ComplimentaryCodeSummaryRead,
    ComplimentaryCreditRead,
)


def _allow_multiple_uses_per_user(code: ComplimentarySongCode) -> bool:
    return bool(getattr(code, "allow_multiple_uses_per_user", False))

MAX_COMPLIMENTARY_USES_PER_SHOW = 10
MAX_COMPLIMENTARY_SONG_AMOUNT_CENTS = 5000
MAX_COMPLIMENTARY_SHOUTOUT_AMOUNT_CENTS = 2000
# Exclude ambiguous characters (0/O, 1/I) and keep codes globally unique forever.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 12


def normalize_complimentary_code(raw_code: str) -> str:
    return "".join(raw_code.strip().upper().split())


def _generate_unique_code(db: Session) -> str:
    for _ in range(40):
        candidate = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        exists = db.scalar(select(ComplimentarySongCode.id).where(ComplimentarySongCode.code == candidate))
        if exists is None:
            return candidate
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a unique complimentary code",
    )


def count_uses_for_code(db: Session, code_id: int) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(ComplimentarySongCredit)
            .where(ComplimentarySongCredit.code_id == code_id)
        )
        or 0
    )


def get_active_code_for_event(db: Session, event_id: int) -> ComplimentarySongCode | None:
    return db.scalar(
        select(ComplimentarySongCode).where(
            ComplimentarySongCode.event_id == event_id,
            ComplimentarySongCode.voided_at.is_(None),
        )
    )


def void_complimentary_code(code: ComplimentarySongCode, *, now: datetime | None = None) -> None:
    if code.voided_at is not None:
        return
    code.voided_at = now or datetime.now(UTC)


def void_active_codes_for_event(db: Session, event_id: int, *, now: datetime | None = None) -> None:
    current = now or datetime.now(UTC)
    for code in db.scalars(
        select(ComplimentarySongCode).where(
            ComplimentarySongCode.event_id == event_id,
            ComplimentarySongCode.voided_at.is_(None),
        )
    ):
        void_complimentary_code(code, now=current)


def issue_complimentary_code(
    db: Session,
    *,
    event: Event,
    dj_profile: DJProfile,
    rotate: bool = False,
    allow_multiple_uses_per_user: bool = False,
) -> ComplimentaryCodeIssueRead:
    existing = get_active_code_for_event(db, event.id)
    if existing is not None and not rotate:
        return _serialize_issued_code(db, existing)

    if existing is not None and rotate:
        void_complimentary_code(existing)

    code = ComplimentarySongCode(
        event_id=event.id,
        dj_profile_id=dj_profile.id,
        code=_generate_unique_code(db),
        max_uses=MAX_COMPLIMENTARY_USES_PER_SHOW,
        allow_multiple_uses_per_user=allow_multiple_uses_per_user,
    )
    db.add(code)
    db.flush()
    return _serialize_issued_code(db, code)


def update_complimentary_code_settings(
    db: Session,
    *,
    event: Event,
    allow_multiple_uses_per_user: bool,
) -> ComplimentaryCodeIssueRead:
    code = get_active_code_for_event(db, event.id)
    if code is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No free song code for this show")
    code.allow_multiple_uses_per_user = allow_multiple_uses_per_user
    db.flush()
    return _serialize_issued_code(db, code)


def list_complimentary_codes_for_event(
    db: Session,
    *,
    event: Event,
) -> ComplimentaryCodeSummaryRead:
    code = get_active_code_for_event(db, event.id)
    if code is None:
        return ComplimentaryCodeSummaryRead(
            event_id=event.id,
            used_count=0,
            max_uses=MAX_COMPLIMENTARY_USES_PER_SHOW,
            remaining_uses=MAX_COMPLIMENTARY_USES_PER_SHOW,
            code=None,
        )

    serialized = _serialize_issued_code(db, code)
    return ComplimentaryCodeSummaryRead(
        event_id=event.id,
        used_count=serialized.used_count,
        max_uses=serialized.max_uses,
        remaining_uses=serialized.remaining_uses,
        code=serialized,
    )


def redeem_complimentary_code(db: Session, *, user_id: int, raw_code: str) -> ComplimentaryCreditRead:
    code_value = normalize_complimentary_code(raw_code)
    if not code_value:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Code is required")

    code = db.scalar(select(ComplimentarySongCode).where(ComplimentarySongCode.code == code_value))
    if code is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promo code not found")
    if code.voided_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This promo code is no longer valid")

    unused_for_user = db.scalar(
        select(ComplimentarySongCredit).where(
            ComplimentarySongCredit.user_id == user_id,
            ComplimentarySongCredit.code_id == code.id,
            ComplimentarySongCredit.used_at.is_(None),
        )
    )
    if unused_for_user is not None:
        return serialize_complimentary_credit(db, unused_for_user)

    unused_for_event = db.scalar(
        select(ComplimentarySongCredit).where(
            ComplimentarySongCredit.user_id == user_id,
            ComplimentarySongCredit.event_id == code.event_id,
            ComplimentarySongCredit.used_at.is_(None),
        )
    )
    if unused_for_event is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an unused free song for this show",
        )

    prior_for_user = db.scalar(
        select(ComplimentarySongCredit.id).where(
            ComplimentarySongCredit.user_id == user_id,
            ComplimentarySongCredit.code_id == code.id,
        )
    )
    if prior_for_user is not None and not _allow_multiple_uses_per_user(code):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already used this promo code",
        )

    used_count = count_uses_for_code(db, code.id)
    max_uses = code.max_uses or MAX_COMPLIMENTARY_USES_PER_SHOW
    if used_count >= max_uses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This promo code has reached its limit of {max_uses} uses",
        )

    credit = ComplimentarySongCredit(
        code_id=code.id,
        event_id=code.event_id,
        dj_profile_id=code.dj_profile_id,
        user_id=user_id,
    )
    db.add(credit)
    db.flush()
    return serialize_complimentary_credit(db, credit)


def list_complimentary_credits_for_user(db: Session, user_id: int) -> list[ComplimentaryCreditRead]:
    credits = list(
        db.scalars(
            select(ComplimentarySongCredit)
            .where(ComplimentarySongCredit.user_id == user_id)
            .order_by(ComplimentarySongCredit.created_at.desc(), ComplimentarySongCredit.id.desc())
        )
    )
    return [serialize_complimentary_credit(db, credit) for credit in credits]


def find_available_credit_for_request(
    db: Session,
    *,
    user_id: int,
    event_id: int | None,
    dj_profile_id: int,
) -> ComplimentarySongCredit | None:
    if event_id is None:
        return None
    return db.scalar(
        select(ComplimentarySongCredit).where(
            ComplimentarySongCredit.user_id == user_id,
            ComplimentarySongCredit.event_id == event_id,
            ComplimentarySongCredit.dj_profile_id == dj_profile_id,
            ComplimentarySongCredit.used_at.is_(None),
        )
    )


def consume_complimentary_credit(
    db: Session,
    credit: ComplimentarySongCredit,
    *,
    song_request: SongRequest,
) -> None:
    if credit.used_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Complimentary credit already used")
    credit.used_at = datetime.now(UTC)
    credit.used_song_request_id = song_request.id
    song_request.is_complimentary = True


def restore_complimentary_credit_for_request(db: Session, song_request: SongRequest) -> None:
    if not song_request.is_complimentary:
        return
    credit = db.scalar(
        select(ComplimentarySongCredit).where(
            ComplimentarySongCredit.used_song_request_id == song_request.id,
        )
    )
    if credit is None:
        return
    credit.used_at = None
    credit.used_song_request_id = None


def _live_session_id_for_event(db: Session, event_id: int) -> int | None:
    return db.scalar(
        select(DJSession.id).where(
            DJSession.event_id == event_id,
            DJSession.status == SessionStatus.LIVE,
        )
    )


def serialize_complimentary_credit(db: Session, credit: ComplimentarySongCredit) -> ComplimentaryCreditRead:
    event = db.get(Event, credit.event_id)
    profile = db.get(DJProfile, credit.dj_profile_id)
    venue = db.get(Venue, event.venue_id) if event else None
    return ComplimentaryCreditRead(
        id=credit.id,
        event_id=credit.event_id,
        dj_profile_id=credit.dj_profile_id,
        dj_artist_name=profile.artist_name if profile else None,
        dj_slug=profile.slug if profile else None,
        event_name=event.name if event else None,
        event_starts_at=event.starts_at if event else None,
        venue_name=venue.name if venue else None,
        live_session_id=_live_session_id_for_event(db, credit.event_id),
        used_at=credit.used_at,
        used_song_request_id=credit.used_song_request_id,
        created_at=credit.created_at,
    )


def _serialize_issued_code(db: Session, code: ComplimentarySongCode) -> ComplimentaryCodeIssueRead:
    used_count = count_uses_for_code(db, code.id)
    max_uses = code.max_uses or MAX_COMPLIMENTARY_USES_PER_SHOW
    return ComplimentaryCodeIssueRead(
        id=code.id,
        event_id=code.event_id,
        code=code.code,
        created_at=code.created_at,
        used_count=used_count,
        max_uses=max_uses,
        remaining_uses=max(0, max_uses - used_count),
        allow_multiple_uses_per_user=_allow_multiple_uses_per_user(code),
        voided_at=code.voided_at,
    )
