from pydantic import BaseModel, Field


class OllamaTestRequest(BaseModel):
    model: str | None = Field(default=None, max_length=128)


class OllamaTestOut(BaseModel):
    ok: bool
    message: str
    model: str = ""
    preview: str | None = None


class OpenAiTestRequest(BaseModel):
    workspace_id: int
    api_key: str | None = Field(default=None, max_length=4096)


class OpenAiTestOut(BaseModel):
    ok: bool
    message: str
    preview: str | None = None
    key_source: str = ""  # "request" | "workspace" | "env" | ""


class OllamaPullRequest(BaseModel):
    model: str = Field(..., min_length=1, max_length=128)


class OllamaPullOut(BaseModel):
    ok: bool
    message: str


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


class OllamaInstalledModelsOut(BaseModel):
    """Names from `ollama list` / Ollama HTTP API (for admin UI)."""

    env_default: str = ""
    models: list[str] = Field(default_factory=list)
    ollama_url: str = ""
    error: str | None = None


class PaginatedUserUsage(BaseModel):
    items: list[UserUsageRowOut]
    total: int
    page: int
    limit: int
    pages: int


class PaginatedActivity(BaseModel):
    items: list[ActivityEntryOut]
    total: int
    page: int
    limit: int
    pages: int


class SystemLogRowOut(BaseModel):
    id: int
    type: str
    message: str
    created_at: str


class PaginatedSystemLogs(BaseModel):
    items: list[SystemLogRowOut]
    total: int
    page: int
    limit: int
    pages: int


class ActivityClearRequest(BaseModel):
    range: str  # "week" | "month"


class SentEmailRowOut(BaseModel):
    id: int
    workspace_id: int | None
    to_email: str
    subject: str
    body: str
    sent_at: str
    status: str


class PaginatedSentEmails(BaseModel):
    items: list[SentEmailRowOut]
    total: int
    page: int
    limit: int
    pages: int


class SentEmailsDeleteRequest(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=500)


class SystemLogsDeleteRequest(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=500)


class SystemLogsClearMonthRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)


class DeletedCountOut(BaseModel):
    deleted: int
