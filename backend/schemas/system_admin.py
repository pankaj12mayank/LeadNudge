from pydantic import BaseModel


class SystemStatusOut(BaseModel):
    backend: str
    ai_active: bool
    ai_message: str
    last_activity_at: str | None


class ActivityEntryOut(BaseModel):
    occurred_at: str
    kind: str
    summary: str


class UserUsageRowOut(BaseModel):
    user_id: int
    email: str
    workspace_id: int
    is_active: bool
    workspace_ai_messages: int


class PaginatedUserUsage(BaseModel):
    items: list[UserUsageRowOut]
    total: int
    page: int
    limit: int
    pages: int
