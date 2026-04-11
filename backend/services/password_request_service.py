from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.password_request import PasswordRequest
from schemas.pagination import PaginationParams


def submit_password_request(db: Session, email: str) -> None:
    """Create a pending request if none open for this email (idempotent for UX)."""
    raw = (email or "").strip().lower()
    if not raw or "@" not in raw:
        return
    existing = (
        db.query(PasswordRequest)
        .filter(
            func.lower(PasswordRequest.user_email) == raw,
            PasswordRequest.status == "pending",
        )
        .first()
    )
    if existing:
        return
    db.add(
        PasswordRequest(
            user_email=raw,
            status="pending",
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    # Acknowledgment to the user (best-effort; failures go to system_logs).
    from services import template_mail_service as tm

    nm = (raw.split("@", 1)[0] or "there").strip()
    pv = tm.project_variables(db)
    tm.try_send_template(
        db,
        tm.TEMPLATE_PASSWORD_REQUEST_RECEIVED,
        raw,
        {"name": nm, "email": raw, **pv},
    )


def list_password_requests(
    db: Session,
    *,
    page: int,
    limit: int,
    q: str | None = None,
    status_filter: str | None = None,
) -> tuple[list[PasswordRequest], int]:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    query = db.query(PasswordRequest)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(PasswordRequest.user_email.ilike(term))
    if status_filter in ("pending", "resolved"):
        query = query.filter(PasswordRequest.status == status_filter)
    query = query.order_by(PasswordRequest.id.desc())
    total = query.count()
    offset = (page - 1) * limit
    rows = query.offset(offset).limit(limit).all()
    return rows, total


def resolve_password_request(db: Session, request_id: int) -> PasswordRequest:
    row = db.get(PasswordRequest, request_id)
    if not row:
        raise ValueError("not found")
    row.status = "resolved"
    db.commit()
    db.refresh(row)
    return row
