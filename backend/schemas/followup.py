import math
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_serializer


class FollowupCreate(BaseModel):
    lead_id: int
    scheduled_at: datetime
    followup_type: Literal["normal", "recovery"] = "normal"


class FollowupUpdate(BaseModel):
    """Reschedule (new scheduled_at) and/or cancel a pending follow-up."""

    scheduled_at: datetime | None = None
    cancel: bool = False


class FollowupOut(BaseModel):
    id: int
    lead_id: int
    lead_name: str | None = None
    scheduled_at: datetime
    status: str
    followup_type: str = "normal"
    send_window_hint: str | None = None
    last_message: str | None = None
    failure_reason: str | None = None
    sent_at: datetime | None = None

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

    @staticmethod
    def send_window_from_scheduled(v: datetime) -> str:
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)
        h = v.hour
        if 5 <= h < 12:
            return "morning"
        if 12 <= h < 17:
            return "afternoon"
        return "evening"

    @field_serializer("sent_at")
    @staticmethod
    def _serialize_sent_at(v: datetime | None) -> str | None:
        if v is None:
            return None
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
