"""One-time plan-expired emails per workspace (admin-editable template)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from models.user import User
from models.workspace import Workspace
from services import template_mail_service as tm
from services.plan_access_service import workspace_plan_expired


def maybe_send_plan_expired_emails(db: Session, workspace_id: int) -> None:
    """
    When the workspace end date has passed, email active members once using TEMPLATE_PLAN_EXPIRED.
    Cleared when an admin sets a future plan_expires_at.
    """
    ws = db.get(Workspace, workspace_id)
    if not ws or not workspace_plan_expired(db, workspace_id):
        return
    if ws.plan_expired_email_sent:
        return

    users = (
        db.query(User)
        .filter(User.workspace_id == workspace_id, User.is_active.is_(True))
        .all()
    )
    pv = tm.project_variables(db)
    for u in users:
        nm = (u.display_name or (u.email or "").split("@")[0] or "there").strip()
        tm.try_send_template(
            db,
            tm.TEMPLATE_PLAN_EXPIRED,
            u.email or "",
            {"name": nm, "email": u.email or "", **pv},
        )
    ws.plan_expired_email_sent = True
    db.commit()
    db.refresh(ws)
    from services import usage_history_service as uh

    uh.append_for_workspace_users(
        db,
        workspace_id,
        action_type=uh.ACTION_EXPIRE,
        plan_type=(ws.plan_type or "free").lower(),
        expiry_date=ws.plan_expires_at,
        summary="Workspace plan end date reached; AI features disabled until renewal.",
    )


def clear_expiry_email_flag_if_plan_valid(db: Session, workspace_id: int) -> None:
    ws = db.get(Workspace, workspace_id)
    if not ws:
        return
    if not workspace_plan_expired(db, workspace_id) and ws.plan_expired_email_sent:
        ws.plan_expired_email_sent = False
        db.commit()
