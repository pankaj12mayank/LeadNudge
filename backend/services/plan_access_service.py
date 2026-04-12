"""Workspace master cap, per-user AI caps, calendar plan, and feature gating."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.settings import WorkspaceSettings
from models.user import User
from models.workspace import Workspace
from services.settings_service import count_workspace_ai_messages


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _aware_expiry(exp: datetime | None) -> datetime | None:
    if exp is None:
        return None
    if exp.tzinfo is None:
        return exp.replace(tzinfo=timezone.utc)
    return exp.astimezone(timezone.utc)


def workspace_plan_expired(db: Session, workspace_id: int) -> bool:
    """Calendar plan end date is in the past."""
    row = db.execute(
        select(Workspace.plan_expires_at).where(Workspace.id == workspace_id)
    ).one_or_none()
    if row is None:
        return True
    exp = row[0]
    exp_aw = _aware_expiry(exp)
    if exp_aw is None:
        return False
    return exp_aw < _utc_now()


def workspace_usage_limit(db: Session, workspace_id: int) -> int:
    """Workspace AI cap from Admin → AI Configuration (default for new users)."""
    v = db.scalar(
        select(WorkspaceSettings.usage_limit).where(
            WorkspaceSettings.workspace_id == workspace_id
        )
    )
    if v is None:
        return 0
    return max(0, int(v))


def user_effective_ai_limit(db: Session, user_id: int) -> int:
    """
    Personal cap if set; otherwise workspace setting (snapshot at create matches global).
    Returns 0 when workspace cap is 0 (uncapped / unlimited for quota math).
    """
    u = db.get(User, user_id)
    if not u:
        return 0
    master = workspace_usage_limit(db, u.workspace_id)
    if u.ai_message_limit is not None:
        return max(0, int(u.ai_message_limit))
    return master


def user_ai_quota_exhausted(db: Session, user_id: int) -> bool:
    from services.settings_service import count_user_ai_messages

    lim = user_effective_ai_limit(db, user_id)
    if lim <= 0:
        return False
    return count_user_ai_messages(db, user_id) >= lim


def user_calendar_blocks_ai(db: Session, user_id: int) -> bool:
    """
    Calendar plan past end date blocks AI unless the user still has quota headroom
    (e.g. admin raised their limit) — same rule as portal / validate.
    """
    from services.settings_service import count_user_ai_messages

    u = db.get(User, user_id)
    if not u:
        return True
    wid = u.workspace_id
    if not workspace_plan_expired(db, wid):
        return False
    master = workspace_usage_limit(db, wid)
    lim = user_effective_ai_limit(db, user_id)
    used = count_user_ai_messages(db, user_id)
    if master > 0 and lim > 0 and used < lim:
        return False
    return True


def user_ai_features_blocked(db: Session, user_id: int) -> bool:
    if user_ai_quota_exhausted(db, user_id):
        return True
    return user_calendar_blocks_ai(db, user_id)


def workspace_ai_quota_exhausted(db: Session, workspace_id: int) -> bool:
    lim = workspace_usage_limit(db, workspace_id)
    if lim <= 0:
        return False
    used = count_workspace_ai_messages(db, workspace_id)
    return used >= lim


def portal_shows_plan_expired_notice(
    db: Session, workspace_id: int, user_id: int | None = None
) -> bool:
    """
    Show workspace plan-expired banner when the calendar date is past and the user is
    not in the quota-exhausted state (quota strip takes precedence). Hidden when the user
    still has message headroom under their cap (e.g. admin raised the limit).
    """
    if not workspace_plan_expired(db, workspace_id):
        return False
    if user_id is None:
        return True
    if user_ai_quota_exhausted(db, user_id):
        return False
    return user_calendar_blocks_ai(db, user_id)


def ai_features_blocked(db: Session, workspace_id: int) -> bool:
    """Recovery / workspace jobs: mirror calendar + headroom (raise cap → can run again)."""
    if workspace_ai_quota_exhausted(db, workspace_id):
        return True
    if not workspace_plan_expired(db, workspace_id):
        return False
    master = workspace_usage_limit(db, workspace_id)
    if master <= 0:
        return True
    used = count_workspace_ai_messages(db, workspace_id)
    return used >= master


def ai_block_user_message(db: Session, workspace_id: int) -> str:
    if workspace_ai_quota_exhausted(db, workspace_id):
        return "Your usage limit is reached. Contact admin."
    return "Your usage limit is reached. Contact admin."


def ai_block_followup_processing(
    db: Session, workspace_id: int, scheduled_by_user_id: int | None
) -> str | None:
    if scheduled_by_user_id is not None:
        if user_ai_quota_exhausted(db, scheduled_by_user_id):
            return "Your usage limit is reached. Contact admin."
        if user_calendar_blocks_ai(db, scheduled_by_user_id):
            return "Your plan has expired."
        return None
    if not ai_features_blocked(db, workspace_id):
        return None
    if workspace_ai_quota_exhausted(db, workspace_id):
        return "Your usage limit is reached. Contact admin."
    return "Your plan has expired."


def validate_user_ai_scheduling(
    db: Session, workspace_id: int, user_id: int
) -> None:
    from fastapi import HTTPException, status

    u = db.get(User, user_id)
    if u is None or u.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="User not found")
    if user_ai_quota_exhausted(db, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your usage limit is reached. Contact admin.",
        )
    if user_calendar_blocks_ai(db, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your plan has expired.",
        )
