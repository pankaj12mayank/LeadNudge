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


class BrandingUpdate(BaseModel):
    project_name: str = Field(min_length=1, max_length=255)


class PublicSiteOut(BaseModel):
    project_name: str
    logo_url: str | None = None
    ollama_model: str
    openai_chat_model: str = "gpt-4o-mini"
