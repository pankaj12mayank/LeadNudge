import math
from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_serializer


class FollowupCreate(BaseModel):
    lead_id: int
    scheduled_at: datetime


class FollowupOut(BaseModel):
    id: int
    lead_id: int
    scheduled_at: datetime
    status: str
    last_message: str | None = None
    failure_reason: str | None = None

    model_config = {"from_attributes": True}

    @field_serializer("scheduled_at")
    @staticmethod
    def _serialize_scheduled_at(v: datetime) -> str:
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)
        s = v.isoformat(timespec="seconds")
        return s.replace("+00:00", "Z")


class MessageOut(BaseModel):
    id: int
    lead_id: int
    content: str

    model_config = {"from_attributes": True}


class FollowupCreateResponse(BaseModel):
    followup: FollowupOut
    message: MessageOut | None = None


class PaginatedFollowups(BaseModel):
    items: list[FollowupOut]
    total: int
    page: int
    limit: int
    pages: int

    @classmethod
    def from_page(
        cls, items: list[FollowupOut], total: int, page: int, limit: int
    ) -> "PaginatedFollowups":
        pages = max(1, math.ceil(total / limit)) if limit else 1
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )
