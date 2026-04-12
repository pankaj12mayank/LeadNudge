from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.security import hash_password
from core.workspaces import FREE_WORKSPACE_NAME, PRO_WORKSPACE_NAME
from models.settings import WorkspaceSettings
from models.user import User
from models.workspace import Workspace
from schemas.pagination import PaginationParams
from schemas.settings import AdminSettingsUpdate
from schemas.user import UserAdminPatch, UserCreate, UserListItemOut
from services import usage_history_service
from schemas.workspace import WorkspacePlanUpdate
from services import system_log_service, template_mail_service as tm

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


def list_workspaces_with_settings(
    db: Session,
) -> list[tuple[Workspace, WorkspaceSettings | None]]:
    """Fixed workspaces plus settings row in one round-trip (admin UI)."""
    return (
        db.query(Workspace, WorkspaceSettings)
        .outerjoin(
            WorkspaceSettings, WorkspaceSettings.workspace_id == Workspace.id
        )
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
    plain = data.password
    user = User(
        email=data.email,
        password=hash_password(plain),
        workspace_id=ws.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    st = get_workspace_settings(db, ws.id)
    user.ai_message_limit = max(0, int(st.usage_limit or 0))
    db.commit()
    db.refresh(user)
    pv = tm.project_variables(db)
    nm = (user.display_name or (user.email or "").split("@")[0] or "there").strip()
    tm.try_send_template(
        db,
        tm.TEMPLATE_ACCOUNT_CREATED,
        user.email,
        {"name": nm, "email": user.email, "password": plain, **pv},
    )
    return user


def list_users(
    db: Session,
    workspace_id: int | None,
    *,
    page: int,
    limit: int,
    search: str | None = None,
    plan: str | None = None,
    active: bool | None = None,
) -> tuple[list[User], int]:
    if plan in ("free", "pro"):
        q = db.query(User).join(Workspace, User.workspace_id == Workspace.id).filter(
            Workspace.plan_type == plan
        )
    else:
        q = db.query(User)
    if workspace_id is not None:
        q = q.filter(User.workspace_id == workspace_id)
    if active is True:
        q = q.filter(User.is_active.is_(True))
    elif active is False:
        q = q.filter(User.is_active.is_(False))
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                User.email.ilike(term),
                User.display_name.ilike(term),
            )
        )
    total = q.count()
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    offset = (page - 1) * limit
    items = q.order_by(User.id).offset(offset).limit(limit).all()
    return items, total


def users_with_workspace_quota_context(
    db: Session, users: list[User]
) -> list[UserListItemOut]:
    """Attach per-user AI usage vs effective cap."""
    from services.plan_access_service import (
        user_ai_quota_exhausted,
        user_effective_ai_limit,
    )
    from services.settings_service import count_user_ai_messages

    if not users:
        return []
    wids = list({u.workspace_id for u in users})
    workspaces = {
        w.id: w for w in db.query(Workspace).filter(Workspace.id.in_(wids)).all()
    }
    out: list[UserListItemOut] = []
    for u in users:
        ws = workspaces.get(u.workspace_id)

        lim = user_effective_ai_limit(db, u.id)
        used = count_user_ai_messages(db, u.id)
        exhausted = user_ai_quota_exhausted(db, u.id)
        p = (ws.plan_type or "free").lower() if ws else "free"
        out.append(
            UserListItemOut(
                id=u.id,
                email=u.email,
                workspace_id=u.workspace_id,
                display_name=u.display_name,
                phone=u.phone,
                is_active=u.is_active,
                ai_message_limit=u.ai_message_limit,
                workspace_plan_type=p,
                workspace_ai_limit=lim,
                workspace_ai_used=used,
                workspace_ai_quota_exhausted=exhausted,
            )
        )
    return out


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
    db: Session,
    workspace_id: int,
    data: WorkspacePlanUpdate,
    *,
    changed_by: int | None = None,
) -> Workspace:
    ws = db.get(Workspace, workspace_id)
    if not ws or ws.name not in (FREE_WORKSPACE_NAME, PRO_WORKSPACE_NAME):
        raise HTTPException(status_code=404, detail="Workspace not found")
    old_plan = (ws.plan_type or "free").lower()
    old_exp = ws.plan_expires_at
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    old_lim = max(0, int(row.usage_limit or 0)) if row else 0

    ws.plan_type = data.plan_type
    ws.plan_expires_at = data.plan_expires_at
    if row:
        row.usage_limit = _usage_limit_for_plan(data.plan_type)
        row.usage_email_90_sent = False
        row.usage_email_limit_sent = False
        if data.plan_type == "free":
            row.api_key = None
            row.ai_mode = "local"
    db.commit()
    db.refresh(ws)
    if row:
        db.refresh(row)

    from services.plan_expiry_notify_service import clear_expiry_email_flag_if_plan_valid

    clear_expiry_email_flag_if_plan_valid(db, workspace_id)

    new_lim = max(0, int(row.usage_limit or 0)) if row else 0
    plan_changed = old_plan != (data.plan_type or "free").lower()
    lim_changed = old_lim != new_lim
    exp_changed = old_exp != data.plan_expires_at
    if plan_changed or lim_changed or exp_changed:
        if plan_changed and data.plan_type == "pro" and old_plan != "pro":
            action = usage_history_service.ACTION_UPGRADE
        elif plan_changed and data.plan_type == "free" and old_plan == "pro":
            action = usage_history_service.ACTION_DOWNGRADE
        elif exp_changed and not plan_changed and not lim_changed:
            action = usage_history_service.ACTION_PLAN_RENEW
        else:
            action = usage_history_service.ACTION_WORKSPACE_PLAN_CHANGE
        usage_history_service.append_for_workspace_users(
            db,
            workspace_id,
            action_type=action,
            old_limit=old_lim,
            new_limit=new_lim,
            plan_type=data.plan_type,
            expiry_date=ws.plan_expires_at,
            changed_by=changed_by,
            summary="Admin updated workspace plan, cap, or expiry.",
        )
    return ws


def update_admin_settings(
    db: Session,
    data: AdminSettingsUpdate,
    *,
    changed_by: int | None = None,
) -> WorkspaceSettings:
    ws = db.get(Workspace, data.workspace_id)
    if not ws or ws.name not in (FREE_WORKSPACE_NAME, PRO_WORKSPACE_NAME):
        raise HTTPException(status_code=404, detail="Workspace not found")
    plan = (ws.plan_type or "free").lower()
    row = get_workspace_settings(db, data.workspace_id)
    old_lim = max(0, int(row.usage_limit or 0))
    if data.ai_mode is not None:
        if plan != "pro" and data.ai_mode == "api":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OpenAI (API) mode is only for the Pro workspace.",
            )
        row.ai_mode = data.ai_mode
    if data.api_key is not None:
        if plan != "pro" and (data.api_key or "").strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workspace API keys are only allowed on the Pro workspace.",
            )
        row.api_key = data.api_key or None
    if data.usage_limit is not None:
        row.usage_limit = data.usage_limit
        row.usage_email_90_sent = False
        row.usage_email_limit_sent = False
    # Allow clearing workspace override with explicit null in JSON (PUT body).
    if "ollama_model" in data.model_fields_set:
        row.ollama_model = (data.ollama_model or "").strip() or None
    if plan != "pro":
        row.ai_mode = "local"
        row.api_key = None
    db.commit()
    db.refresh(row)
    db.refresh(ws)
    new_lim_final = max(0, int(row.usage_limit or 0))
    if data.usage_limit is not None and old_lim != new_lim_final:
        usage_history_service.append_for_workspace_users(
            db,
            data.workspace_id,
            action_type=usage_history_service.ACTION_LIMIT_UPDATE,
            old_limit=old_lim,
            new_limit=new_lim_final,
            plan_type=plan,
            expiry_date=ws.plan_expires_at,
            changed_by=changed_by,
            summary="Admin changed workspace AI message limit.",
        )
    return row


def delete_user(db: Session, user_id: int) -> None:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    email = u.email
    nm = (u.display_name or (email or "").split("@")[0] or "there").strip()
    pv = tm.project_variables(db)
    db.delete(u)
    db.commit()
    tm.try_send_template(
        db,
        tm.TEMPLATE_ACCOUNT_DELETED,
        email,
        {"name": nm, "email": email or "", **pv},
    )


def move_user_to_workspace_plan(
    db: Session,
    user_id: int,
    plan: Literal["free", "pro"],
    *,
    changed_by: int | None,
) -> User:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    new_ws = workspace_for_plan(db, plan)
    if u.workspace_id == new_ws.id:
        return u
    old_wid = u.workspace_id
    old_ws = db.get(Workspace, old_wid)
    old_st = get_workspace_settings(db, old_wid)
    old_plan = (old_ws.plan_type or "free").lower() if old_ws else "free"
    old_lim = max(0, int(old_st.usage_limit or 0))
    u.workspace_id = new_ws.id
    db.commit()
    db.refresh(u)
    new_st = get_workspace_settings(db, new_ws.id)
    new_lim = max(0, int(new_st.usage_limit or 0))
    if plan == "pro" and old_plan != "pro":
        action = usage_history_service.ACTION_UPGRADE
    elif plan == "free" and old_plan == "pro":
        action = usage_history_service.ACTION_DOWNGRADE
    else:
        action = usage_history_service.ACTION_WORKSPACE_PLAN_CHANGE
    usage_history_service.append_entry(
        db,
        user_id=u.id,
        workspace_id=new_ws.id,
        action_type=action,
        old_limit=old_lim,
        new_limit=new_lim,
        plan_type=plan,
        expiry_date=new_ws.plan_expires_at,
        changed_by=changed_by,
        summary=f"User moved to {plan} workspace pool.",
    )
    return u


def patch_user(
    db: Session,
    user_id: int,
    data: UserAdminPatch,
    *,
    changed_by: int | None = None,
) -> User:
    from services.plan_access_service import user_effective_ai_limit

    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if data.plan is not None:
        u = move_user_to_workspace_plan(
            db, user_id, data.plan, changed_by=changed_by
        )
    was_active = u.is_active
    if data.is_active is not None:
        u.is_active = data.is_active
    if data.display_name is not None:
        u.display_name = data.display_name.strip() or None

    if "ai_message_limit" in data.model_fields_set:
        old_eff = user_effective_ai_limit(db, u.id)
        if data.ai_message_limit is None:
            u.ai_message_limit = None
        else:
            u.ai_message_limit = max(0, int(data.ai_message_limit))
        u.usage_email_90_sent = False
        u.usage_email_limit_sent = False
        db.flush()
        new_eff = user_effective_ai_limit(db, u.id)
        if old_eff != new_eff:
            ws = db.get(Workspace, u.workspace_id)
            usage_history_service.append_entry(
                db,
                user_id=u.id,
                workspace_id=u.workspace_id,
                action_type=usage_history_service.ACTION_LIMIT_UPDATE,
                old_limit=old_eff,
                new_limit=new_eff,
                plan_type=(ws.plan_type or "free").lower() if ws else None,
                expiry_date=ws.plan_expires_at if ws else None,
                changed_by=changed_by,
                summary="Admin set your personal AI message cap.",
            )

    db.commit()
    db.refresh(u)
    if data.is_active is not None and was_active != u.is_active:
        pv = tm.project_variables(db)
        nm = (u.display_name or (u.email or "").split("@")[0] or "there").strip()
        key = (
            tm.TEMPLATE_ACCOUNT_ACTIVATED
            if u.is_active
            else tm.TEMPLATE_ACCOUNT_DEACTIVATED
        )
        tm.try_send_template(
            db,
            key,
            u.email,
            {"name": nm, "email": u.email or "", **pv},
        )
    return u


def admin_set_user_password(db: Session, user_id: int, new_password: str) -> User:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.password = hash_password(new_password)
    db.commit()
    db.refresh(u)
    pv = tm.project_variables(db)
    nm = (u.display_name or (u.email or "").split("@")[0] or "there").strip()
    tm.try_send_template(
        db,
        tm.TEMPLATE_PASSWORD_CHANGED,
        u.email,
        {"name": nm, "email": u.email or "", "password": new_password, **pv},
    )
    try:
        system_log_service.log_event(
            db,
            kind="SECURITY",
            message=(
                f"Admin set password user_id={user_id} email={u.email}; "
                "password_changed email queued (see EMAIL logs for SMTP result)."
            )[:2000],
        )
    except Exception:
        pass
    return u
