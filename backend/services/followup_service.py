import random
import traceback
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from agents.followup_agent import generate_followup
from models.followup import Followup
from models.lead import Lead
from models.message import Message
from models.outbound_email import OutboundEmail
from models.settings import WorkspaceSettings
from schemas.followup import FollowupCreate, FollowupUpdate
from schemas.pagination import PaginationParams
from services import email_service
from utils.logger import get_logger

log = get_logger("followup")


def _standalone_log(kind: str, message: str) -> None:
    try:
        from db.session import SessionLocal
        from services.system_log_service import log_event

        s = SessionLocal()
        try:
            log_event(s, kind=kind, message=message[:15000])
        finally:
            s.close()
    except Exception:
        pass


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


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


def _recent_ai_followup_bodies(db: Session, lead_id: int, limit: int = 3) -> list[str]:
    rows = (
        db.query(Message)
        .filter(Message.lead_id == lead_id, Message.followup_id.isnot(None))
        .order_by(Message.id.desc())
        .limit(limit)
        .all()
    )
    bodies = [(r.content or "").strip() for r in rows if (r.content or "").strip()]
    bodies.reverse()
    return bodies


def _conversation_context_for_lead(
    db: Session, lead_id: int, exclude_followup_id: int
) -> str | None:
    q = db.query(Message).filter(Message.lead_id == lead_id)
    q = q.filter(
        or_(
            Message.followup_id.is_(None),
            Message.followup_id != exclude_followup_id,
        )
    )
    msg = q.order_by(Message.id.desc()).first()
    if msg and (msg.content or "").strip():
        return msg.content.strip()
    lead = db.get(Lead, lead_id)
    if lead and (lead.last_message or "").strip():
        return lead.last_message.strip()
    return None


def followup_draft_content(db: Session, followup_id: int) -> str | None:
    msg = (
        db.query(Message)
        .filter(Message.followup_id == followup_id)
        .order_by(Message.id.desc())
        .first()
    )
    return msg.content if msg else None


def create_followup(
    db: Session,
    data: FollowupCreate,
    *,
    workspace_id: int | None,
    is_admin: bool,
) -> tuple[Followup, Message | None]:
    """Queue a follow-up; AI runs when scheduled_at is due (background worker)."""
    lead = db.get(Lead, data.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not is_admin:
        if workspace_id is None or lead.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Lead not found")

    fu = Followup(
        lead_id=data.lead_id,
        scheduled_at=data.scheduled_at,
        status="pending",
    )
    db.add(fu)
    db.commit()
    db.refresh(fu)
    return fu, None


def process_due_followups_batch(db: Session, *, batch_limit: int = 25) -> int:
    """
    Run AI + optional SMTP for pending follow-ups whose scheduled_at <= now (UTC).
    Returns how many rows were processed (success or failure terminal state).
    """
    now = _utc_now()
    pending = (
        db.query(Followup)
        .join(Lead)
        .filter(Followup.status == "pending", Followup.scheduled_at <= now)
        .order_by(Followup.scheduled_at.asc(), Followup.id.asc())
        .limit(batch_limit)
        .all()
    )
    processed = 0
    for fu in pending:
        db.refresh(fu)
        if fu.status != "pending":
            continue
        try:
            _process_one_due_followup(db, fu)
            processed += 1
        except Exception:
            log.exception("Follow-up %s processing failed", fu.id)
            try:
                fu2 = db.get(Followup, fu.id)
                if fu2 and fu2.status == "pending":
                    fu2.status = "ai_failed"
                    fu2.failure_reason = "Message generation failed. Please try again."
                    db.commit()
                    _standalone_log(
                        "ERROR",
                        f"Follow-up {fu.id} processing exception:\n{traceback.format_exc()}",
                    )
            except Exception:
                db.rollback()
    return processed


def _process_one_due_followup(db: Session, fu: Followup) -> None:
    lead = db.get(Lead, fu.lead_id)
    if not lead:
        fu.status = "ai_failed"
        fu.failure_reason = "Lead was removed."
        db.commit()
        return

    ws_id = lead.workspace_id
    settings = _get_settings(db, ws_id)
    used = _workspace_message_count(db, ws_id)
    if used >= settings.usage_limit:
        from services.workspace_notifications import (
            deactivate_workspace_users_for_usage_limit,
        )

        deactivate_workspace_users_for_usage_limit(db, ws_id)
        fu.status = "ai_failed"
        fu.failure_reason = (
            "Workspace AI message limit reached. Contact support to upgrade your plan."
        )
        db.commit()
        return

    ctx = _conversation_context_for_lead(db, lead.id, fu.id)
    prev_bodies = _recent_ai_followup_bodies(db, lead.id, 3)
    tone = random.choice(["friendly", "professional", "direct"])
    try:
        om = (settings.ollama_model or "").strip() or None
        content = generate_followup(
            lead_name=lead.name,
            lead_email=lead.email,
            lead_status=lead.status,
            lead_tag=lead.tag,
            ai_mode=settings.ai_mode,
            api_key=settings.api_key,
            ollama_model=om,
            last_context=ctx,
            previous_followup_bodies=prev_bodies,
            tone=tone,
        )
    except Exception as e:
        fu.status = "ai_failed"
        fu.failure_reason = "Message generation failed. Please try again."
        log.exception("Follow-up AI error: %s", e)
        db.commit()
        _standalone_log(
            "AI",
            f"followup_id={fu.id} lead_id={lead.id} workspace={ws_id}\n{traceback.format_exc()}",
        )
        return

    if not (content or "").strip():
        fu.status = "ai_failed"
        fu.failure_reason = "Message generation failed. Please try again."
        db.commit()
        _standalone_log(
            "AI",
            f"followup_id={fu.id} empty content from model workspace={ws_id}",
        )
        return

    msg = Message(
        lead_id=lead.id,
        content=content.strip(),
        followup_id=fu.id,
    )
    db.add(msg)
    db.flush()

    smtp_ready = email_service.workspace_smtp_ready(settings)
    if smtp_ready:
        try:
            subj, body_plain = email_service.format_followup_email(lead, content)
            email_service.send_followup_email(settings, lead, subj, body_plain)
            db.add(
                OutboundEmail(
                    workspace_id=ws_id,
                    followup_id=fu.id,
                    lead_id=lead.id,
                    to_email=(lead.email or "").strip(),
                    lead_name=lead.name,
                    subject=subj,
                    body_preview=body_plain[:2000],
                    sent_at=_utc_now(),
                )
            )
            fu.status = "sent"
            fu.sent_at = _utc_now()
            fu.failure_reason = None
        except Exception as e:
            log.warning("Follow-up email not sent: %s", e)
            fu.status = "draft_ready"
            fu.sent_at = None
            fu.failure_reason = None
    else:
        fu.status = "draft_ready"
        fu.sent_at = None
        fu.failure_reason = None

    db.commit()
    _standalone_log(
        "ACTIVITY",
        f"AI draft for lead «{lead.name}» (follow-up #{fu.id}, workspace {ws_id})",
    )


def patch_followup(
    db: Session,
    followup_id: int,
    data: FollowupUpdate,
    *,
    workspace_id: int | None,
    is_admin: bool,
) -> Followup:
    fu = db.get(Followup, followup_id)
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    lead = db.get(Lead, fu.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    if not is_admin:
        if workspace_id is None or lead.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Follow-up not found")

    if data.cancel:
        if fu.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only scheduled follow-ups can be cancelled",
            )
        fu.status = "cancelled"
        db.commit()
        db.refresh(fu)
        return fu

    if data.scheduled_at is not None:
        if fu.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only scheduled follow-ups can be rescheduled",
            )
        fu.scheduled_at = data.scheduled_at
        db.commit()
        db.refresh(fu)
        return fu

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Provide cancel=true or a new scheduled_at",
    )


def delete_followup_if_allowed(
    db: Session,
    followup_id: int,
    *,
    workspace_id: int | None,
    is_admin: bool,
) -> None:
    fu = db.get(Followup, followup_id)
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    lead = db.get(Lead, fu.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    if not is_admin:
        if workspace_id is None or lead.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Follow-up not found")
    if fu.status not in ("pending", "ai_failed", "draft_ready", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending, cancelled, failed, or draft (unsent) follow-ups can be deleted",
        )
    db.delete(fu)
    db.commit()


def list_followups(
    db: Session,
    *,
    workspace_id: int | None,
    is_admin: bool,
    page: int,
    limit: int,
) -> tuple[list[tuple[Followup, str | None, str | None]], int]:
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
    fus = (
        q.options(joinedload(Followup.lead))
        .order_by(Followup.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    rows = [
        (
            fu,
            followup_draft_content(db, fu.id),
            fu.lead.name if fu.lead is not None else None,
        )
        for fu in fus
    ]
    return rows, total
