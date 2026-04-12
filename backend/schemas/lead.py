import math
import re
from datetime import datetime, timezone

from pydantic import BaseModel, EmailStr, Field, field_serializer, field_validator

from core.validation import is_valid_phone, normalize_country_code

ALLOWED_LEAD_STATUSES = frozenset(
    {"new", "contacted", "interested", "not_interested", "closed"}
)


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    status: str = Field(default="new", max_length=64)
    tag: str | None = Field(default=None, max_length=128)
    phone_number: str | None = Field(default=None, max_length=64)
    country_code: str | None = Field(default=None, max_length=8)
    company: str | None = Field(default=None, max_length=255)
    last_message: str | None = Field(
        default=None,
        max_length=20000,
        description="Last note or inbound message; used as AI context when no thread exists",
    )

    @field_validator("phone_number")
    @classmethod
    def phone_ok(cls, v: str | None) -> str | None:
        if v is not None and v.strip() and not is_valid_phone(v):
            raise ValueError("Invalid phone format")
        return v.strip() if v and v.strip() else None

    @field_validator("country_code")
    @classmethod
    def country_ok(cls, v: str | None) -> str | None:
        return normalize_country_code(v)

    @field_validator("status")
    @classmethod
    def status_ok(cls, v: str) -> str:
        if v not in ALLOWED_LEAD_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(ALLOWED_LEAD_STATUSES))}")
        return v


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    status: str | None = Field(default=None, max_length=64)
    tag: str | None = Field(default=None, max_length=128)
    phone_number: str | None = Field(default=None, max_length=64)
    country_code: str | None = Field(default=None, max_length=8)
    company: str | None = Field(default=None, max_length=255)
    last_message: str | None = Field(default=None, max_length=20000)

    @field_validator("phone_number")
    @classmethod
    def phone_ok(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v.strip() and not is_valid_phone(v):
            raise ValueError("Invalid phone format")
        return v.strip() if v.strip() else None

    @field_validator("country_code")
    @classmethod
    def country_ok(cls, v: str | None) -> str | None:
        return normalize_country_code(v)

    @field_validator("status")
    @classmethod
    def status_ok(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v not in ALLOWED_LEAD_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(ALLOWED_LEAD_STATUSES))}")
        return v


class LeadOut(BaseModel):
    id: int
    name: str
    email: str
    status: str
    tag: str | None
    phone_number: str | None
    country_code: str | None
    company: str | None = None
    temperature_tag: str | None = None
    last_message: str | None = None
    workspace_id: int
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    @staticmethod
    def _serialize_created_at(v: datetime | None) -> str | None:
        if v is None:
            return None
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        else:
            v = v.astimezone(timezone.utc)
        s = v.isoformat(timespec="seconds")
        return s.replace("+00:00", "Z")


class PaginatedLeads(BaseModel):
    items: list[LeadOut]
    total: int
    page: int
    limit: int
    pages: int

    @classmethod
    def from_page(cls, items: list, total: int, page: int, limit: int) -> "PaginatedLeads":
        pages = max(1, math.ceil(total / limit)) if limit else 1
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )


class LeadCsvImportResult(BaseModel):
    total_rows: int = Field(
        0, description="Data rows read from CSV (excluding header)"
    )
    inserted: int = Field(..., description="Successfully imported rows")
    skipped: int = Field(..., description="Skipped / failed rows")
    errors: list[str] = Field(default_factory=list)


class LeadsBatchDeleteRequest(BaseModel):
    ids: list[int] = Field(default_factory=list, max_length=500)


class LeadsBatchDeleteOut(BaseModel):
    deleted: int


_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F9FF"
    "\u2600-\u26FF"
    "\u2700-\u27BF"
    "]+",
    flags=re.UNICODE,
)


def sanitize_csv_cell(s: str) -> str:
    return _EMOJI_RE.sub("", s).strip()
