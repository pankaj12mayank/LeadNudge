"""Workspace AI quota: warning at ~90%, exhaustion email at 100% (admin-editable templates)."""

from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from models.lead import Lead
from models.message import Message
from models.settings import WorkspaceSettings
from models.user import User
from services import template_mail_service as tm
from services.plan_access_service import workspace_usage_limit


def _workspace_ai_message_count(db: Session, workspace_id: int) -> int:
    stmt = (
        select(func.count())
        .select_from(Message)
        .join(Lead, Message.lead_id == Lead.id)
        .where(Lead.workspace_id == workspace_id)
    )
    return int(db.execute(stmt).scalar_one())


def _workspace_active_users(db: Session, workspace_id: int) -> list[User]:
    return (
        db.query(User)
        .filter(User.workspace_id == workspace_id, User.is_active.is_(True))
        .all()
    )


def reset_usage_email_flags(db: Session, row: WorkspaceSettings) -> None:
    """Call when admin raises quota so 90% / limit emails can fire again if needed."""
    row.usage_email_90_sent = False
    row.usage_email_limit_sent = False
    db.commit()


def sync_usage_threshold_emails(db: Session, workspace_id: int) -> None:
    """
    Send at most one 90% warning and one limit-reached email per quota cycle.
    Clears the 90% flag when usage drops back below 90% (e.g. after admin raises limit).
    """
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if not row:
        return

    lim = workspace_usage_limit(db, workspace_id)
    if lim <= 0:
        return

    used = _workspace_ai_message_count(db, workspace_id)
    threshold_90 = int(lim * 0.9 + 0.9999)
    pct = round((100.0 * used / lim) if lim else 0.0, 1)

    if used < threshold_90:
        dirty = False
        if row.usage_email_90_sent:
            row.usage_email_90_sent = False
            dirty = True
        if used < lim and row.usage_email_limit_sent:
            row.usage_email_limit_sent = False
            dirty = True
        if dirty:
            db.commit()
        return

    if used < lim and row.usage_email_limit_sent:
        row.usage_email_limit_sent = False
        db.commit()

    users = _workspace_active_users(db, workspace_id)
    if not users:
        return

    pv = tm.project_variables(db)

    if used >= lim:
        if not row.usage_email_limit_sent:
            for u in users:
                nm = (u.display_name or (u.email or "").split("@")[0] or "there").strip()
                tm.try_send_template(
                    db,
                    tm.TEMPLATE_USAGE_LIMIT_REACHED,
                    u.email or "",
                    {
                        "name": nm,
                        "email": u.email or "",
                        "used": str(used),
                        "limit": str(lim),
                        "usage_percent": str(pct),
                        **pv,
                    },
                )
            row.usage_email_limit_sent = True
            db.commit()
        return

    if used >= threshold_90 and used < lim:
        if not row.usage_email_90_sent:
            for u in users:
                nm = (u.display_name or (u.email or "").split("@")[0] or "there").strip()
                tm.try_send_template(
                    db,
                    tm.TEMPLATE_USAGE_WARNING_90,
                    u.email or "",
                    {
                        "name": nm,
                        "email": u.email or "",
                        "used": str(used),
                        "limit": str(lim),
                        "usage_percent": str(pct),
                        **pv,
                    },
                )
            row.usage_email_90_sent = True
            db.commit()


def sync_user_usage_threshold_emails(db: Session, user_id: int) -> None:
    """
    Per-user 90% / limit emails (flags on users row).
    """
    from services.plan_access_service import user_effective_ai_limit
    from services.settings_service import count_user_ai_messages

    u = db.get(User, user_id)
    if not u or not u.is_active:
        return

    lim = user_effective_ai_limit(db, user_id)
    if lim <= 0:
        return

    used = count_user_ai_messages(db, user_id)
    threshold_90 = int(lim * 0.9 + 0.9999)
    pct = round((100.0 * used / lim) if lim else 0.0, 1)

    if used < threshold_90:
        dirty = False
        if u.usage_email_90_sent:
            u.usage_email_90_sent = False
            dirty = True
        if used < lim and u.usage_email_limit_sent:
            u.usage_email_limit_sent = False
            dirty = True
        if dirty:
            db.commit()
        return

    if used < lim and u.usage_email_limit_sent:
        u.usage_email_limit_sent = False
        db.commit()

    pv = tm.project_variables(db)
    nm = (u.display_name or (u.email or "").split("@")[0] or "there").strip()

    if used >= lim:
        if not u.usage_email_limit_sent:
            tm.try_send_template(
                db,
                tm.TEMPLATE_USAGE_LIMIT_REACHED,
                u.email or "",
                {
                    "name": nm,
                    "email": u.email or "",
                    "used": str(used),
                    "limit": str(lim),
                    "usage_percent": str(pct),
                    **pv,
                },
            )
            u.usage_email_limit_sent = True
            db.commit()
        return

    if used >= threshold_90 and used < lim:
        if not u.usage_email_90_sent:
            tm.try_send_template(
                db,
                tm.TEMPLATE_USAGE_WARNING_90,
                u.email or "",
                {
                    "name": nm,
                    "email": u.email or "",
                    "used": str(used),
                    "limit": str(lim),
                    "usage_percent": str(pct),
                    **pv,
                },
            )
            u.usage_email_90_sent = True
            db.commit()
