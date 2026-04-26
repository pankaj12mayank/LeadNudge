from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.outbound_email import OutboundEmail
from schemas.pagination import PaginationParams


def list_outbound_mails(
    db: Session,
    *,
    workspace_id: int,
    page: int,
    limit: int,
    search: str | None = None,
    owner_user_id: int | None = None,
) -> tuple[list[OutboundEmail], int]:
    q = db.query(OutboundEmail).filter(OutboundEmail.workspace_id == workspace_id)
    if owner_user_id is not None:
        q = q.filter(OutboundEmail.owner_user_id == owner_user_id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                OutboundEmail.to_email.ilike(term),
                OutboundEmail.lead_name.ilike(term),
                OutboundEmail.subject.ilike(term),
            )
        )
    total = q.count()
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    offset = (page - 1) * limit
    rows = (
        q.order_by(OutboundEmail.sent_at.desc(), OutboundEmail.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return rows, total
