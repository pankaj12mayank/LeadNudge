from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.security import hash_password, verify_password
from models.user import User
from schemas.user import UserPasswordUpdate, UserProfileUpdate


def get_user(db: Session, user_id: int) -> User:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u


def update_profile(db: Session, user_id: int, data: UserProfileUpdate) -> User:
    u = get_user(db, user_id)
    if data.display_name is not None:
        u.display_name = data.display_name.strip() or None
    if data.phone is not None:
        u.phone = data.phone.strip() or None
    db.commit()
    db.refresh(u)
    return u


def change_password(db: Session, user_id: int, data: UserPasswordUpdate) -> None:
    u = get_user(db, user_id)
    if not verify_password(data.current_password, u.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    u.password = hash_password(data.new_password)
    db.commit()
