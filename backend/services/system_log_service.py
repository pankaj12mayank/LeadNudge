from datetime import datetime, timedelta, timezone
from math import ceil

from sqlalchemy.orm import Session

from models.system_log import SystemLog
from schemas.system_admin import ActivityEntryOut, PaginatedActivity, SystemLogRowOut


def log_event(db: Session, *, kind: str, message: str) -> None:
    db.add(SystemLog(type=kind[:32], message=message[:20000]))
    db.commit()


def list_activity_paginated(
    db: Session,
    *,
    page: int,
    limit: int,
    period: str | None,
) -> PaginatedActivity:
    """period: 'week' | 'month' | None (all recent)."""
    q = db.query(SystemLog).filter(SystemLog.type == "ACTIVITY")
    now = datetime.now(timezone.utc)
    if period == "week":
        start = now - timedelta(days=7)
        q = q.filter(SystemLog.created_at >= start)
    elif period == "month":
        start = now - timedelta(days=30)
        q = q.filter(SystemLog.created_at >= start)
    total = q.count()
    offset = (page - 1) * limit
    rows = (
        q.order_by(SystemLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items: list[ActivityEntryOut] = []
    for r in rows:
        ts = r.created_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        items.append(
            ActivityEntryOut(
                occurred_at=ts.isoformat(),
                kind="activity",
                summary=r.message[:2000],
            )
        )
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedActivity(
        items=items, total=total, page=page, limit=limit, pages=pages
    )


def clear_activity_period(db: Session, *, range_key: str) -> int:
    """Delete ACTIVITY logs in last 7d (week) or 30d (month). Returns deleted count."""
    now = datetime.now(timezone.utc)
    if range_key == "week":
        start = now - timedelta(days=7)
    elif range_key == "month":
        start = now - timedelta(days=30)
    else:
        return 0
    n = (
        db.query(SystemLog)
        .filter(SystemLog.type == "ACTIVITY", SystemLog.created_at >= start)
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(n)


def list_system_logs(
    db: Session,
    *,
    page: int,
    limit: int,
    type_filter: str | None,
) -> tuple[list[SystemLog], int]:
    q = db.query(SystemLog)
    if type_filter and type_filter.strip() and type_filter != "all":
        q = q.filter(SystemLog.type == type_filter.strip().upper()[:32])
    total = q.count()
    offset = (page - 1) * limit
    rows = (
        q.order_by(SystemLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return rows, total


def log_row_to_out(r: SystemLog) -> SystemLogRowOut:
    ts = r.created_at
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return SystemLogRowOut(
        id=r.id,
        type=r.type,
        message=r.message[:8000],
        created_at=ts.isoformat(),
    )
