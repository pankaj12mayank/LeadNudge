from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.security import create_access_token, verify_password
from models.admin import Admin
from models.user import User
from models.workspace import Workspace
from services import template_mail_service as tm


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def login(db: Session, email: str, password: str) -> dict:
    email_l = email.strip().lower()
    admin = db.query(Admin).filter(func.lower(Admin.email) == email_l).first()
    if admin and verify_password(password, admin.password):
        token = create_access_token(
            {
                "role": "admin",
                "sub": f"admin:{admin.id}",
                "admin_id": admin.id,
            }
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "role": "admin",
            "display_name": admin.display_name,
        }

    user = db.query(User).filter(func.lower(User.email) == email_l).first()
    if user and verify_password(password, user.password):
        ws = db.get(Workspace, user.workspace_id)
        exp = ws.plan_expires_at if ws else None
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if ws and exp is not None and exp < _utc_now():
            for u in (
                db.query(User)
                .filter(User.workspace_id == ws.id, User.is_active.is_(True))
                .all()
            ):
                u.is_active = False
            db.commit()
            db.refresh(user)
            pv = tm.project_variables(db)
            nm = (user.display_name or (user.email or "").split("@")[0] or "there").strip()
            tm.try_send_template(
                db,
                tm.TEMPLATE_PLAN_EXPIRED,
                user.email,
                {"name": nm, "email": user.email or "", **pv},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your plan has expired. Contact your administrator to renew.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is deactivated. Contact admin.",
            )
        token = create_access_token(
            {
                "role": "user",
                "sub": f"user:{user.id}",
                "user_id": user.id,
                "workspace_id": user.workspace_id,
            }
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "role": "user",
            "display_name": user.display_name,
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )
