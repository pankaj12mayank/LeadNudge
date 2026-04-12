from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import Principal, get_principal, require_admin
from db.session import get_db
from schemas.admin_profile import MailTestRequest
from schemas.settings import SettingsOut, SettingsUpdate, SmtpTestResult
from services import branding_service
from services.settings_service import (
    get_settings_out,
    test_smtp_connection,
    update_user_settings,
)
from services.transactional_mail import mail_configured, send_plain_email
from utils.smtp_errors import format_smtp_error

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings(
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int | None = Query(default=None),
) -> SettingsOut:
    if principal.role == "user":
        if workspace_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot read other workspaces",
            )
        if principal.workspace_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session",
            )
        return get_settings_out(db, principal.workspace_id, mask_api_key=True)
    if workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="workspace_id query required for admin",
        )
    return get_settings_out(db, workspace_id, mask_api_key=False)


@router.put("", response_model=SettingsOut)
def put_settings(
    body: SettingsUpdate,
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int | None = Query(default=None),
) -> SettingsOut:
    if principal.role == "user":
        if workspace_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot update other workspaces",
            )
        if principal.workspace_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session",
            )
        update_user_settings(db, principal.workspace_id, body)
        return get_settings_out(db, principal.workspace_id, mask_api_key=True)
    if workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="workspace_id query required for admin",
        )
    from schemas.settings import AdminSettingsUpdate
    from services import admin_service

    admin_service.update_admin_settings(
        db,
        AdminSettingsUpdate(
            workspace_id=workspace_id,
            ai_mode=body.ai_mode,
            api_key=body.api_key,
            usage_limit=body.usage_limit,
        ),
        changed_by=principal.admin_id,
    )
    return get_settings_out(db, workspace_id, mask_api_key=False)


@router.post("/smtp/test", response_model=SmtpTestResult)
def post_smtp_test(
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int | None = Query(default=None),
) -> SmtpTestResult:
    if principal.role != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace users can test SMTP from this endpoint",
        )
    if principal.workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    ok, msg = test_smtp_connection(db, principal.workspace_id)
    return SmtpTestResult(ok=ok, message=msg)


@router.post("/test-email", response_model=SmtpTestResult)
def post_settings_test_email(
    body: MailTestRequest,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SmtpTestResult:
    """Send a test message using branding SMTP; result is logged to logs/email.log."""
    b = branding_service.get_or_create_branding(db)
    if not mail_configured(b):
        return SmtpTestResult(
            ok=False,
            message="Configure SMTP host, port, and sender email first",
        )
    try:
        send_plain_email(
            b,
            to_addr=str(body.to_email),
            subject="Test email from your CRM",
            body="This is a test message. Your outgoing mail settings are working.",
        )
        return SmtpTestResult(ok=True, message="Test email sent successfully.")
    except Exception as e:
        return SmtpTestResult(ok=False, message=format_smtp_error(e))
