from pydantic import EmailStr

from app.models.enums import UserRole
from app.schemas.common import APIModel


class UserRead(APIModel):
    id: int
    email: EmailStr
    display_name: str
    avatar_url: str | None = None
    role: UserRole
    is_email_verified: bool


class UserUpdate(APIModel):
    display_name: str | None = None
    avatar_url: str | None = None

