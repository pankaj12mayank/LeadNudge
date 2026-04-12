"""Persist usage / plan / limit audit rows for admin and user dashboards."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.user import User
from models.user_usage_history import UserUsageHistory

ACTION_UPGRADE = "upgrade"
ACTION_DOWNGRADE = "downgrade"
ACTION_LIMIT_UPDATE = "limit_update"
ACTION_EXPIRE = "expire"
ACTION_PLAN_RENEW = "plan_renew"
ACTION_WORKSPACE_PLAN_CHANGE = "workspace_plan_change"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def append_entry(
    db: Session,
    *,
    user_id: int | None,
    workspace_id: int | None,
    action_type: str,
    old_limit: int | None = None,
    new_limit: int | None = None,
    plan_type: str | None = None,
    expiry_date: datetime | None = None,
    changed_by: int | None = None,
    summary: str | None = None,
) -> UserUsageHistory:
    row = UserUsageHistory(
        user_id=user_id,
        workspace_id=workspace_id,
        action_type=action_type,
        old_limit=old_limit,
        new_limit=new_limit,
        plan_type=plan_type,
        expiry_date=expiry_date,
        changed_by=changed_by,
        summary=summary,
        created_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def append_for_workspace_users(
    db: Session,
    workspace_id: int,
    *,
    action_type: str,
    old_limit: int | None = None,
    new_limit: int | None = None,
    plan_type: str | None = None,
    expiry_date: datetime | None = None,
    changed_by: int | None = None,
    summary: str | None = None,
) -> None:
    users = (
        db.query(User.id).filter(User.workspace_id == workspace_id).all()
    )
    ts = _now()
    for (uid,) in users:
        db.add(
            UserUsageHistory(
                user_id=int(uid),
                workspace_id=workspace_id,
                action_type=action_type,
                old_limit=old_limit,
                new_limit=new_limit,
                plan_type=plan_type,
                expiry_date=expiry_date,
                changed_by=changed_by,
                summary=summary,
                created_at=ts,
            )
        )
    if users:
        db.commit()


def list_for_user(db: Session, user_id: int, *, limit: int = 50) -> list[UserUsageHistory]:
    return (
        db.query(UserUsageHistory)
        .filter(UserUsageHistory.user_id == user_id)
        .order_by(UserUsageHistory.id.desc())
        .limit(min(limit, 200))
        .all()
    )


def list_for_user_paginated(
    db: Session,
    user_id: int,
    *,
    q: str | None,
    page: int,
    page_limit: int,
) -> tuple[list[UserUsageHistory], int]:
    qry = db.query(UserUsageHistory).filter(UserUsageHistory.user_id == user_id)
    if q and q.strip():
        term = f"%{q.strip()}%"
        qry = qry.filter(
            or_(
                UserUsageHistory.summary.ilike(term),
                UserUsageHistory.action_type.ilike(term),
            )
        )
    total = qry.count()
    offset = max(0, (page - 1) * page_limit)
    rows = (
        qry.order_by(UserUsageHistory.id.desc())
        .offset(offset)
        .limit(page_limit)
        .all()
    )
    return rows, total


def delete_ids_for_user(db: Session, user_id: int, ids: list[int]) -> int:
    if not ids:
        return 0
    n = (
        db.query(UserUsageHistory)
        .filter(
            UserUsageHistory.id.in_(ids),
            UserUsageHistory.user_id == user_id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(n)


def list_admin(
    db: Session,
    *,
    q: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    page: int,
    page_limit: int,
) -> tuple[list[UserUsageHistory], int]:
    qry = db.query(UserUsageHistory)
    if q and q.strip():
        term = f"%{q.strip()}%"
        uid_subq = db.query(User.id).filter(User.email.ilike(term)).subquery()
        qry = qry.filter(
            or_(
                UserUsageHistory.user_id.in_(uid_subq),
                UserUsageHistory.summary.ilike(term),
            )
        )
    if date_from is not None:
        qry = qry.filter(UserUsageHistory.created_at >= date_from)
    if date_to is not None:
        qry = qry.filter(UserUsageHistory.created_at <= date_to)

    total = qry.count()
    offset = max(0, (page - 1) * page_limit)
    rows = (
        qry.order_by(UserUsageHistory.id.desc())
        .offset(offset)
        .limit(page_limit)
        .all()
    )
    return rows, total


def delete_ids(db: Session, ids: list[int]) -> int:
    if not ids:
        return 0
    q = db.query(UserUsageHistory).filter(UserUsageHistory.id.in_(ids))
    n = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return n
