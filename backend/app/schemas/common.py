from datetime import datetime

from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageResponse(APIModel):
    message: str


class PaginatedResponse(APIModel):
    items: list
    total: int


class Timestamped(APIModel):
    created_at: datetime
    updated_at: datetime

