from math import ceil
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import Principal, require_user
from db.session import get_db
from schemas.pagination import PaginationParams
from schemas.usage_history import (
    PaginatedMyUsageHistory,
    UsageHistoryDeleteRequest,
    UsageHistoryOut,
)
from schemas.system_admin import DeletedCountOut
from schemas.user import UserOut, UserPasswordUpdate, UserProfileUpdate
from services import user_profile_service
from services import usage_history_service

router = APIRouter(prefix="/account", tags=["account"])


@router.post("/usage-history/delete", response_model=DeletedCountOut)
def delete_my_usage_history(
    body: UsageHistoryDeleteRequest,
    principal: Annotated[Principal, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> DeletedCountOut:
    if principal.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    n = usage_history_service.delete_ids_for_user(
        db, principal.user_id, list(body.ids)
    )
    return DeletedCountOut(deleted=n)


@router.get("/usage-history", response_model=PaginatedMyUsageHistory)
def list_my_usage_history(
    principal: Annotated[Principal, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
    q: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, ge=1, le=100),
) -> PaginatedMyUsageHistory:
    if principal.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    rows, total = usage_history_service.list_for_user_paginated(
        db,
        principal.user_id,
        q=q,
        page=page,
        page_limit=limit,
    )
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedMyUsageHistory(
        items=[UsageHistoryOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("", response_model=UserOut)
def get_my_account(
    principal: Annotated[Principal, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    if principal.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    u = user_profile_service.get_user(db, principal.user_id)
    return UserOut.model_validate(u)


@router.patch("", response_model=UserOut)
def patch_my_account(
    body: UserProfileUpdate,
    principal: Annotated[Principal, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    if principal.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    u = user_profile_service.update_profile(db, principal.user_id, body)
    return UserOut.model_validate(u)


@router.post("/password", status_code=204)
def change_my_password(
    body: UserPasswordUpdate,
    principal: Annotated[Principal, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if principal.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    user_profile_service.change_password(db, principal.user_id, body)
