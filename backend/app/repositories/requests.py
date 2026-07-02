from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SongRequest


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

