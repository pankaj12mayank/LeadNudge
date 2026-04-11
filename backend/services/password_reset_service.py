import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.config import settings
from core.security import hash_password
from models.admin import Admin
from models.password_reset import PasswordResetToken
from models.user import User
from services import branding_service
from services.transactional_mail import mail_configured, send_plain_email


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def request_password_reset(db: Session, email: str) -> None:
    email_norm = email.strip().lower()
    admin = db.query(Admin).filter(func.lower(Admin.email) == email_norm).first()
    user = db.query(User).filter(func.lower(User.email) == email_norm).first()
    if not admin and not user:
        return
    if user and not user.is_active:
        return

    kind = "admin" if admin else "user"
    b = branding_service.get_or_create_branding(db)
    if not mail_configured(b):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email is not configured. Ask an admin to set mail settings under Account.",
        )

    raw = secrets.token_urlsafe(32)
    th = _hash_token(raw)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=30)

    db.query(PasswordResetToken).filter(
        PasswordResetToken.email == email_norm
    ).delete()
    db.add(
        PasswordResetToken(
            email=email_norm,
            token_hash=th,
            principal_kind=kind,
            expires_at=expires,
        )
    )
    db.commit()

    base = settings.frontend_base_url.rstrip("/")
    link = f"{base}/reset-password?token={raw}"

    subj_tmpl = (b.reset_email_subject or "").strip() or "Reset your password"
    body_tmpl = (b.reset_email_body or "").strip() or (
        "You requested a password reset.\n\nOpen this link (valid for 30 minutes):\n"
        "{{reset_link}}\n\nIf you did not request this, ignore this email."
    )
    if kind == "admin" and admin:
        user_name = admin.email.split("@")[0] if "@" in admin.email else admin.email
    elif user:
        user_name = (user.display_name or "").strip() or (
            user.email.split("@")[0] if "@" in user.email else user.email
        )
    else:
        user_name = "there"

    subj = (
        subj_tmpl.replace("{{reset_link}}", link)
        .replace("{{reset_url}}", link)
        .replace("{{user_name}}", user_name)
    )
    if "<" in subj:
        subj = re.sub(r"<[^>]+>", "", subj).strip() or "Reset your password"
    body = (
        body_tmpl.replace("{{reset_link}}", link)
        .replace("{{reset_url}}", link)
        .replace("{{user_name}}", user_name)
    )

    send_plain_email(b, to_addr=email_norm, subject=subj, body=body)


def reset_password_with_token(db: Session, raw_token: str, new_password: str) -> None:
    if len(new_password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )
    th = _hash_token(raw_token)
    row = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == th).first()
    if not row or row.used_at is not None:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    now = datetime.now(timezone.utc)
    exp = row.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        raise HTTPException(status_code=400, detail="Reset link has expired")

    email_norm = row.email
    if row.principal_kind == "admin":
        acc = db.query(Admin).filter(func.lower(Admin.email) == email_norm).first()
        if not acc:
            raise HTTPException(status_code=400, detail="Account not found")
        acc.password = hash_password(new_password)
    else:
        acc = db.query(User).filter(func.lower(User.email) == email_norm).first()
        if not acc:
            raise HTTPException(status_code=400, detail="Account not found")
        acc.password = hash_password(new_password)

    row.used_at = now
    db.commit()
