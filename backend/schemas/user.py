from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    plan: Literal["free", "pro"] = "free"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    workspace_id: int
    display_name: str | None = None
    phone: str | None = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class UserListItemOut(UserOut):
    """User row in admin list with workspace AI quota snapshot (shared per workspace)."""

    workspace_plan_type: str = "free"
    workspace_ai_limit: int = 0
    workspace_ai_used: int = 0
    workspace_ai_quota_exhausted: bool = False


class UserAdminPatch(BaseModel):
    is_active: bool | None = None
    display_name: str | None = Field(default=None, max_length=120)
    plan: Literal["free", "pro"] | None = None


class AdminUserPasswordSet(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)


class UserProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    display_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=64)


class UserPasswordUpdate(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class PaginatedUsers(BaseModel):
    items: list[UserListItemOut]
    total: int
    page: int
    limit: int
    pages: int
