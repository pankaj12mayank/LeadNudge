from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UsageHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    workspace_id: int | None
    action_type: str
    old_limit: int | None
    new_limit: int | None
    plan_type: str | None
    expiry_date: datetime | None
    changed_by: int | None
    summary: str | None
    created_at: datetime


class UsageHistoryUserOut(UsageHistoryOut):
    """Includes denormalized email when joined for admin list."""

    user_email: str | None = None


class PaginatedUsageHistory(BaseModel):
    items: list[UsageHistoryUserOut]
    total: int
    page: int
    limit: int
    pages: int


class PaginatedMyUsageHistory(BaseModel):
    """Workspace user: own rows only."""

    items: list[UsageHistoryOut]
    total: int
    page: int
    limit: int
    pages: int


class UsageHistoryDeleteRequest(BaseModel):
    ids: list[int] = Field(default_factory=list, min_length=1)
