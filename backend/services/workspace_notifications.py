"""Workspace-wide user notifications (usage limit deactivation, etc.)."""

from sqlalchemy.orm import Session

from models.user import User
from services import template_mail_service as tm


def deactivate_workspace_users_for_usage_limit(db: Session, workspace_id: int) -> None:
    users = (
        db.query(User)
        .filter(User.workspace_id == workspace_id, User.is_active.is_(True))
        .all()
    )
    if not users:
        return
    for u in users:
        u.is_active = False
    db.commit()
    pv = tm.project_variables(db)
    for u in users:
        nm = (u.display_name or (u.email or "").split("@")[0] or "there").strip()
        tm.try_send_template(
            db,
            tm.TEMPLATE_USAGE_LIMIT_REACHED,
            u.email,
            {"name": nm, "email": u.email or "", **pv},
        )
