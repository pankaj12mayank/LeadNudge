import csv
import io
from datetime import datetime, timezone
from typing import BinaryIO

from fastapi import HTTPException, status
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.validation import (
    is_csv_phone_numeric,
    is_valid_import_country_code,
    is_valid_phone,
    normalize_country_code,
)
from models.lead import Lead
from schemas.lead import (
    ALLOWED_LEAD_STATUSES,
    LeadCreate,
    LeadCsvImportResult,
    LeadUpdate,
    sanitize_csv_cell,
)
from schemas.pagination import PaginationParams


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def temperature_for_created_at(
    created_at: datetime, *, now: datetime | None = None
) -> str:
    now = now or _utc_now()
    ca = created_at
    if ca.tzinfo is None:
        ca = ca.replace(tzinfo=timezone.utc)
    else:
        ca = ca.astimezone(timezone.utc)
    age_days = (now - ca).total_seconds() / 86400.0
    if age_days <= 2:
        return "hot"
    if age_days <= 7:
        return "warm"
    return "cold"


def recompute_all_temperature_tags(db: Session) -> int:
    now = _utc_now()
    rows = db.query(Lead).all()
    changed = 0
    for lead in rows:
        if lead.created_at is None:
            continue
        tt = temperature_for_created_at(lead.created_at, now=now)
        if lead.temperature_tag != tt:
            lead.temperature_tag = tt
            changed += 1
    if changed:
        db.commit()
    return changed


def _map_csv_status(raw: str | None) -> str:
    if not raw or not str(raw).strip():
        return "new"
    k = str(raw).strip().lower().replace(" ", "_")
    if k in ALLOWED_LEAD_STATUSES:
        return k
    return "new"


def _get_lead_in_workspace(db: Session, lead_id: int, workspace_id: int) -> Lead:
    lead = db.get(Lead, lead_id)
    if not lead or lead.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


def _get_lead_for_portal_user(
    db: Session, lead_id: int, workspace_id: int, user_id: int
) -> Lead:
    """Workspace user may only access leads they own (owner_user_id must match)."""
    lead = _get_lead_in_workspace(db, lead_id, workspace_id)
    if lead.owner_user_id is None or int(lead.owner_user_id) != int(user_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


def list_leads(
    db: Session,
    *,
    workspace_id: int | None,
    is_admin: bool,
    page: int,
    limit: int,
    search: str | None = None,
    status: str | None = None,
    owner_user_id: int | None = None,
) -> tuple[list[Lead], int]:
    q = db.query(Lead)
    if is_admin:
        if workspace_id is not None:
            q = q.filter(Lead.workspace_id == workspace_id)
    else:
        if workspace_id is None or owner_user_id is None:
            return [], 0
        q = q.filter(
            Lead.workspace_id == workspace_id,
            Lead.owner_user_id == owner_user_id,
        )
    if status and str(status).strip():
        q = q.filter(Lead.status == str(status).strip().lower())
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(Lead.name.ilike(term), Lead.email.ilike(term))
        )
    total = q.count()
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    offset = (page - 1) * limit
    items = q.order_by(Lead.id.desc()).offset(offset).limit(limit).all()
    return items, total


def create_lead(
    db: Session,
    workspace_id: int,
    data: LeadCreate,
    *,
    owner_user_id: int | None = None,
) -> Lead:
    lm = (data.last_message or "").strip() or None
    co = (data.company or "").strip() or None
    lead = Lead(
        name=data.name,
        email=data.email,
        status=data.status,
        tag=data.tag,
        phone_number=data.phone_number,
        country_code=data.country_code,
        company=co,
        last_message=lm,
        workspace_id=workspace_id,
        temperature_tag="hot",
        owner_user_id=owner_user_id,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def update_lead(
    db: Session,
    lead_id: int,
    data: LeadUpdate,
    *,
    workspace_id: int | None,
    is_admin: bool,
    user_id: int | None = None,
) -> Lead:
    if is_admin:
        lead = db.get(Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
    else:
        assert workspace_id is not None and user_id is not None
        lead = _get_lead_for_portal_user(db, lead_id, workspace_id, user_id)
    if data.name is not None:
        lead.name = data.name
    if data.email is not None:
        lead.email = data.email
    if data.status is not None:
        lead.status = data.status
    if data.tag is not None:
        lead.tag = data.tag
    if data.phone_number is not None:
        lead.phone_number = data.phone_number
    if data.country_code is not None:
        lead.country_code = data.country_code
    if data.company is not None:
        lead.company = (data.company or "").strip() or None
    if data.last_message is not None:
        lead.last_message = (data.last_message or "").strip() or None
    if lead.created_at:
        lead.temperature_tag = temperature_for_created_at(lead.created_at)
    db.commit()
    db.refresh(lead)
    return lead


def delete_lead(
    db: Session,
    lead_id: int,
    *,
    workspace_id: int | None,
    is_admin: bool,
    user_id: int | None = None,
) -> None:
    if is_admin:
        lead = db.get(Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
    else:
        assert workspace_id is not None and user_id is not None
        lead = _get_lead_for_portal_user(db, lead_id, workspace_id, user_id)
    db.delete(lead)
    db.commit()


def delete_leads_batch(
    db: Session,
    ids: list[int],
    *,
    workspace_id: int | None,
    is_admin: bool,
    user_id: int | None = None,
) -> int:
    """Delete up to 500 leads; workspace users only their workspace. ORM delete for cascades."""
    clean = sorted({i for i in ids if isinstance(i, int) and i > 0})[:500]
    if not clean:
        return 0
    q = db.query(Lead).filter(Lead.id.in_(clean))
    if not is_admin:
        if workspace_id is None or user_id is None:
            return 0
        q = q.filter(
            Lead.workspace_id == workspace_id,
            Lead.owner_user_id == user_id,
        )
    rows = q.all()
    for lead in rows:
        db.delete(lead)
    db.commit()
    return len(rows)


def import_leads_from_csv(
    db: Session,
    workspace_id: int,
    file: BinaryIO,
    *,
    max_rows: int = 2000,
    owner_user_id: int | None = None,
) -> LeadCsvImportResult:
    raw = file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must be UTF-8 encoded",
        ) from e

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV has no header row",
        )
    fields_lower = {f.strip().lower(): f for f in reader.fieldnames if f}
    required = ("name", "email", "phone", "country_code")
    for r in required:
        if r not in fields_lower:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CSV must include column: {r}",
            )

    email_adapter = TypeAdapter(EmailStr)
    inserted = 0
    skipped = 0
    errors: list[str] = []
    row_num = 1
    total_rows = 0
    imported_emails: list[str] = []

    for row in reader:
        row_num += 1
        if row_num > max_rows + 2:
            errors.append(f"Stopped after {max_rows} data rows")
            break
        total_rows += 1

        def col(key: str) -> str:
            k = fields_lower[key]
            v = row.get(k)
            return sanitize_csv_cell(v or "")

        name = col("name")
        email_raw = col("email")
        phone_raw = col("phone") or ""
        cc_raw = col("country_code") or None

        if not name or not email_raw:
            skipped += 1
            errors.append(f"Row {row_num}: name and email required")
            continue

        try:
            email_adapter.validate_python(email_raw)
        except ValidationError:
            skipped += 1
            errors.append(f"Row {row_num}: invalid email")
            continue

        if not phone_raw.strip():
            skipped += 1
            errors.append(f"Row {row_num}: phone required")
            continue
        if not is_csv_phone_numeric(phone_raw):
            skipped += 1
            errors.append(f"Row {row_num}: phone must be numeric")
            continue
        phone = phone_raw.strip()

        if not is_valid_import_country_code(cc_raw):
            skipped += 1
            errors.append(f"Row {row_num}: country_code required (+digits or ISO)")
            continue
        cc = normalize_country_code(cc_raw)
        if phone and not is_valid_phone(phone):
            skipped += 1
            errors.append(f"Row {row_num}: invalid phone format")
            continue

        if db.query(Lead).filter(Lead.workspace_id == workspace_id, Lead.email == email_raw).first():
            skipped += 1
            errors.append(f"Row {row_num}: duplicate email in workspace")
            continue

        notes_val = col("notes") if "notes" in fields_lower else ""
        lm_csv = col("last_message") if "last_message" in fields_lower else ""
        last_m = (notes_val or lm_csv or "").strip() or None

        csv_status = col("status") if "status" in fields_lower else ""
        lead_status = _map_csv_status(csv_status or None)

        company = None
        if "company" in fields_lower:
            c = col("company")
            company = c if c else None

        db.add(
            Lead(
                name=name,
                email=email_raw,
                status=lead_status,
                tag=None,
                phone_number=phone,
                country_code=cc,
                company=company,
                last_message=last_m,
                workspace_id=workspace_id,
                temperature_tag="hot",
                owner_user_id=owner_user_id,
            )
        )
        imported_emails.append(email_raw)
        inserted += 1

    db.commit()
    if imported_emails:
        for lead in (
            db.query(Lead)
            .filter(
                Lead.workspace_id == workspace_id,
                Lead.email.in_(imported_emails),
            )
            .all()
        ):
            if lead.created_at:
                lead.temperature_tag = temperature_for_created_at(lead.created_at)
        db.commit()
    return LeadCsvImportResult(
        total_rows=total_rows,
        inserted=inserted,
        skipped=skipped,
        errors=errors[:50],
    )
