from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.deps import Principal, get_principal
from db.session import get_db
from schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MeOut,
    ResetPasswordRequest,
    TokenResponse,
)
from services import admin_account_service, auth_service
from services import password_reset_service
from services import user_profile_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    data = auth_service.login(db, body.email, body.password)
    return TokenResponse(**data)


@router.post("/forgot-password", status_code=204)
def forgot_password(
    body: ForgotPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    try:
        password_reset_service.request_password_reset(db, body.email)
    except HTTPException:
        raise


@router.post("/reset-password", status_code=204)
def reset_password(
    body: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    password_reset_service.reset_password_with_token(
        db, body.token, body.new_password
    )


@router.get("/me", response_model=MeOut)
def auth_me(
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
) -> MeOut:
    if principal.role == "admin":
        a = admin_account_service.get_admin(db, principal.admin_id)
        return MeOut(
            role="admin",
            email=a.email,
            display_name=a.display_name,
            phone=None,
        )
    assert principal.user_id is not None
    u = user_profile_service.get_user(db, principal.user_id)
    return MeOut(
        role="user",
        email=u.email,
        display_name=u.display_name,
        phone=u.phone,
    )
