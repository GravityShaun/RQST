from fastapi import APIRouter

from app.schemas.common import MessageResponse

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[dict])
def get_notifications() -> list[dict]:
    return []


@router.post("/notifications/read", response_model=MessageResponse)
def mark_notifications_read() -> MessageResponse:
    return MessageResponse(message="Notifications marked read")


@router.post("/device-tokens", response_model=MessageResponse)
def register_device_token() -> MessageResponse:
    return MessageResponse(message="Device token registered")

