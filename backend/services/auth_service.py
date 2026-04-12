from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.security import create_access_token, verify_password
from models.admin import Admin
from models.user import User

USER_LOGIN_BLOCKED_MSG = (
    "Admin has blocked your account. Contact support."
)


def assert_user_portal_access(db: Session, user: User) -> None:
    """Reject session only when admin deactivated the user. Plan / quota never block login."""
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=USER_LOGIN_BLOCKED_MSG,
        )


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
        assert_user_portal_access(db, user)
        from services.plan_expiry_notify_service import maybe_send_plan_expired_emails

        maybe_send_plan_expired_emails(db, user.workspace_id)
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
