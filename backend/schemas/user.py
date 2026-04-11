from typing import Literal

from pydantic import BaseModel, EmailStr, Field


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


class UserAdminPatch(BaseModel):
    is_active: bool | None = None
    display_name: str | None = Field(default=None, max_length=120)


class AdminUserPasswordSet(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=64)


class UserPasswordUpdate(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class PaginatedUsers(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    limit: int
    pages: int
