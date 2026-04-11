import smtplib
import ssl

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.settings import WorkspaceSettings
from schemas.settings import SettingsOut, SettingsUpdate
from utils.smtp_errors import format_smtp_error


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
    )


def _smtp_configured(row: WorkspaceSettings) -> bool:
    return bool(
        (row.smtp_host or "").strip()
        and (row.smtp_email or "").strip()
        and row.smtp_port is not None
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
    if data.ai_mode is not None:
        row.ai_mode = data.ai_mode
    if data.usage_limit is not None:
        row.usage_limit = data.usage_limit

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
        if data.smtp_password is not None:
            row.smtp_password = data.smtp_password or None
        if not _smtp_configured(row):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SMTP requires smtp_host, smtp_port, and smtp_email",
            )

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
