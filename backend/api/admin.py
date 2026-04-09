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
    BrandingOut,
    BrandingUpdate,
)
from schemas.settings import AdminSettingsUpdate, SettingsOut
from schemas.pagination import PaginationParams
from schemas.user import PaginatedUsers, UserCreate, UserOut
from schemas.workspace import WorkspaceOut, WorkspacePlanUpdate
from services import admin_service, admin_account_service, branding_service
from services.settings_service import get_settings_out

router = APIRouter(prefix="/admin", tags=["admin"])


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
    return BrandingOut(
        project_name=b.project_name,
        logo_url=branding_service.logo_public_path(b.logo_filename),
    )


@router.put("/branding", response_model=BrandingOut)
def put_branding(
    body: BrandingUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> BrandingOut:
    b = branding_service.update_project_name(db, body.project_name)
    return BrandingOut(
        project_name=b.project_name,
        logo_url=branding_service.logo_public_path(b.logo_filename),
    )


@router.post("/branding/logo", response_model=BrandingOut)
async def post_branding_logo(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
) -> BrandingOut:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    b = await branding_service.save_logo_file(db, UPLOAD_DIR, file)
    return BrandingOut(
        project_name=b.project_name,
        logo_url=branding_service.logo_public_path(b.logo_filename),
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
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
) -> PaginatedUsers:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    users, total = admin_service.list_users(db, workspace_id, page=page, limit=limit)
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedUsers(
        items=[UserOut.model_validate(u) for u in users],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.put("/settings", response_model=SettingsOut)
def update_settings(
    body: AdminSettingsUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SettingsOut:
    row = admin_service.update_admin_settings(db, body)
    return get_settings_out(db, row.workspace_id, mask_api_key=False)
