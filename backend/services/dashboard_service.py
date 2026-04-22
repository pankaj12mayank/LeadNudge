from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.followup import Followup
from models.lead import Lead
from models.settings import WorkspaceSettings
from schemas.dashboard import (
    DashboardFollowupRow,
    DashboardLeadRow,
    SalesDashboardOut,
)


def _day_start_utc(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def _next_day_start_utc(d: date) -> datetime:
    return _day_start_utc(d) + timedelta(days=1)


def get_sales_dashboard(
    db: Session,
    workspace_id: int,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
    owner_user_id: int | None = None,
) -> SalesDashboardOut:
    q_leads = db.query(Lead).filter(Lead.workspace_id == workspace_id)
    if owner_user_id is not None:
        q_leads = q_leads.filter(Lead.owner_user_id == owner_user_id)
    st = (status or "").strip().lower()
    if st:
        q_leads = q_leads.filter(Lead.status == st)
    if date_from is not None:
        q_leads = q_leads.filter(Lead.created_at >= _day_start_utc(date_from))
    if date_to is not None:
        q_leads = q_leads.filter(Lead.created_at < _next_day_start_utc(date_to))

    total_leads = q_leads.count()
    recent_leads = q_leads.order_by(Lead.id.desc()).limit(12).all()

    fq = (
        db.query(func.count(Followup.id))
        .join(Lead, Followup.lead_id == Lead.id)
        .filter(Lead.workspace_id == workspace_id, Followup.status == "sent")
    )
    if owner_user_id is not None:
        fq = fq.filter(Lead.owner_user_id == owner_user_id)
    if date_from is not None:
        fq = fq.filter(Followup.sent_at >= _day_start_utc(date_from))
    if date_to is not None:
        fq = fq.filter(Followup.sent_at < _next_day_start_utc(date_to))
    followups_sent = int(db.execute(fq).scalar_one() or 0)

    settings_row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    manual_replies = int(settings_row.dashboard_manual_replies or 0) if settings_row else 0
    manual_conversions = (
        int(settings_row.dashboard_manual_conversions or 0) if settings_row else 0
    )

    recent_fu_q = (
        db.query(Followup)
        .join(Lead, Followup.lead_id == Lead.id)
        .filter(Lead.workspace_id == workspace_id)
    )
    if owner_user_id is not None:
        recent_fu_q = recent_fu_q.filter(Lead.owner_user_id == owner_user_id)
    if date_from is not None:
        recent_fu_q = recent_fu_q.filter(
            Followup.scheduled_at >= _day_start_utc(date_from)
        )
    if date_to is not None:
        recent_fu_q = recent_fu_q.filter(
            Followup.scheduled_at < _next_day_start_utc(date_to)
        )
    recent_fus = (
        recent_fu_q.options(joinedload(Followup.lead))
        .order_by(Followup.id.desc())
        .limit(12)
        .all()
    )

    return SalesDashboardOut(
        total_leads=total_leads,
        followups_sent=followups_sent,
        manual_replies=manual_replies,
        manual_conversions=manual_conversions,
        recent_leads=[
            DashboardLeadRow(
                id=x.id,
                name=x.name,
                email=x.email,
                status=x.status,
                temperature_tag=x.temperature_tag,
                created_at=x.created_at,
            )
            for x in recent_leads
        ],
        recent_followups=[
            DashboardFollowupRow(
                id=f.id,
                lead_id=f.lead_id,
                lead_name=f.lead.name if f.lead is not None else None,
                scheduled_at=f.scheduled_at,
                status=f.status,
                followup_type=getattr(f, "followup_type", "normal") or "normal",
                sent_at=f.sent_at,
            )
            for f in recent_fus
        ],
    )
