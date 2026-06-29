from fastapi import HTTPException, status

from app.core.config import get_settings

settings = get_settings()


def build_checkout_url(payment_id: int) -> str:
    return f"https://sandbox.polar.sh/checkout/rqst-{payment_id}"


def verify_webhook_signature(payload: dict, signature: str | None) -> None:
    if settings.environment == "test":
        return
    if signature is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Polar signature")
    if signature != settings.polar_webhook_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Polar signature")

