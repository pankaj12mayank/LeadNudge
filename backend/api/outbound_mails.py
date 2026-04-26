from math import ceil
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import Principal, require_user
from db.session import get_db
from schemas.outbound_mail import OutboundMailOut, PaginatedOutboundMails
from schemas.pagination import PaginationParams
from services import outbound_mail_service

router = APIRouter(prefix="/outbound-mails", tags=["outbound-mails"])


@router.get("", response_model=PaginatedOutboundMails)
def list_outbound_mails(
    principal: Annotated[Principal, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
    q: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
) -> PaginatedOutboundMails:
    if principal.workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    rows, total = outbound_mail_service.list_outbound_mails(
        db,
        workspace_id=principal.workspace_id,
        page=page,
        limit=limit,
        search=q,
        owner_user_id=principal.user_id,
    )
    items = [OutboundMailOut.model_validate(r) for r in rows]
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedOutboundMails(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )
