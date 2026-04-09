import math
from datetime import datetime

from pydantic import BaseModel, Field


class FollowupCreate(BaseModel):
    lead_id: int
    scheduled_at: datetime


class FollowupOut(BaseModel):
    id: int
    lead_id: int
    scheduled_at: datetime
    status: str
    last_message: str | None = None

    model_config = {"from_attributes": True}


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
