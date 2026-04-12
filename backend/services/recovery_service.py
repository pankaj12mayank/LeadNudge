"""Missed-lead recovery: auto-queue recovery follow-ups for quiet leads (daily job)."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.followup import Followup
from models.lead import Lead
from models.message import Message
from services.plan_access_service import ai_features_blocked
from utils.logger import get_logger

log = get_logger("recovery")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def last_activity_at(db: Session, lead: Lead) -> datetime:
    times: list[datetime] = []
    if lead.created_at:
        times.append(_aware(lead.created_at))
    mmax = (
        db.query(func.max(Message.created_at))
        .filter(Message.lead_id == lead.id)
        .scalar()
    )
    if mmax:
        times.append(_aware(mmax))
    fmax = (
        db.query(func.max(Followup.sent_at))
        .filter(Followup.lead_id == lead.id, Followup.sent_at.isnot(None))
        .scalar()
    )
    if fmax:
        times.append(_aware(fmax))
    if times:
        return max(times)
    if lead.created_at:
        return _aware(lead.created_at)
    return _utc_now()


def inactive_whole_days(db: Session, lead: Lead, now: datetime) -> int:
    la = last_activity_at(db, lead)
    delta = now - la
    return int(max(0, delta.total_seconds()) // 86400)


def _has_pending_followup(db: Session, lead_id: int) -> bool:
    return (
        db.query(Followup.id)
        .filter(Followup.lead_id == lead_id, Followup.status == "pending")
        .first()
        is not None
    )


def _last_recovery_sent_at(db: Session, lead_id: int) -> datetime | None:
    row = (
        db.query(Followup)
        .filter(
            Followup.lead_id == lead_id,
            Followup.followup_type == "recovery",
            Followup.sent_at.isnot(None),
        )
        .order_by(Followup.id.desc())
        .first()
    )
    return row.sent_at if row else None


def run_daily_recovery(db: Session, *, max_per_run: int = 80) -> int:
    """
    Queue recovery follow-ups for leads with no activity between 3 and 7 full days ago,
    excluding closed / not_interested, with at most one recovery send per 7 days per lead.
    """
    now = _utc_now()
    created = 0
    wids = [r[0] for r in db.query(Lead.workspace_id).distinct().all()]
    for wid in wids:
        ai_blocked = ai_features_blocked(db, wid)

        leads = db.query(Lead).filter(Lead.workspace_id == wid).all()
        for lead in leads:
            if created >= max_per_run:
                db.commit()
                log.info("Recovery batch capped at %s", max_per_run)
                return created
            if ai_blocked:
                continue
            if lead.status in ("closed", "not_interested"):
                continue
            if _has_pending_followup(db, lead.id):
                continue
            days = inactive_whole_days(db, lead, now)
            if not (3 <= days <= 7):
                continue
            prev_sent = _last_recovery_sent_at(db, lead.id)
            if prev_sent:
                ps = _aware(prev_sent)
                if (now - ps).total_seconds() < 7 * 86400:
                    continue
            sched = now + timedelta(minutes=30)
            db.add(
                Followup(
                    lead_id=lead.id,
                    scheduled_at=sched,
                    status="pending",
                    followup_type="recovery",
                )
            )
            created += 1
        db.commit()
    return created
