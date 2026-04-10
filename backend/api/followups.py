from math import ceil
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import Principal, get_principal
from db.session import get_db
from schemas.followup import (
    FollowupCreate,
    FollowupCreateResponse,
    FollowupOut,
    MessageOut,
    PaginatedFollowups,
)
from schemas.pagination import PaginationParams
from services import followup_service

router = APIRouter(prefix="/followups", tags=["followups"])


def _workspace_scope(principal: Principal, workspace_id: int | None) -> int | None:
    if principal.role == "admin":
        return workspace_id
    return principal.workspace_id


@router.get("", response_model=PaginatedFollowups)
def list_followups(
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
) -> PaginatedFollowups:
    if principal.role == "user" and workspace_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot scope other workspaces",
        )
    wid = _workspace_scope(principal, workspace_id)
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    rows, total = followup_service.list_followups(
        db, workspace_id=wid, is_admin=principal.role == "admin", page=page, limit=limit
    )
    out: list[FollowupOut] = []
    for fu, last_msg in rows:
        out.append(
            FollowupOut(
                id=fu.id,
                lead_id=fu.lead_id,
                scheduled_at=fu.scheduled_at,
                status=fu.status,
                last_message=last_msg,
                failure_reason=fu.failure_reason,
            )
        )
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedFollowups(
        items=out,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.post("", response_model=FollowupCreateResponse)
def create_followup(
    body: FollowupCreate,
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
) -> FollowupCreateResponse:
    fu, msg = followup_service.create_followup(
        db,
        body,
        workspace_id=principal.workspace_id,
        is_admin=principal.role == "admin",
    )
    return FollowupCreateResponse(
        followup=FollowupOut(
            id=fu.id,
            lead_id=fu.lead_id,
            scheduled_at=fu.scheduled_at,
            status=fu.status,
            last_message=msg.content if msg else None,
            failure_reason=fu.failure_reason,
        ),
        message=MessageOut.model_validate(msg) if msg else None,
    )
