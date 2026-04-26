import random
import re
import traceback
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from agents.ai_router import FALLBACK_FOLLOWUP_BODY
from agents.followup_agent import generate_followup
from models.followup import Followup
from models.lead import Lead
from models.message import Message
from models.user import User
from models.workspace import Workspace
from models.outbound_email import OutboundEmail
from models.settings import WorkspaceSettings
from schemas.followup import FollowupCreate, FollowupUpdate
from schemas.pagination import PaginationParams
from services import email_service
from utils.logger import get_logger

log = get_logger("followup")


def _normalize_scheduled_at_for_storage(dt: datetime) -> datetime:
    """Store follow-ups on whole UTC seconds so duplicate detection matches the DB unique index."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.replace(microsecond=0)


_DUPLICATE_PENDING_MSG = (
    "You already have a pending follow-up for this lead at that time. Pick a different time or "
    "cancel the existing one first."
)


def dedupe_and_normalize_pending_followups(db: Session) -> None:
    """
    One-time maintenance: normalize pending scheduled_at to UTC seconds and remove duplicates
    (same lead, same slot). Safe to run repeatedly.
    """
    pending = (
        db.query(Followup)
        .filter(Followup.status == "pending")
        .order_by(Followup.id.asc())
        .all()
    )
    if not pending:
        return
    buckets: dict[tuple[int, datetime], list[Followup]] = {}
    for fu in pending:
        n = _normalize_scheduled_at_for_storage(fu.scheduled_at)
        key = (fu.lead_id, n)
        buckets.setdefault(key, []).append(fu)
    changed = False
    for _key, group in buckets.items():
        group.sort(key=lambda f: f.id)
        keep = group[0]
        nk = _normalize_scheduled_at_for_storage(keep.scheduled_at)
        if keep.scheduled_at != nk:
            keep.scheduled_at = nk
            changed = True
        for extra in group[1:]:
            db.delete(extra)
            changed = True
    if changed:
        try:
            db.commit()
        except Exception:
            db.rollback()
            log.exception("dedupe_and_normalize_pending_followups commit failed")


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
    if lead and getattr(lead, "problem_seen", None) and str(lead.problem_seen).strip():
        ps = str(lead.problem_seen).strip()
        chunks.append(
            "Problem / opportunity noted (context only):\n" + ps[:2000]
        )
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


def followup_draft_contents_bulk(
    db: Session, followup_ids: list[int]
) -> dict[int, str | None]:
    """Latest draft message per follow-up in one query (avoids N+1 on list endpoints)."""
    if not followup_ids:
        return {}
    rows = (
        db.query(Message)
        .filter(Message.followup_id.in_(followup_ids))
        .order_by(Message.id.desc())
        .all()
    )
    out: dict[int, str | None] = {}
    for m in rows:
        fid = m.followup_id
        if fid is None or fid in out:
            continue
        out[fid] = m.content
    return {fid: out.get(fid) for fid in followup_ids}


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
    user_id: int | None = None,
) -> tuple[Followup, Message | None]:
    """Queue a follow-up; AI runs when scheduled_at is due (background worker)."""
    lead = db.get(Lead, data.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not is_admin:
        if workspace_id is None or lead.workspace_id != workspace_id:
            raise HTTPException(status_code=404, detail="Lead not found")
        if user_id is None or lead.owner_user_id is None:
            raise HTTPException(status_code=404, detail="Lead not found")
        if int(lead.owner_user_id) != int(user_id):
            raise HTTPException(status_code=404, detail="Lead not found")
        from services import usage_alerts_service
        from services.plan_access_service import validate_user_ai_scheduling

        if user_id is not None:
            u = db.get(User, user_id)
            if u is None or not u.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account has been deactivated.",
                )
            usage_alerts_service.sync_user_usage_threshold_emails(db, user_id)
            validate_user_ai_scheduling(db, workspace_id, user_id)

    at_norm = _normalize_scheduled_at_for_storage(data.scheduled_at)
    clash = (
        db.query(Followup.id)
        .filter(
            Followup.lead_id == data.lead_id,
            Followup.status == "pending",
            Followup.scheduled_at == at_norm,
        )
        .first()
    )
    if clash is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_DUPLICATE_PENDING_MSG,
        )

    if is_admin:
        ft = getattr(data, "followup_type", "normal") or "normal"
        if ft not in ("normal", "recovery"):
            ft = "normal"
    else:
        ft = "normal"
    fu = Followup(
        lead_id=data.lead_id,
        scheduled_at=at_norm,
        status="pending",
        followup_type=ft,
        scheduled_by_user_id=user_id if not is_admin else None,
    )
    db.add(fu)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_DUPLICATE_PENDING_MSG,
        ) from None
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
        .filter(
            Followup.status == "pending",
            Followup.scheduled_at <= now,
            Followup.followup_type == "normal",
        )
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
    from services.plan_access_service import ai_block_followup_processing

    sid = getattr(fu, "scheduled_by_user_id", None)
    if sid is not None:
        usage_alerts_service.sync_user_usage_threshold_emails(db, sid)
    else:
        usage_alerts_service.sync_usage_threshold_emails(db, ws_id)
    block_reason = ai_block_followup_processing(db, ws_id, sid)
    if block_reason:
        fu.status = "ai_failed"
        fu.failure_reason = block_reason
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
            send_timing_label=None,
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
        created_by_user_id=sid,
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
            _owner = (
                int(lead.owner_user_id)
                if lead.owner_user_id is not None
                else (int(sid) if sid is not None else None)
            )
            db.add(
                OutboundEmail(
                    workspace_id=ws_id,
                    owner_user_id=_owner,
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

    if sid is not None:
        usage_alerts_service.sync_user_usage_threshold_emails(db, sid)
    else:
        usage_alerts_service.sync_usage_threshold_emails(db, ws_id)


def patch_followup(
    db: Session,
    followup_id: int,
    data: FollowupUpdate,
    *,
    workspace_id: int | None,
    is_admin: bool,
    user_id: int | None = None,
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
        if user_id is None or lead.owner_user_id is None:
            raise HTTPException(status_code=404, detail="Follow-up not found")
        if int(lead.owner_user_id) != int(user_id):
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
        at_norm = _normalize_scheduled_at_for_storage(data.scheduled_at)
        clash = (
            db.query(Followup.id)
            .filter(
                Followup.lead_id == fu.lead_id,
                Followup.status == "pending",
                Followup.id != fu.id,
                Followup.scheduled_at == at_norm,
            )
            .first()
        )
        if clash is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have a pending follow-up for this lead at that time. Pick a different time or cancel the other one first.",
            )
        fu.scheduled_at = at_norm
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_DUPLICATE_PENDING_MSG,
            ) from None
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
    user_id: int | None = None,
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
        if user_id is None or lead.owner_user_id is None:
            raise HTTPException(status_code=404, detail="Follow-up not found")
        if int(lead.owner_user_id) != int(user_id):
            raise HTTPException(status_code=404, detail="Follow-up not found")
    if fu.status not in ("pending", "ai_failed", "draft_ready", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending, cancelled, failed, or draft (unsent) follow-ups can be deleted",
        )
    db.delete(fu)
    db.commit()


def cancel_pending_recovery_followups(db: Session) -> int:
    """Mark pending recovery-type rows cancelled (no longer sent by the scheduler)."""
    n = (
        db.query(Followup)
        .filter(
            Followup.status == "pending",
            Followup.followup_type == "recovery",
        )
        .update(
            {
                Followup.status: "cancelled",
                Followup.failure_reason: (
                    "Automatic recovery follow-ups are disabled. "
                    "Schedule a follow-up from the portal when you want mail sent."
                ),
            },
            synchronize_session=False,
        )
    )
    db.commit()
    return int(n or 0)


def list_followups(
    db: Session,
    *,
    workspace_id: int | None,
    is_admin: bool,
    page: int,
    limit: int,
    owner_user_id: int | None = None,
) -> tuple[list[tuple[Followup, str | None, str | None]], int]:
    q = db.query(Followup).join(Lead)
    if is_admin:
        if workspace_id is not None:
            q = q.filter(Lead.workspace_id == workspace_id)
    else:
        if workspace_id is None or owner_user_id is None:
            return [], 0
        q = q.filter(
            Lead.workspace_id == workspace_id,
            Lead.owner_user_id == owner_user_id,
        )
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
    ids = [fu.id for fu in fus]
    draft_by_id = followup_draft_contents_bulk(db, ids)
    rows = [
        (
            fu,
            draft_by_id.get(fu.id),
            fu.lead.name if fu.lead is not None else None,
        )
        for fu in fus
    ]
    return rows, total
