from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_serializer


def _iso_utc_z(v: datetime | None) -> str | None:
    if v is None:
        return None
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    else:
        v = v.astimezone(timezone.utc)
    s = v.isoformat(timespec="seconds")
    return s.replace("+00:00", "Z")


class DashboardLeadRow(BaseModel):
    id: int
    name: str
    email: str
    status: str
    temperature_tag: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    @staticmethod
    def _ser_created(v: datetime | None) -> str | None:
        return _iso_utc_z(v)


class DashboardFollowupRow(BaseModel):
    id: int
    lead_id: int
    lead_name: str | None = None
    scheduled_at: datetime
    status: str
    followup_type: str = "normal"
    sent_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_serializer("scheduled_at")
    @staticmethod
    def _ser_scheduled(v: datetime) -> str:
        return _iso_utc_z(v) or ""

    @field_serializer("sent_at")
    @staticmethod
    def _ser_sent(v: datetime | None) -> str | None:
        return _iso_utc_z(v)


class SalesDashboardOut(BaseModel):
    total_leads: int
    followups_sent: int
    manual_replies: int = Field(
        ..., description="Workspace-entered reply count (manual for now)"
    )
    manual_conversions: int = Field(
        ..., description="Workspace-entered conversion count (manual for now)"
    )
    recent_leads: list[DashboardLeadRow]
    recent_followups: list[DashboardFollowupRow]
