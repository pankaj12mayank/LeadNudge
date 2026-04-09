from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from agents.followup_agent import generate_followup
from models.followup import Followup
from models.lead import Lead
from models.message import Message
from models.settings import WorkspaceSettings
from schemas.followup import FollowupCreate
from schemas.pagination import PaginationParams
from services import email_service
from utils.logger import get_logger

log = get_logger("followup")


def _workspace_message_count(db: Session, workspace_id: int) -> int:
    stmt = (
        select(func.count())
        .select_from(Message)
        .join(Lead, Message.lead_id == Lead.id)
        .where(Lead.workspace_id == workspace_id)
    )
    return int(db.execute(stmt).scalar_one())


def _get_settings(db: Session, workspace_id: int) -> WorkspaceSettings:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Workspace settings not found")
    return row


def create_followup(
    db: Session,
    data: FollowupCreate,
    *,
    workspace_id: int | None,
    is_admin: bool,
) -> tuple[Followup, Message | None]:
    lead = db.get(Lead, data.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not is_admin:
        if workspace_id is None or lead.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Lead not found")

    ws_id = lead.workspace_id
    settings = _get_settings(db, ws_id)
    used = _workspace_message_count(db, ws_id)
    if used >= settings.usage_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Workspace usage limit reached",
        )

    fu = Followup(
        lead_id=data.lead_id,
        scheduled_at=data.scheduled_at,
        status="pending",
    )
    db.add(fu)
    db.commit()
    db.refresh(fu)

    msg: Message | None = None
    try:
        content = generate_followup(
            lead_name=lead.name,
            lead_email=lead.email,
            lead_status=lead.status,
            lead_tag=lead.tag,
            ai_mode=settings.ai_mode,
            api_key=settings.api_key,
        )
        if content:
            msg = Message(lead_id=lead.id, content=content)
            db.add(msg)
            fu.status = "draft_ready"
            db.commit()
            db.refresh(msg)
            db.refresh(fu)
            try:
                subj, body_plain = email_service.format_followup_email(lead, content)
                if settings.smtp_host and settings.smtp_email:
                    email_service.send_followup_email(settings, lead, subj, body_plain)
            except Exception as e:
                log.warning("Follow-up email not sent: %s", e)
    except Exception:
        fu.status = "ai_failed"
        db.commit()
        db.refresh(fu)

    return fu, msg


def _latest_message_content(db: Session, lead_id: int) -> str | None:
    msg = (
        db.query(Message)
        .filter(Message.lead_id == lead_id)
        .order_by(Message.id.desc())
        .first()
    )
    return msg.content if msg else None


def list_followups(
    db: Session,
    *,
    workspace_id: int | None,
    is_admin: bool,
    page: int,
    limit: int,
) -> tuple[list[tuple[Followup, str | None]], int]:
    q = db.query(Followup).join(Lead)
    if is_admin:
        if workspace_id is not None:
            q = q.filter(Lead.workspace_id == workspace_id)
    else:
        if workspace_id is None:
            return [], 0
        q = q.filter(Lead.workspace_id == workspace_id)
    total = q.count()
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    offset = (page - 1) * limit
    fus = q.order_by(Followup.id.desc()).offset(offset).limit(limit).all()
    rows = [(fu, _latest_message_content(db, fu.lead_id)) for fu in fus]
    return rows, total
