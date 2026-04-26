import csv
import io
import uuid
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
    LeadCreate,
    LeadCsvImportResult,
    LeadUpdate,
    normalize_csv_lead_type,
    normalize_csv_status_value,
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
    assignee_user_id: int | None = None,
) -> tuple[list[Lead], int]:
    q = db.query(Lead)
    if is_admin:
        if workspace_id is not None:
            q = q.filter(Lead.workspace_id == workspace_id)
        if assignee_user_id is not None:
            q = q.filter(Lead.owner_user_id == assignee_user_id)
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
            or_(
                Lead.name.ilike(term),
                Lead.email.ilike(term),
                Lead.company.ilike(term),
                Lead.role_title.ilike(term),
                Lead.profile_link.ilike(term),
                Lead.agency_type.ilike(term),
                Lead.team_size_estimate.ilike(term),
                Lead.problem_seen.ilike(term),
                Lead.last_active_display.ilike(term),
                Lead.connection_sent_date.ilike(term),
                Lead.replied_y_n.ilike(term),
                Lead.solution.ilike(term),
                Lead.lead_type.ilike(term),
            )
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
    co = (data.company or "").strip() or None
    lead = Lead(
        name=data.name,
        email=data.email,
        status=data.status,
        tag=data.tag,
        phone_number=data.phone_number,
        country_code=data.country_code,
        company=co,
        role_title=(data.role_title or "").strip() or None,
        profile_link=(data.profile_link or "").strip() or None,
        agency_type=(data.agency_type or "").strip() or None,
        team_size_estimate=(data.team_size_estimate or "").strip() or None,
        problem_seen=(data.problem_seen or "").strip() or None,
        last_active_display=(data.last_active_display or "").strip() or None,
        connection_sent_date=(data.connection_sent_date or "").strip() or None,
        replied_y_n=(data.replied_y_n or "").strip() or None,
        solution=(data.solution or "").strip() or None,
        lead_type=data.lead_type,
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
    if data.role_title is not None:
        lead.role_title = (data.role_title or "").strip() or None
    if data.profile_link is not None:
        lead.profile_link = (data.profile_link or "").strip() or None
    if data.agency_type is not None:
        lead.agency_type = (data.agency_type or "").strip() or None
    if data.team_size_estimate is not None:
        lead.team_size_estimate = (data.team_size_estimate or "").strip() or None
    if data.problem_seen is not None:
        lead.problem_seen = (data.problem_seen or "").strip() or None
    if data.last_active_display is not None:
        lead.last_active_display = (data.last_active_display or "").strip() or None
    if data.connection_sent_date is not None:
        lead.connection_sent_date = (data.connection_sent_date or "").strip() or None
    if data.replied_y_n is not None:
        lead.replied_y_n = (data.replied_y_n or "").strip() or None
    if data.solution is not None:
        lead.solution = (data.solution or "").strip() or None
    if data.lead_type is not None:
        lead.lead_type = data.lead_type
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


def _norm_csv_header(s: str) -> str:
    return " ".join(str(s).strip().lower().split())


def _csv_header_map(fieldnames: list[str]) -> dict[str, str]:
    """Normalized header -> original column label from CSV."""
    m: dict[str, str] = {}
    for f in fieldnames:
        if f is None or not str(f).strip():
            continue
        m[_norm_csv_header(str(f))] = str(f).strip()
    return m


def _csv_cell(row: dict, hm: dict[str, str], *norm_variants: str) -> str:
    for nv in norm_variants:
        k = _norm_csv_header(nv)
        if k in hm:
            return sanitize_csv_cell(row.get(hm[k]) or "")
    return ""


def _csv_col_by_prefix(hm: dict[str, str], row: dict, prefix: str) -> str:
    for nk, orig in hm.items():
        if nk.startswith(prefix):
            return sanitize_csv_cell(row.get(orig) or "")
    return ""


def _synthetic_import_email(workspace_id: int) -> str:
    return f"import-{uuid.uuid4().hex[:22]}@ws{workspace_id}.invalid"


def _is_legacy_phone_csv(hm: dict[str, str]) -> bool:
    has_phone = "phone" in hm or "phone number" in hm
    has_cc = "country_code" in hm or "country code" in hm
    return bool(has_phone and has_cc)


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
    hm = _csv_header_map([str(f) for f in reader.fieldnames if f is not None])
    legacy = _is_legacy_phone_csv(hm)
    if not legacy and "name" not in hm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must include a Name column (or legacy columns: name, email, phone, country_code)",
        )
    if legacy:
        if "name" not in hm or "email" not in hm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Legacy CSV must include columns: name, email",
            )
        if "phone" not in hm and "phone number" not in hm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Legacy CSV must include column: phone (or phone number)",
            )
        if "country_code" not in hm and "country code" not in hm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Legacy CSV must include column: country_code (or country code)",
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

        def cl(key: str) -> str:
            k = _norm_csv_header(key)
            if k in hm:
                return sanitize_csv_cell(row.get(hm[k]) or "")
            return ""

        if legacy:
            name = cl("name")
            email_raw = cl("email")
            phone_raw = cl("phone") or cl("phone number") or ""
            cc_raw = cl("country_code") or cl("country code") or None
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
            notes_val = cl("notes") if "notes" in hm else ""
            lm_csv = cl("last_message") if "last_message" in hm else ""
            legacy_note = (notes_val or lm_csv or "").strip() or None
            csv_st = cl("status") if "status" in hm else ""
            lead_status = normalize_csv_status_value(csv_st or None)
            company = None
            if "company" in hm:
                c = cl("company")
                company = c if c else None
            role_title = profile_link = agency_type = team_size_estimate = None
            problem_seen = legacy_note
            last_active_display = connection_sent_date = replied_y_n = None
            solution_legacy = (cl("solution") or "").strip() or None
            lead_type_legacy = normalize_csv_lead_type(
                (cl("lead type") or cl("lead_type") or "").strip() or None
            )
        else:
            name = _csv_cell(row, hm, "name")
            if not name:
                skipped += 1
                errors.append(f"Row {row_num}: name required")
                continue
            email_raw = _csv_cell(row, hm, "email", "e-mail")
            if not email_raw.strip():
                email_raw = _synthetic_import_email(workspace_id)
            try:
                email_adapter.validate_python(email_raw)
            except ValidationError:
                skipped += 1
                errors.append(f"Row {row_num}: invalid email")
                continue
            phone_raw = _csv_cell(row, hm, "phone", "phone number")
            cc_raw = _csv_cell(row, hm, "country_code", "country code") or None
            phone = None
            cc = None
            if phone_raw.strip():
                if not is_csv_phone_numeric(phone_raw):
                    skipped += 1
                    errors.append(f"Row {row_num}: phone must be numeric when provided")
                    continue
                phone = phone_raw.strip()
                if not is_valid_import_country_code(cc_raw):
                    skipped += 1
                    errors.append(
                        f"Row {row_num}: country_code required when phone is set",
                    )
                    continue
                cc = normalize_country_code(cc_raw)
                if not is_valid_phone(phone):
                    skipped += 1
                    errors.append(f"Row {row_num}: invalid phone format")
                    continue
            company = _csv_cell(row, hm, "company") or None
            role_title = _csv_cell(row, hm, "role") or None
            profile_link = _csv_cell(row, hm, "profile link", "profile_link") or None
            agency_type = _csv_col_by_prefix(hm, row, "agency type") or None
            team_size = _csv_col_by_prefix(hm, row, "team size") or None
            problem_seen = _csv_cell(row, hm, "problem seen") or None
            notes_only = _csv_cell(row, hm, "notes").strip() or None
            if notes_only:
                if problem_seen:
                    problem_seen = f"{problem_seen}\n\n(Imported note: {notes_only})"
                else:
                    problem_seen = notes_only
            last_active_display = _csv_cell(row, hm, "last active") or None
            connection_sent_date = _csv_col_by_prefix(hm, row, "connection sent") or None
            replied_raw = ""
            for nk, orig in hm.items():
                if "replied" in nk:
                    replied_raw = sanitize_csv_cell(row.get(orig) or "")
                    break
            replied_y_n = replied_raw or None
            team_size_estimate = team_size or None
            csv_status = _csv_cell(row, hm, "status")
            lead_status = normalize_csv_status_value(csv_status or None)
            solution = _csv_cell(row, hm, "solution") or None
            lt_raw = _csv_cell(row, hm, "lead type", "lead_type", "leadtype")
            lead_type_imp = normalize_csv_lead_type(lt_raw or None)

        if db.query(Lead).filter(Lead.workspace_id == workspace_id, Lead.email == email_raw).first():
            skipped += 1
            errors.append(f"Row {row_num}: duplicate email in workspace")
            continue

        if legacy:
            db.add(
                Lead(
                    name=name,
                    email=email_raw,
                    status=lead_status,
                    tag=None,
                    phone_number=phone,
                    country_code=cc,
                    company=company,
                    role_title=None,
                    profile_link=None,
                    agency_type=None,
                    team_size_estimate=None,
                    problem_seen=problem_seen,
                    last_active_display=None,
                    connection_sent_date=None,
                    replied_y_n=None,
                    solution=solution_legacy,
                    lead_type=lead_type_legacy,
                    workspace_id=workspace_id,
                    temperature_tag="hot",
                    owner_user_id=owner_user_id,
                )
            )
        else:
            db.add(
                Lead(
                    name=name,
                    email=email_raw,
                    status=lead_status,
                    tag=None,
                    phone_number=phone,
                    country_code=cc,
                    company=company or None,
                    role_title=role_title,
                    profile_link=profile_link,
                    agency_type=agency_type,
                    team_size_estimate=team_size_estimate,
                    problem_seen=problem_seen,
                    last_active_display=last_active_display,
                    connection_sent_date=connection_sent_date,
                    replied_y_n=replied_y_n,
                    solution=solution or None,
                    lead_type=lead_type_imp,
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
