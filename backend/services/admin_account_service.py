from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.security import hash_password, verify_password
from models.admin import Admin
from schemas.admin_profile import AdminProfileUpdate, AdminPasswordUpdate


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
