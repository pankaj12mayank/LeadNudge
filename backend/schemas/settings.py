from pydantic import BaseModel, EmailStr, Field, TypeAdapter, field_validator

_smtp_email_adapter = TypeAdapter(EmailStr)


class SettingsOut(BaseModel):
    workspace_id: int
    ai_mode: str
    api_key: str | None
    usage_limit: int
    ollama_model: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_email: str | None = None
    smtp_password: str | None = None
    ai_messages_used: int = 0
    outbound_emails_sent: int = 0
    usage_percent: float = 0.0
    usage_near_limit: bool = False
    smtp_fully_configured: bool = False

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    ai_mode: str | None = Field(default=None, pattern="^(local|api)$")
    api_key: str | None = None
    usage_limit: int | None = Field(default=None, ge=0)
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_email: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = None

    @field_validator("smtp_email")
    @classmethod
    def email_strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s:
            return None
        return str(_smtp_email_adapter.validate_python(s))

    @field_validator("smtp_host")
    @classmethod
    def host_strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s or None


class AdminSettingsUpdate(BaseModel):
    workspace_id: int
    ai_mode: str | None = Field(default=None, pattern="^(local|api)$")
    api_key: str | None = None
    usage_limit: int | None = Field(default=None, ge=0)
    ollama_model: str | None = Field(default=None, max_length=128)


class SmtpTestResult(BaseModel):
    ok: bool
    message: str
