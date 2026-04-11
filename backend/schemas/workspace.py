from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_serializer


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    plan_type: str = Field(default="free", pattern="^(free|pro)$")


class WorkspaceOut(BaseModel):
    id: int
    name: str
    plan_type: str
    plan_expires_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_serializer("plan_expires_at")
    @staticmethod
    def _ser_plan_exp(v: datetime | None) -> str | None:
        if v is None:
            return None
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)
        s = v.isoformat(timespec="seconds")
        return s.replace("+00:00", "Z")


class WorkspacePlanUpdate(BaseModel):
    plan_type: str = Field(pattern="^(free|pro)$")
    plan_expires_at: datetime | None = None
