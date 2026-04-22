from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.deps import Principal, get_principal
from db.session import get_db
from schemas.auth import LoginRequest, MeOut, TokenResponse
from schemas.password_request import PasswordRequestCreate
from models.workspace import Workspace
from services import admin_account_service, auth_service
from services import password_request_service
from services import user_profile_service
from services.plan_access_service import (
    portal_shows_plan_expired_notice,
    user_ai_quota_exhausted,
    user_effective_ai_limit,
)
from services.settings_service import count_user_ai_messages
from utils.logger import get_logger

log = get_logger("auth")

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    data = auth_service.login(db, body.email, body.password)
    return TokenResponse(**data)


@router.post("/password-request", status_code=204)
def submit_password_request(
    body: PasswordRequestCreate,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    """User asks admin for a new password (no token / self-serve reset)."""
    try:
        password_request_service.submit_password_request(db, str(body.email))
    except Exception as e:
        log.exception("password-request failed: %s", e)


@router.get("/me", response_model=MeOut)
def auth_me(
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
) -> MeOut:
    if principal.role == "admin":
        a = admin_account_service.get_admin(db, principal.admin_id)
        return MeOut(
            role="admin",
            email=a.email,
            display_name=a.display_name,
            phone=None,
        )
    if principal.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    u = user_profile_service.get_user(db, principal.user_id)
    auth_service.assert_user_portal_access(db, u)
    ws = db.get(Workspace, u.workspace_id)
    wpt = (ws.plan_type or "free").lower() if ws else "free"
    wid = u.workspace_id
    used = count_user_ai_messages(db, u.id)
    lim = user_effective_ai_limit(db, u.id)
    return MeOut(
        role="user",
        email=u.email,
        display_name=u.display_name,
        phone=u.phone,
        workspace_plan_expired=portal_shows_plan_expired_notice(db, wid, u.id),
        workspace_plan_type=wpt,
        workspace_ai_messages_used=used,
        workspace_ai_limit=lim,
        workspace_ai_quota_exhausted=user_ai_quota_exhausted(db, u.id),
    )
