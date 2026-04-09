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

    model_config = {"from_attributes": True}


class PaginatedUsers(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    limit: int
    pages: int
