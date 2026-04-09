from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.security import safe_decode_token
from db.session import get_db

security = HTTPBearer(auto_error=False)


@dataclass
class Principal:
    role: str
    admin_id: int | None = None
    user_id: int | None = None
    workspace_id: int | None = None


def get_principal(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> Principal:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = safe_decode_token(creds.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    role = payload.get("role")
    if role == "admin":
        aid = payload.get("admin_id")
        if aid is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return Principal(role="admin", admin_id=int(aid))
    if role == "user":
        uid = payload.get("user_id")
        wid = payload.get("workspace_id")
        if uid is None or wid is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return Principal(
            role="user", user_id=int(uid), workspace_id=int(wid)
        )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token",
    )


def require_admin(p: Annotated[Principal, Depends(get_principal)]) -> Principal:
    if p.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin only",
        )
    return p


def require_user(p: Annotated[Principal, Depends(get_principal)]) -> Principal:
    if p.role != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User only",
        )
    return p


def require_auth(p: Annotated[Principal, Depends(get_principal)]) -> Principal:
    return p
