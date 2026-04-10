from datetime import datetime, timezone
from math import ceil

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import settings
from models.lead import Lead
from models.message import Message
from models.settings import WorkspaceSettings
from models.user import User
from schemas.pagination import PaginationParams
from schemas.system_admin import (
    ActivityEntryOut,
    PaginatedUserUsage,
    SystemStatusOut,
    UserUsageRowOut,
)


def get_system_status(db: Session) -> SystemStatusOut:
    ollama_ok = False
    msg = "Not checked"
    try:
        r = httpx.get(
            f"{settings.ollama_base_url.rstrip('/')}/api/tags",
            timeout=2.5,
        )
        ollama_ok = r.status_code == 200
        msg = "Ollama reachable" if ollama_ok else f"Ollama HTTP {r.status_code}"
    except Exception as e:
        msg = str(e)[:120] or "Cannot reach Ollama"

    api_mode_any = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.ai_mode == "api")
        .first()
        is not None
    )
    has_env_key = bool(settings.openai_api_key)
    if settings.mode != "local" and (api_mode_any or has_env_key):
        ai_active = True
        msg = "API mode available (OpenAI)"
    else:
        ai_active = ollama_ok

    last_at = db.execute(select(func.max(Message.created_at))).scalar_one_or_none()
    last_iso = None
    if last_at is not None:
        if last_at.tzinfo is None:
            last_at = last_at.replace(tzinfo=timezone.utc)
        last_iso = last_at.isoformat()

    return SystemStatusOut(
        backend="running",
        ai_active=ai_active,
        ai_message=msg,
        last_activity_at=last_iso,
    )


def list_recent_activity(db: Session, *, limit: int = 20) -> list[ActivityEntryOut]:
    limit = max(1, min(50, limit))
    rows = (
        db.query(Message, Lead.name)
        .join(Lead, Message.lead_id == Lead.id)
        .order_by(Message.id.desc())
        .limit(limit)
        .all()
    )
    out: list[ActivityEntryOut] = []
    for msg, lead_name in rows:
        ts = msg.created_at
        if ts is None:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        out.append(
            ActivityEntryOut(
                occurred_at=ts.isoformat(),
                kind="ai_draft",
                summary=f"Draft for lead «{lead_name}»",
            )
        )
    return out


def paginated_user_usage(
    db: Session,
    *,
    workspace_id: int | None,
    page: int,
    limit: int,
) -> PaginatedUserUsage:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)

    msg_by_ws: dict[int, int] = dict(
        db.query(Lead.workspace_id, func.count(Message.id))
        .join(Message, Message.lead_id == Lead.id)
        .group_by(Lead.workspace_id)
        .all()
    )

    q = db.query(User)
    if workspace_id is not None:
        q = q.filter(User.workspace_id == workspace_id)
    total = q.count()
    offset = (page - 1) * limit
    rows = q.order_by(User.id).offset(offset).limit(limit).all()
    items = [
        UserUsageRowOut(
            user_id=u.id,
            email=u.email,
            workspace_id=u.workspace_id,
            is_active=u.is_active,
            workspace_ai_messages=int(msg_by_ws.get(u.workspace_id, 0)),
        )
        for u in rows
    ]
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedUserUsage(
        items=items, total=total, page=page, limit=limit, pages=pages
    )
