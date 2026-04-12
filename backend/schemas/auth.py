from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    display_name: str | None = None


class MeOut(BaseModel):
    role: str
    email: str
    display_name: str | None = None
    phone: str | None = None
    # Workspace user only — plan expiry does not block login; UI may show banners.
    workspace_plan_expired: bool = False
    workspace_plan_type: str | None = None
