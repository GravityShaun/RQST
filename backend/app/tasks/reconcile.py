from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Payment, PaymentStatus


def find_pending_payments(db: Session) -> list[Payment]:
    stmt = select(Payment).where(Payment.status.in_([PaymentStatus.CHECKOUT_STARTED, PaymentStatus.PAYMENT_PENDING]))
    return list(db.scalars(stmt))

