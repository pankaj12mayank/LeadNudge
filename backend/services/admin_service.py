from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.security import hash_password
from core.workspaces import FREE_WORKSPACE_NAME, PRO_WORKSPACE_NAME
from models.settings import WorkspaceSettings
from models.user import User
from models.workspace import Workspace
from schemas.pagination import PaginationParams
from schemas.settings import AdminSettingsUpdate
from schemas.user import UserCreate
from schemas.workspace import WorkspacePlanUpdate

# AI message caps by plan (workspace-level); shown in admin UI as Free vs Paid (Pro)
FREE_PLAN_AI_LIMIT = 200
PRO_PLAN_AI_LIMIT = 10_000


def _usage_limit_for_plan(plan_type: str) -> int:
    return PRO_PLAN_AI_LIMIT if plan_type == "pro" else FREE_PLAN_AI_LIMIT


def ensure_fixed_workspaces(db: Session) -> None:
    """Create the two system workspaces and settings rows if missing."""
    pairs: list[tuple[str, Literal["free", "pro"]]] = [
        (FREE_WORKSPACE_NAME, "free"),
        (PRO_WORKSPACE_NAME, "pro"),
    ]
    for name, plan in pairs:
        ws = db.query(Workspace).filter(Workspace.name == name).first()
        if not ws:
            ws = Workspace(name=name, plan_type=plan)
            db.add(ws)
            db.commit()
            db.refresh(ws)
        row = (
            db.query(WorkspaceSettings)
            .filter(WorkspaceSettings.workspace_id == ws.id)
            .first()
        )
        if not row:
            db.add(
                WorkspaceSettings(
                    workspace_id=ws.id,
                    ai_mode="local",
                    api_key=None,
                    usage_limit=_usage_limit_for_plan(plan),
                )
            )
            db.commit()


def list_workspaces(db: Session) -> list[Workspace]:
    return (
        db.query(Workspace)
        .filter(Workspace.name.in_([FREE_WORKSPACE_NAME, PRO_WORKSPACE_NAME]))
        .order_by(Workspace.id)
        .all()
    )


def workspace_for_plan(db: Session, plan: Literal["free", "pro"]) -> Workspace:
    name = FREE_WORKSPACE_NAME if plan == "free" else PRO_WORKSPACE_NAME
    ws = db.query(Workspace).filter(Workspace.name == name).first()
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System workspaces not initialized",
        )
    return ws


def create_user(db: Session, data: UserCreate) -> User:
    ws = workspace_for_plan(db, data.plan)
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=data.email,
        password=hash_password(data.password),
        workspace_id=ws.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_users(
    db: Session,
    workspace_id: int | None,
    *,
    page: int,
    limit: int,
) -> tuple[list[User], int]:
    q = db.query(User)
    if workspace_id is not None:
        q = q.filter(User.workspace_id == workspace_id)
    total = q.count()
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    offset = (page - 1) * limit
    items = q.order_by(User.id).offset(offset).limit(limit).all()
    return items, total


def get_workspace_settings(db: Session, workspace_id: int) -> WorkspaceSettings:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Settings not found")
    return row


def update_workspace_plan(
    db: Session, workspace_id: int, data: WorkspacePlanUpdate
) -> Workspace:
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.name not in (FREE_WORKSPACE_NAME, PRO_WORKSPACE_NAME):
        raise HTTPException(status_code=404, detail="Workspace not found")
    ws.plan_type = data.plan_type
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if row:
        row.usage_limit = _usage_limit_for_plan(data.plan_type)
    db.commit()
    db.refresh(ws)
    return ws


def update_admin_settings(db: Session, data: AdminSettingsUpdate) -> WorkspaceSettings:
    ws = db.get(Workspace, data.workspace_id)
    if not ws or ws.name not in (FREE_WORKSPACE_NAME, PRO_WORKSPACE_NAME):
        raise HTTPException(status_code=404, detail="Workspace not found")
    row = get_workspace_settings(db, data.workspace_id)
    if data.ai_mode is not None:
        row.ai_mode = data.ai_mode
    if data.api_key is not None:
        row.api_key = data.api_key or None
    if data.usage_limit is not None:
        row.usage_limit = data.usage_limit
    db.commit()
    db.refresh(row)
    return row
