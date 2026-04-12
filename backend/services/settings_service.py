import smtplib
import ssl

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.lead import Lead
from models.message import Message
from models.outbound_email import OutboundEmail
from models.settings import WorkspaceSettings
from models.workspace import Workspace
from schemas.settings import SettingsOut, SettingsUpdate
from utils.smtp_errors import format_smtp_error


def _workspace_ai_message_count(db: Session, workspace_id: int) -> int:
    stmt = (
        select(func.count())
        .select_from(Message)
        .join(Lead, Message.lead_id == Lead.id)
        .where(Lead.workspace_id == workspace_id)
    )
    return int(db.execute(stmt).scalar_one())


def count_workspace_ai_messages(db: Session, workspace_id: int) -> int:
    """Messages tied to leads in this workspace (same basis as the AI usage quota)."""
    return _workspace_ai_message_count(db, workspace_id)


def _workspace_outbound_count(db: Session, workspace_id: int) -> int:
    stmt = (
        select(func.count())
        .select_from(OutboundEmail)
        .where(OutboundEmail.workspace_id == workspace_id)
    )
    return int(db.execute(stmt).scalar_one())


def _smtp_configured(row: WorkspaceSettings) -> bool:
    return bool(
        (row.smtp_host or "").strip()
        and (row.smtp_email or "").strip()
        and row.smtp_port is not None
    )


def get_settings_out(
    db: Session, workspace_id: int, *, mask_api_key: bool, mask_smtp_password: bool = True
) -> SettingsOut:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Settings not found")
    key = None
    if not mask_api_key:
        key = row.api_key
    elif row.api_key:
        key = "***"

    smtp_pw = None
    if not mask_smtp_password:
        smtp_pw = row.smtp_password
    elif row.smtp_password:
        smtp_pw = "***"

    used = _workspace_ai_message_count(db, workspace_id)
    lim = max(0, int(row.usage_limit or 0))
    outbound_n = _workspace_outbound_count(db, workspace_id)
    pct = (100.0 * used / lim) if lim > 0 else 0.0
    near = lim > 0 and used >= int(lim * 0.9 + 0.9999) and used < lim
    exhausted = lim > 0 and used >= lim

    from services import usage_alerts_service
    from services.plan_access_service import workspace_plan_expired
    from services.plan_expiry_notify_service import maybe_send_plan_expired_emails

    maybe_send_plan_expired_emails(db, workspace_id)
    usage_alerts_service.sync_usage_threshold_emails(db, workspace_id)

    ws_row = db.get(Workspace, workspace_id)
    plan_exp = workspace_plan_expired(db, workspace_id)
    features_blocked = plan_exp or exhausted

    return SettingsOut(
        workspace_id=row.workspace_id,
        ai_mode=row.ai_mode,
        api_key=key,
        usage_limit=row.usage_limit,
        ollama_model=row.ollama_model,
        smtp_host=row.smtp_host,
        smtp_port=row.smtp_port,
        smtp_email=row.smtp_email,
        smtp_password=smtp_pw,
        followup_subject_template=row.followup_subject_template,
        followup_opening_line=row.followup_opening_line,
        followup_closing_template=row.followup_closing_template,
        followup_sender_display_name=row.followup_sender_display_name,
        ai_messages_used=used,
        outbound_emails_sent=outbound_n,
        usage_percent=round(pct, 2),
        usage_near_limit=near,
        ai_quota_exhausted=exhausted,
        plan_expired=plan_exp,
        ai_features_blocked=features_blocked,
        plan_expires_at=ws_row.plan_expires_at if ws_row else None,
        smtp_fully_configured=_smtp_configured(row),
        dashboard_manual_replies=int(row.dashboard_manual_replies or 0),
        dashboard_manual_conversions=int(row.dashboard_manual_conversions or 0),
    )


def update_user_settings(
    db: Session, workspace_id: int, data: SettingsUpdate
) -> WorkspaceSettings:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Settings not found")
    if data.api_key is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can set API key",
        )
    ws_plan = db.get(Workspace, workspace_id)
    plan = (ws_plan.plan_type or "free").lower() if ws_plan else "free"
    if data.ai_mode is not None:
        if plan != "pro" and data.ai_mode == "api":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="OpenAI (API) mode is only available on the Pro workspace.",
            )
        row.ai_mode = data.ai_mode
    if data.usage_limit is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an administrator can change the workspace AI message limit.",
        )

    smtp_request = any(
        x is not None
        for x in (
            data.smtp_host,
            data.smtp_port,
            data.smtp_email,
            data.smtp_password,
        )
    )
    if smtp_request:
        if data.smtp_host is not None:
            row.smtp_host = data.smtp_host.strip() if data.smtp_host.strip() else None
        if data.smtp_port is not None:
            row.smtp_port = data.smtp_port
        if data.smtp_email is not None:
            row.smtp_email = str(data.smtp_email).strip()
        if data.smtp_password is not None and str(data.smtp_password).strip():
            row.smtp_password = str(data.smtp_password).strip()
        if not _smtp_configured(row):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SMTP requires smtp_host, smtp_port, and smtp_email",
            )

    if data.followup_subject_template is not None:
        s = (data.followup_subject_template or "").strip()
        row.followup_subject_template = s or None
    if data.followup_opening_line is not None:
        s = (data.followup_opening_line or "").strip()
        row.followup_opening_line = s or None
    if data.followup_closing_template is not None:
        s = (data.followup_closing_template or "").strip()
        row.followup_closing_template = s or None
    if data.followup_sender_display_name is not None:
        s = (data.followup_sender_display_name or "").strip()
        row.followup_sender_display_name = s or None

    if data.dashboard_manual_replies is not None:
        row.dashboard_manual_replies = int(data.dashboard_manual_replies)
    if data.dashboard_manual_conversions is not None:
        row.dashboard_manual_conversions = int(data.dashboard_manual_conversions)

    if ws_plan and (ws_plan.plan_type or "free").lower() != "pro":
        row.ai_mode = "local"

    db.commit()
    db.refresh(row)
    return row


def test_smtp_connection(db: Session, workspace_id: int) -> tuple[bool, str]:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if not row:
        return False, "Settings not found"
    host = (row.smtp_host or "").strip()
    port = row.smtp_port
    user = (row.smtp_email or "").strip()
    if not host or port is None or not user:
        return False, "SMTP is not fully configured"

    context = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15, context=context) as smtp:
                smtp.login(user, row.smtp_password or "")
        else:
            with smtplib.SMTP(host, port, timeout=15) as smtp:
                smtp.ehlo()
                if smtp.has_extn("STARTTLS"):
                    smtp.starttls(context=context)
                    smtp.ehlo()
                if row.smtp_password:
                    smtp.login(user, row.smtp_password)
        return True, "SMTP connection OK"
    except Exception as e:
        return False, format_smtp_error(e)
