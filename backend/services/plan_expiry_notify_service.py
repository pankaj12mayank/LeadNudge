"""One-time plan-expired emails per workspace (admin-editable template)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.user import User
from models.workspace import Workspace
from services import branding_service, template_mail_service as tm
from services.plan_access_service import workspace_plan_expired
from services.transactional_mail import mail_configured


def tick_pending_plan_expired_emails(
    db: Session, *, max_workspaces: int = 2
) -> int:
    """
    Try the one-time plan-expired notification for a few workspaces.

    Run from the background scheduler only. Plan-expired mail uses SMTP and must
    not run on interactive endpoints (login, /auth/me, settings) or the portal
    feels hung when the mail server is slow or timing out.
    """
    ids = db.scalars(
        select(Workspace.id)
        .where(Workspace.plan_expired_email_sent.is_(False))
        .order_by(Workspace.id)
        .limit(80)
    ).all()
    n = 0
    for wid in ids:
        wid = int(wid)
        if not workspace_plan_expired(db, wid):
            continue
        maybe_send_plan_expired_emails(db, wid)
        n += 1
        if n >= max_workspaces:
            break
    return n


def maybe_send_plan_expired_emails(db: Session, workspace_id: int) -> None:
    """
    When the workspace end date has passed, email active members once using TEMPLATE_PLAN_EXPIRED.
    Cleared when an admin sets a future plan_expires_at.

    Does not set plan_expired_email_sent if SMTP is not configured or every send fails, so delivery
    can be retried after fixing mail settings.
    """
    ws = db.get(Workspace, workspace_id)
    if not ws or not workspace_plan_expired(db, workspace_id):
        return
    if ws.plan_expired_email_sent:
        return

    b = branding_service.get_or_create_branding(db)
    if not mail_configured(b):
        return

    users = (
        db.query(User)
        .filter(User.workspace_id == workspace_id, User.is_active.is_(True))
        .all()
    )
    pv = tm.project_variables(db)
    any_sent = False
    for u in users:
        email = (u.email or "").strip()
        if not email:
            continue
        nm = (u.display_name or email.split("@")[0] or "there").strip()
        try:
            tm.send_template_email(
                db,
                tm.TEMPLATE_PLAN_EXPIRED,
                email,
                {"name": nm, "email": u.email or "", **pv},
            )
            any_sent = True
        except Exception as e:
            try:
                from services import system_log_service

                system_log_service.log_event(
                    db,
                    kind="EMAIL",
                    message=(
                        f"Plan expired mail FAIL to={email}: {e!s}. "
                        "Check Admin → Account & branding SMTP and the plan_expired template."
                    )[:8000],
                )
            except Exception:
                pass

    with_email = [u for u in users if (u.email or "").strip()]
    if not with_email:
        ws.plan_expired_email_sent = True
    elif any_sent:
        ws.plan_expired_email_sent = True
    else:
        return

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
