import math
from datetime import datetime, timezone

from pydantic import BaseModel, field_serializer


class OutboundMailOut(BaseModel):
    id: int
    followup_id: int | None = None
    lead_id: int | None = None
    to_email: str
    lead_name: str
    subject: str
    body_preview: str
    sent_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("sent_at")
    @staticmethod
    def _ser_sent(v: datetime) -> str:
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)
        s = v.isoformat(timespec="seconds")
        return s.replace("+00:00", "Z")


class PaginatedOutboundMails(BaseModel):
    items: list[OutboundMailOut]
    total: int
    page: int
    limit: int
    pages: int

    @classmethod
    def from_page(
        cls, items: list, total: int, page: int, limit: int
    ) -> "PaginatedOutboundMails":
        pages = max(1, math.ceil(total / limit)) if limit else 1
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )
