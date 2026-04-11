from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.security import hash_password, verify_password
from models.admin import Admin
from models.branding import AppBranding
from schemas.admin_profile import (
    AdminPasswordUpdate,
    AdminProfileUpdate,
    BrandingMailUpdate,
)
from services import branding_service
from services.transactional_mail import mail_configured


def get_admin(db: Session, admin_id: int) -> Admin:
    admin = db.get(Admin, admin_id)
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    return admin


def update_profile(db: Session, admin_id: int, data: AdminProfileUpdate) -> Admin:
    admin = get_admin(db, admin_id)
    if data.display_name is not None:
        admin.display_name = data.display_name or None
    if data.email is not None:
        other = db.query(Admin).filter(Admin.email == data.email).first()
        if other and other.id != admin.id:
            raise HTTPException(status_code=400, detail="Email already in use")
        admin.email = data.email
    db.commit()
    db.refresh(admin)
    return admin


def change_password(
    db: Session, admin_id: int, data: AdminPasswordUpdate
) -> None:
    admin = get_admin(db, admin_id)
    if not verify_password(data.current_password, admin.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    admin.password = hash_password(data.new_password)
    db.commit()


def apply_branding_mail_settings(db: Session, data: BrandingMailUpdate) -> AppBranding:
    b = branding_service.get_or_create_branding(db)
    if data.support_email is not None:
        b.support_email = (data.support_email or "").strip() or None
    if data.mail_smtp_host is not None:
        b.mail_smtp_host = (data.mail_smtp_host or "").strip() or None
    if data.mail_smtp_port is not None:
        b.mail_smtp_port = data.mail_smtp_port
    if data.mail_smtp_email is not None:
        b.mail_smtp_email = (data.mail_smtp_email or "").strip() or None
    if data.mail_smtp_password is not None and str(data.mail_smtp_password).strip():
        b.mail_smtp_password = str(data.mail_smtp_password).strip()
    if data.reset_email_subject is not None:
        b.reset_email_subject = (data.reset_email_subject or "").strip() or None
    if data.reset_email_body is not None:
        b.reset_email_body = data.reset_email_body
    partial = bool(b.mail_smtp_host or b.mail_smtp_email or b.mail_smtp_port)
    if partial and not mail_configured(b):
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP requires host, port, and sender email together",
        )
    db.commit()
    db.refresh(b)
    return b
