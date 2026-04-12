"""Workspace plan expiry and AI feature gating (login stays allowed)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from models.settings import WorkspaceSettings
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
    ws = db.get(Workspace, workspace_id)
    if not ws:
        return True
    exp = _aware_expiry(ws.plan_expires_at)
    if exp is None:
        return False
    return exp < _utc_now()


def workspace_ai_quota_exhausted(db: Session, workspace_id: int) -> bool:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if not row:
        return True
    lim = max(0, int(row.usage_limit or 0))
    if lim <= 0:
        return False
    used = count_workspace_ai_messages(db, workspace_id)
    return used >= lim


def ai_features_blocked(db: Session, workspace_id: int) -> bool:
    return workspace_plan_expired(db, workspace_id) or workspace_ai_quota_exhausted(
        db, workspace_id
    )


def ai_block_user_message(db: Session, workspace_id: int) -> str:
    if workspace_plan_expired(db, workspace_id):
        return (
            "Your workspace plan has expired. AI follow-ups and message generation are "
            "disabled until your administrator renews the plan."
        )
    return (
        "AI message quota exhausted for your workspace. You cannot schedule new AI "
        "follow-ups until your administrator increases the limit."
    )
