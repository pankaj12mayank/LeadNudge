from pydantic import BaseModel, EmailStr, Field


class AdminOut(BaseModel):
    id: int
    email: EmailStr
    display_name: str | None = None

    model_config = {"from_attributes": True}


class AdminProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    email: EmailStr | None = None


class AdminPasswordUpdate(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class BrandingOut(BaseModel):
    project_name: str
    logo_url: str | None = None
    favicon_url: str | None = None


class BrandingUpdate(BaseModel):
    project_name: str = Field(min_length=1, max_length=255)


class BrandingMailOut(BaseModel):
    support_email: str | None = None
    mail_smtp_host: str | None = None
    mail_smtp_port: int | None = None
    mail_smtp_email: str | None = None
    mail_smtp_password: str | None = None
    reset_email_subject: str | None = None
    reset_email_body: str | None = None


class BrandingMailUpdate(BaseModel):
    support_email: str | None = Field(default=None, max_length=255)
    mail_smtp_host: str | None = Field(default=None, max_length=255)
    mail_smtp_port: int | None = Field(default=None, ge=1, le=65535)
    mail_smtp_email: str | None = Field(default=None, max_length=255)
    mail_smtp_password: str | None = None
    reset_email_subject: str | None = Field(default=None, max_length=255)
    reset_email_body: str | None = None


class MailTestRequest(BaseModel):
    to_email: EmailStr


class PublicSiteOut(BaseModel):
    project_name: str
    logo_url: str | None = None
    favicon_url: str | None = None
    support_email: str | None = None
    ollama_base_url: str
    ollama_model: str
    openai_chat_model: str = "gpt-4o-mini"
