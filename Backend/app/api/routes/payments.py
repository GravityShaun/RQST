from fastapi import APIRouter, Header

from app.api.deps import DBSession
from app.models import Payment
from app.schemas.common import MessageResponse
from app.schemas.payments import PaymentRead, PolarWebhookPayload
from app.services.payments import handle_webhook

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/{payment_id}", response_model=PaymentRead | dict)
def get_payment(payment_id: int, db: DBSession):
    payment = db.get(Payment, payment_id)
    if not payment:
        return {"message": "Payment not found"}
    return PaymentRead.model_validate(payment)



@router.post("/webhooks/polar", response_model=MessageResponse)
def polar_webhook(
    payload: PolarWebhookPayload,
    db: DBSession,
    x_polar_signature: str | None = Header(default=None),
) -> MessageResponse:
    handle_webhook(db, payload.model_dump(), x_polar_signature)
    db.commit()
    return MessageResponse(message="Webhook processed")
