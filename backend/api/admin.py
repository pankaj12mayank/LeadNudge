from math import ceil
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from api.deps import Principal, require_admin
from core.paths import UPLOAD_DIR
from db.session import get_db
from schemas.admin_profile import (
    AdminOut,
    AdminPasswordUpdate,
    AdminProfileUpdate,
    BrandingMailOut,
    BrandingMailUpdate,
    BrandingOut,
    BrandingUpdate,
    MailTestRequest,
)
from schemas.pagination import PaginationParams
from schemas.settings import AdminSettingsUpdate, SettingsOut
from schemas.system_admin import (
    ActivityEntryOut,
    PaginatedUserUsage,
    SystemStatusOut,
)
from schemas.user import PaginatedUsers, UserAdminPatch, UserCreate, UserOut
from schemas.workspace import WorkspaceOut, WorkspacePlanUpdate
from services import admin_service, admin_account_service, branding_service
from services.settings_service import get_settings_out
from services.system_admin_service import (
    list_recent_activity,
    paginated_user_usage,
    get_system_status,
)
from services.transactional_mail import mail_configured, send_plain_email

router = APIRouter(prefix="/admin", tags=["admin"])


def _branding_out(b) -> BrandingOut:
    return BrandingOut(
        project_name=b.project_name,
        logo_url=branding_service.logo_public_path(b.logo_filename),
        favicon_url=branding_service.logo_public_path(b.favicon_filename),
    )


def _branding_mail_out(b) -> BrandingMailOut:
    return BrandingMailOut(
        support_email=b.support_email,
        mail_smtp_host=b.mail_smtp_host,
        mail_smtp_port=b.mail_smtp_port,
        mail_smtp_email=b.mail_smtp_email,
        mail_smtp_password="***" if b.mail_smtp_password else None,
        reset_email_subject=b.reset_email_subject,
        reset_email_body=b.reset_email_body,
    )


@router.get("/me", response_model=AdminOut)
def admin_me(
    principal: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminOut:
    admin = admin_account_service.get_admin(db, principal.admin_id)
    return AdminOut.model_validate(admin)


@router.patch("/me", response_model=AdminOut)
def admin_update_profile(
    body: AdminProfileUpdate,
    principal: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminOut:
    admin = admin_account_service.update_profile(db, principal.admin_id, body)
    return AdminOut.model_validate(admin)


@router.post("/me/password", status_code=204)
def admin_change_password(
    body: AdminPasswordUpdate,
    principal: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    admin_account_service.change_password(db, principal.admin_id, body)


@router.get("/branding", response_model=BrandingOut)
def get_branding_admin(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> BrandingOut:
    b = branding_service.get_or_create_branding(db)
    return _branding_out(b)


@router.put("/branding", response_model=BrandingOut)
def put_branding(
    body: BrandingUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> BrandingOut:
    b = branding_service.update_project_name(db, body.project_name)
    return _branding_out(b)


@router.post("/branding/logo", response_model=BrandingOut)
async def post_branding_logo(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
) -> BrandingOut:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    b = await branding_service.save_logo_file(db, UPLOAD_DIR, file)
    return _branding_out(b)


@router.post("/branding/favicon", response_model=BrandingOut)
async def post_branding_favicon(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
) -> BrandingOut:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    b = await branding_service.save_favicon_file(db, UPLOAD_DIR, file)
    return _branding_out(b)


@router.get("/branding/mail", response_model=BrandingMailOut)
def get_branding_mail(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> BrandingMailOut:
    b = branding_service.get_or_create_branding(db)
    return _branding_mail_out(b)


@router.put("/branding/mail", response_model=BrandingMailOut)
def put_branding_mail(
    body: BrandingMailUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> BrandingMailOut:
    b = admin_account_service.apply_branding_mail_settings(db, body)
    return _branding_mail_out(b)


@router.post("/branding/mail/test", status_code=204)
def post_branding_mail_test(
    body: MailTestRequest,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    b = branding_service.get_or_create_branding(db)
    if not mail_configured(b):
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configure SMTP host, port, and sender email first",
        )
    send_plain_email(
        b,
        to_addr=str(body.to_email),
        subject="Test email from your CRM",
        body="This is a test message. Your outgoing mail settings are working.",
    )


@router.get("/system-status", response_model=SystemStatusOut)
def admin_system_status(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SystemStatusOut:
    return get_system_status(db)


@router.get("/activity", response_model=list[ActivityEntryOut])
def admin_activity(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=50),
) -> list[ActivityEntryOut]:
    return list_recent_activity(db, limit=limit)


@router.get("/usage/users", response_model=PaginatedUserUsage)
def admin_usage_users(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
) -> PaginatedUserUsage:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    return paginated_user_usage(
        db, workspace_id=workspace_id, page=page, limit=limit
    )


@router.get("/workspaces", response_model=list[WorkspaceOut])
def list_workspaces(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[WorkspaceOut]:
    items = admin_service.list_workspaces(db)
    return [WorkspaceOut.model_validate(w) for w in items]


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceOut)
def update_workspace_plan(
    workspace_id: int,
    body: WorkspacePlanUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkspaceOut:
    ws = admin_service.update_workspace_plan(db, workspace_id, body)
    return WorkspaceOut.model_validate(ws)


@router.post("/users", response_model=UserOut)
def create_user(
    body: UserCreate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    user = admin_service.create_user(db, body)
    return UserOut.model_validate(user)


@router.get("/users", response_model=PaginatedUsers)
def list_users(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
) -> PaginatedUsers:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    users, total = admin_service.list_users(
        db, workspace_id, page=page, limit=limit, search=q
    )
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedUsers(
        items=[UserOut.model_validate(u) for u in users],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.patch("/users/{user_id}", response_model=UserOut)
def patch_user(
    user_id: int,
    body: UserAdminPatch,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    u = admin_service.patch_user(db, user_id, body)
    return UserOut.model_validate(u)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    admin_service.delete_user(db, user_id)


@router.put("/settings", response_model=SettingsOut)
def update_settings(
    body: AdminSettingsUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SettingsOut:
    row = admin_service.update_admin_settings(db, body)
    return get_settings_out(db, row.workspace_id, mask_api_key=False)
