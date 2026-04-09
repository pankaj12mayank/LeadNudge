from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.security import create_access_token, verify_password
from models.admin import Admin
from models.user import User


def login(db: Session, email: str, password: str) -> dict:
    admin = db.query(Admin).filter(Admin.email == email).first()
    if admin and verify_password(password, admin.password):
        token = create_access_token(
            {
                "role": "admin",
                "sub": f"admin:{admin.id}",
                "admin_id": admin.id,
            }
        )
        return {"access_token": token, "token_type": "bearer", "role": "admin"}

    user = db.query(User).filter(User.email == email).first()
    if user and verify_password(password, user.password):
        token = create_access_token(
            {
                "role": "user",
                "sub": f"user:{user.id}",
                "user_id": user.id,
                "workspace_id": user.workspace_id,
            }
        )
        return {"access_token": token, "token_type": "bearer", "role": "user"}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )
