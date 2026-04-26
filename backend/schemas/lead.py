import math
import re
from datetime import datetime, timezone

from pydantic import BaseModel, EmailStr, Field, field_serializer, field_validator

from core.validation import is_valid_phone, normalize_country_code

ALLOWED_LEAD_STATUSES = frozenset(
    {
        # Legacy / funnel
        "new",
        "contacted",
        "interested",
        "not_interested",
        "closed",
        # Pipeline (snake_case in API / DB)
        "old",
        "request_sent",
        "message_sent",
        "replied_got",
        "on_discussion",
        "just_lead",
        "deal",
        "close",
        "fail",
    }
)

ALLOWED_LEAD_TYPES = frozenset({"A+", "A", "B", "C"})

_STATUS_KEY_RE = re.compile(r"_+")


def normalize_csv_status_value(raw: str | None) -> str:
    """Map CSV / UI free text to a canonical status slug."""
    if not raw or not str(raw).strip():
        return "new"
    k = str(raw).strip().lower().replace(" ", "_").replace("-", "_")
    k = _STATUS_KEY_RE.sub("_", k).strip("_")
    if k in ALLOWED_LEAD_STATUSES:
        return k
    return "new"


def normalize_csv_lead_type(raw: str | None) -> str | None:
    if not raw or not str(raw).strip():
        return None
    t = str(raw).strip().upper()
    if t in ALLOWED_LEAD_TYPES:
        return t
    return None


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    status: str = Field(default="new", max_length=64)
    tag: str | None = Field(default=None, max_length=128)
    phone_number: str | None = Field(default=None, max_length=64)
    country_code: str | None = Field(default=None, max_length=8)
    company: str | None = Field(default=None, max_length=255)
    role_title: str | None = Field(default=None, max_length=255)
    profile_link: str | None = Field(default=None, max_length=512)
    agency_type: str | None = Field(default=None, max_length=128)
    team_size_estimate: str | None = Field(default=None, max_length=64)
    problem_seen: str | None = Field(default=None, max_length=20000)
    last_active_display: str | None = Field(default=None, max_length=128)
    connection_sent_date: str | None = Field(default=None, max_length=128)
    replied_y_n: str | None = Field(default=None, max_length=8)
    solution: str | None = Field(default=None, max_length=20000)
    lead_type: str | None = Field(default=None, max_length=8)

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

    @field_validator("lead_type")
    @classmethod
    def lead_type_ok(cls, v: str | None) -> str | None:
        if v is None or not str(v).strip():
            return None
        t = str(v).strip().upper()
        if t == "A+":
            t = "A+"
        elif t in ("A", "B", "C"):
            pass
        else:
            raise ValueError("Lead type must be one of: A+, A, B, C")
        if t not in ALLOWED_LEAD_TYPES:
            raise ValueError("Lead type must be one of: A+, A, B, C")
        return t


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    status: str | None = Field(default=None, max_length=64)
    tag: str | None = Field(default=None, max_length=128)
    phone_number: str | None = Field(default=None, max_length=64)
    country_code: str | None = Field(default=None, max_length=8)
    company: str | None = Field(default=None, max_length=255)
    role_title: str | None = Field(default=None, max_length=255)
    profile_link: str | None = Field(default=None, max_length=512)
    agency_type: str | None = Field(default=None, max_length=128)
    team_size_estimate: str | None = Field(default=None, max_length=64)
    problem_seen: str | None = Field(default=None, max_length=20000)
    last_active_display: str | None = Field(default=None, max_length=128)
    connection_sent_date: str | None = Field(default=None, max_length=128)
    replied_y_n: str | None = Field(default=None, max_length=8)
    solution: str | None = Field(default=None, max_length=20000)
    lead_type: str | None = Field(default=None, max_length=8)

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

    @field_validator("lead_type")
    @classmethod
    def lead_type_ok(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not str(v).strip():
            return None
        t = str(v).strip().upper()
        if t == "A+":
            t = "A+"
        elif t not in ("A", "B", "C"):
            raise ValueError("Lead type must be one of: A+, A, B, C")
        if t not in ALLOWED_LEAD_TYPES:
            raise ValueError("Lead type must be one of: A+, A, B, C")
        return t


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
    role_title: str | None = None
    profile_link: str | None = None
    agency_type: str | None = None
    team_size_estimate: str | None = None
    problem_seen: str | None = None
    last_active_display: str | None = None
    connection_sent_date: str | None = None
    replied_y_n: str | None = None
    solution: str | None = None
    lead_type: str | None = None
    workspace_id: int
    owner_user_id: int | None = None
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


class SuggestSolutionOut(BaseModel):
    solution: str


class SuggestSolutionBody(BaseModel):
    """Draft Solution from Problem without an existing lead row (e.g. Add Lead form)."""

    problem_seen: str = Field(min_length=1, max_length=20000)
    company: str | None = Field(default=None, max_length=255)
    role_title: str | None = Field(default=None, max_length=255)
    lead_name: str | None = Field(default=None, max_length=255)


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
