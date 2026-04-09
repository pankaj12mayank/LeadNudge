from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.admin_profile import PublicSiteOut
from services import branding_service

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/site", response_model=PublicSiteOut)
def public_site(
    db: Annotated[Session, Depends(get_db)],
) -> PublicSiteOut:
    return PublicSiteOut(**branding_service.public_site_payload(db))
