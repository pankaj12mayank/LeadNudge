import random
import re
import traceback
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from agents.ai_router import FALLBACK_FOLLOWUP_BODY
from agents.followup_agent import generate_followup
from models.followup import Followup
from models.lead import Lead
from models.message import Message
from models.workspace import Workspace
from models.outbound_email import OutboundEmail
from models.settings import WorkspaceSettings
from schemas.followup import FollowupCreate, FollowupOut, FollowupUpdate
from schemas.pagination import PaginationParams
from services import email_service
from utils.logger import get_logger

log = get_logger("followup")


def _emphasize_lead_last_message_in_body(body: str, last_message: str | None) -> str:
    """
    Ensure the lead's saved last_message appears as **bold** in the draft, never wrapped in
    parentheses or square brackets. Fixes model output like: ... shared (Interested).
    """
    lm = (last_message or "").strip()
    if not lm or len(lm) < 2:
        return body
    if len(lm) > 600:
        lm = lm[:600]

    esc = re.escape(lm)

    def _paren_to_bold(m: re.Match[str]) -> str:
        inner = m.group(1).strip()
        return f"**{inner}**"

    out = re.sub(rf"\(\s*({esc})\s*\)", _paren_to_bold, body, flags=re.IGNORECASE)
    out = re.sub(rf"\[\s*({esc})\s*\]", _paren_to_bold, out, flags=re.IGNORECASE)

    pieces = re.split(r"(\*\*[^*]+\*\*)", out)
    rebuilt: list[str] = []
    for piece in pieces:
        if piece.startswith("**") and piece.endswith("**") and len(piece) >= 4:
            rebuilt.append(piece)
            continue
        n = lm.strip()
        if len(n) <= 120 and " " not in n and "\n" not in n:
            m = re.search(rf"\b({esc})\b", piece, flags=re.IGNORECASE)
        else:
            m = re.search(esc, piece, flags=re.IGNORECASE)
        if not m:
            rebuilt.append(piece)
            continue
        a, b = m.span()
        matched = piece[a:b]
        rebuilt.append(piece[:a] + f"**{matched}**" + piece[b:])
    out = "".join(rebuilt)

    out = re.sub(r"\*{4,}", "**", out)
    return out


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
    lead = db.get(Lead, lead_id)
    chunks: list[str] = []
    if lead and (lead.last_message or "").strip():
        note = lead.last_message.strip()
        chunks.append(
            "Lead profile / last note (prioritize this to personalize the message):\n" + note[:4000]
        )
    q = db.query(Message).filter(Message.lead_id == lead_id)
    q = q.filter(
        or_(
            Message.followup_id.is_(None),
            Message.followup_id != exclude_followup_id,
        )
    )
    msg = q.order_by(Message.id.desc()).first()
    if msg and (msg.content or "").strip():
        thread_text = msg.content.strip()
        if not (
            lead
            and (lead.last_message or "").strip()
            and thread_text == (lead.last_message or "").strip()
        ):
            chunks.append(
                "Latest saved thread message (additional context):\n" + thread_text[:3500]
            )
    if not chunks:
        return None
    return "\n\n---\n\n".join(chunks)


def followup_draft_content(db: Session, followup_id: int) -> str | None:
    msg = (
        db.query(Message)
        .filter(Message.followup_id == followup_id)
        .order_by(Message.id.desc())
        .first()
    )
    return msg.content if msg else None


def _prior_completed_followups(db: Session, lead_id: int, before_id: int) -> int:
    return int(
        db.query(func.count(Followup.id))
        .filter(
            Followup.lead_id == lead_id,
            Followup.id < before_id,
            Followup.status.in_(("sent", "draft_ready")),
        )
        .scalar()
        or 0
    )


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
        from services import usage_alerts_service
        from services.plan_access_service import ai_features_blocked, ai_block_user_message

        usage_alerts_service.sync_usage_threshold_emails(db, workspace_id)
        if ai_features_blocked(db, workspace_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=ai_block_user_message(db, workspace_id),
            )

    ft = getattr(data, "followup_type", "normal") or "normal"
    if ft not in ("normal", "recovery"):
        ft = "normal"
    fu = Followup(
        lead_id=data.lead_id,
        scheduled_at=data.scheduled_at,
        status="pending",
        followup_type=ft,
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
    ws_row = db.get(Workspace, ws_id)
    workspace_plan = (ws_row.plan_type if ws_row else "free") or "free"
    settings = _get_settings(db, ws_id)
    from services import usage_alerts_service
    from services.plan_access_service import ai_features_blocked, ai_block_user_message

    usage_alerts_service.sync_usage_threshold_emails(db, ws_id)
    if ai_features_blocked(db, ws_id):
        fu.status = "ai_failed"
        fu.failure_reason = ai_block_user_message(db, ws_id)
        db.commit()
        return

    ctx = _conversation_context_for_lead(db, lead.id, fu.id)
    prev_bodies = _recent_ai_followup_bodies(db, lead.id, 3)
    tone = random.choice(["friendly", "professional", "direct"])
    fu_type = (getattr(fu, "followup_type", None) or "normal").lower()
    if fu_type == "recovery":
        message_kind = random.choice(
            ["recovery_friendly", "recovery_reminder", "recovery_offer"]
        )
    else:
        prior = _prior_completed_followups(db, lead.id, fu.id)
        if prior == 0:
            message_kind = "first_contact"
        elif prior < 3:
            message_kind = "followup_reminder"
        else:
            message_kind = "closing_attempt"
    timing_key = FollowupOut.send_window_from_scheduled(fu.scheduled_at)
    timing_label = {"morning": "Morning", "afternoon": "Afternoon", "evening": "Evening"}.get(
        timing_key, timing_key
    )
    try:
        om = (settings.ollama_model or "").strip() or None
        content = generate_followup(
            lead_name=lead.name,
            lead_email=lead.email,
            lead_status=lead.status,
            lead_tag=lead.tag,
            lead_company=(lead.company or "").strip() or None,
            ai_mode=settings.ai_mode,
            api_key=settings.api_key,
            ollama_model=om,
            last_context=ctx,
            previous_followup_bodies=prev_bodies,
            tone=tone,
            workspace_plan=workspace_plan,
            message_kind=message_kind,
            send_timing_label=timing_label,
            lead_id=lead.id,
            followup_id=fu.id,
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

    stripped = (content or "").strip()
    if not stripped:
        fu.status = "ai_failed"
        fu.failure_reason = "Message generation failed. Please try again."
        db.commit()
        _standalone_log(
            "AI",
            f"followup_id={fu.id} empty content from model workspace={ws_id}",
        )
        return

    if stripped == (FALLBACK_FOLLOWUP_BODY or "").strip():
        nm = (lead.name or "").strip() or "there"
        co = (lead.company or "").strip()
        lm = (lead.last_message or "").strip()
        if lm:
            raw = lm[:200] + ("…" if len(lm) > 200 else "")
            snippet = " ".join(raw.replace("*", " ").split())
            content = (
                f"I am following up regarding what you shared — you had mentioned **{snippet}**. "
                f"{nm}, reply when convenient and we can pick this up."
            )
        else:
            content = (
                f"Checking in with you, {nm}"
                + (f" at {co}" if co else "")
                + " — let me know a good time to reconnect or if priorities have shifted."
            )

    content = _emphasize_lead_last_message_in_body(
        (content or "").strip(),
        lead.last_message,
    )

    msg = Message(
        lead_id=lead.id,
        content=content,
        followup_id=fu.id,
    )
    db.add(msg)
    db.flush()

    smtp_ready = email_service.workspace_smtp_ready(settings)
    if smtp_ready:
        try:
            subj, body_plain = email_service.format_followup_email(
                lead, content, settings
            )
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
    from services import usage_alerts_service

    usage_alerts_service.sync_usage_threshold_emails(db, ws_id)


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
