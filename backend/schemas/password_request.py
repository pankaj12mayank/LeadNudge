from datetime import datetime, timezone

from pydantic import BaseModel, EmailStr, Field, field_serializer


class PasswordRequestCreate(BaseModel):
    email: EmailStr


class PasswordRequestOut(BaseModel):
    id: int
    user_email: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    @staticmethod
    def _ser_created(v: datetime) -> str:
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)
        s = v.isoformat(timespec="seconds")
        return s.replace("+00:00", "Z")


class PaginatedPasswordRequests(BaseModel):
    items: list[PasswordRequestOut]
    total: int
    page: int
    limit: int
    pages: int
