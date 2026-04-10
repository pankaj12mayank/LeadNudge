from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from api.deps import Principal, require_user
from db.session import get_db
from schemas.user import UserOut, UserPasswordUpdate, UserProfileUpdate
from services import user_profile_service

router = APIRouter(prefix="/account", tags=["account"])


@router.get("", response_model=UserOut)
def get_my_account(
    principal: Annotated[Principal, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    assert principal.user_id is not None
    u = user_profile_service.get_user(db, principal.user_id)
    return UserOut.model_validate(u)


@router.patch("", response_model=UserOut)
def patch_my_account(
    body: UserProfileUpdate,
    principal: Annotated[Principal, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    assert principal.user_id is not None
    u = user_profile_service.update_profile(db, principal.user_id, body)
    return UserOut.model_validate(u)


@router.post("/password", status_code=204)
def change_my_password(
    body: UserPasswordUpdate,
    principal: Annotated[Principal, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    assert principal.user_id is not None
    user_profile_service.change_password(db, principal.user_id, body)
