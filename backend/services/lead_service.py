import csv
import io
from typing import BinaryIO

from fastapi import HTTPException, status
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.validation import is_valid_phone, normalize_country_code
from models.lead import Lead
from schemas.lead import LeadCreate, LeadCsvImportResult, LeadUpdate, sanitize_csv_cell
from schemas.pagination import PaginationParams


def _get_lead_in_workspace(db: Session, lead_id: int, workspace_id: int) -> Lead:
    lead = db.get(Lead, lead_id)
    if not lead or lead.workspace_id != workspace_id:
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
) -> tuple[list[Lead], int]:
    q = db.query(Lead)
    if is_admin:
        if workspace_id is not None:
            q = q.filter(Lead.workspace_id == workspace_id)
    else:
        if workspace_id is None:
            return [], 0
        q = q.filter(Lead.workspace_id == workspace_id)
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


def create_lead(db: Session, workspace_id: int, data: LeadCreate) -> Lead:
    lead = Lead(
        name=data.name,
        email=data.email,
        status=data.status,
        tag=data.tag,
        phone_number=data.phone_number,
        country_code=data.country_code,
        workspace_id=workspace_id,
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
) -> Lead:
    if is_admin:
        lead = db.get(Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
    else:
        assert workspace_id is not None
        lead = _get_lead_in_workspace(db, lead_id, workspace_id)
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
    db.commit()
    db.refresh(lead)
    return lead


def delete_lead(
    db: Session,
    lead_id: int,
    *,
    workspace_id: int | None,
    is_admin: bool,
) -> None:
    if is_admin:
        lead = db.get(Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
    else:
        assert workspace_id is not None
        lead = _get_lead_in_workspace(db, lead_id, workspace_id)
    db.delete(lead)
    db.commit()


def import_leads_from_csv(
    db: Session,
    workspace_id: int,
    file: BinaryIO,
    *,
    max_rows: int = 2000,
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

    for row in reader:
        row_num += 1
        if row_num > max_rows + 2:
            errors.append(f"Stopped after {max_rows} data rows")
            break

        def col(key: str) -> str:
            k = fields_lower[key]
            v = row.get(k)
            return sanitize_csv_cell(v or "")

        name = col("name")
        email_raw = col("email")
        phone = col("phone") or None
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

        cc = normalize_country_code(cc_raw)
        if phone and not is_valid_phone(phone):
            skipped += 1
            errors.append(f"Row {row_num}: invalid phone")
            continue

        if db.query(Lead).filter(Lead.workspace_id == workspace_id, Lead.email == email_raw).first():
            skipped += 1
            errors.append(f"Row {row_num}: duplicate email in workspace")
            continue

        db.add(
            Lead(
                name=name,
                email=email_raw,
                status="new",
                tag=None,
                phone_number=phone,
                country_code=cc,
                workspace_id=workspace_id,
            )
        )
        inserted += 1

    db.commit()
    return LeadCsvImportResult(inserted=inserted, skipped=skipped, errors=errors[:50])
