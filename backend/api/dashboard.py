from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import Principal, get_principal
from db.session import get_db
from schemas.dashboard import SalesDashboardOut
from services.dashboard_service import get_sales_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _parse_date(s: str | None) -> date | None:
    if not s or not str(s).strip():
        return None
    try:
        return date.fromisoformat(str(s).strip()[:10])
    except ValueError:
        return None


@router.get("/summary", response_model=SalesDashboardOut)
def sales_dashboard_summary(
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
    date_from: str | None = Query(default=None, max_length=32),
    date_to: str | None = Query(default=None, max_length=32),
    status: str | None = Query(default=None, max_length=64),
) -> SalesDashboardOut:
    if principal.role != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sales dashboard is available to workspace users only",
        )
    if principal.workspace_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )
    df = _parse_date(date_from)
    dt = _parse_date(date_to)
    if date_from and df is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date_from (use YYYY-MM-DD)",
        )
    if date_to and dt is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date_to (use YYYY-MM-DD)",
        )
    st = (status or "").strip().lower() or None
    return get_sales_dashboard(
        db,
        principal.workspace_id,
        date_from=df,
        date_to=dt,
        status=st,
        owner_user_id=principal.user_id,
    )
