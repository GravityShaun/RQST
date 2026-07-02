from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import require_role
from app.models import User, UserRole
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[dict])
def get_admin_users(_user: Annotated[User, Depends(require_role(UserRole.ADMIN))]) -> list[dict]:
    return []


@router.get("/djs", response_model=list[dict])
def get_admin_djs(_user: Annotated[User, Depends(require_role(UserRole.ADMIN))]) -> list[dict]:
    return []


@router.get("/payments", response_model=list[dict])
def get_admin_payments(_user: Annotated[User, Depends(require_role(UserRole.ADMIN))]) -> list[dict]:
    return []


@router.get("/reports", response_model=list[dict])
def get_admin_reports(_user: Annotated[User, Depends(require_role(UserRole.ADMIN))]) -> list[dict]:
    return []


@router.post("/reports/{report_id}/resolve", response_model=MessageResponse)
def resolve_report(
    report_id: int,
    _user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
) -> MessageResponse:
    return MessageResponse(message=f"Report {report_id} resolved")

