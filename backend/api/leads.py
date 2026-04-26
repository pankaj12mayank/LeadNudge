from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from api.deps import Principal, get_principal
from db.session import get_db
from schemas.lead import (
    LeadCreate,
    LeadCsvImportResult,
    LeadOut,
    LeadsBatchDeleteOut,
    LeadsBatchDeleteRequest,
    LeadUpdate,
    PaginatedLeads,
)
from services import lead_service

router = APIRouter(prefix="/leads", tags=["leads"])

CSV_SAMPLE = (
    '"Name","Company","Role","Profile Link","Agency Type (SEO / Ads / Creative)",'
    '"Team Size (estimate)","Problem Seen","Last Active","Connection Sent (Date)",'
    '"Replied (Y/N)","Status"\n'
    '"Jane Agency Lead","Pixel Growth Co","Founder","https://linkedin.com/in/example",'
    '"SEO","10-20","Asked for technical audit","2025-01-12","2025-01-08","Y","contacted"\n'
    '"Ravi Mehta","Monsoon Ads","Head of Growth","https://linkedin.com/in/ravimehta",'
    '"Ads","50+","Budget freeze concern","2025-01-10","2025-01-02","N","new"\n'
)


def _workspace_scope(principal: Principal, workspace_id: int | None) -> int | None:
    if principal.role == "admin":
        return workspace_id
    return principal.workspace_id


@router.get("/csv-sample")
def download_csv_sample(
    _: Annotated[Principal, Depends(get_principal)],
) -> PlainTextResponse:
    return PlainTextResponse(
        CSV_SAMPLE,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="leads_sample.csv"',
        },
    )


def _leads_batch_delete_handler(
    body: LeadsBatchDeleteRequest,
    principal: Principal,
    db: Session,
) -> LeadsBatchDeleteOut:
    n = lead_service.delete_leads_batch(
        db,
        list(body.ids),
        workspace_id=principal.workspace_id,
        is_admin=principal.role == "admin",
        user_id=principal.user_id if principal.role == "user" else None,
    )
    return LeadsBatchDeleteOut(deleted=n)


@router.post("/bulk-delete", response_model=LeadsBatchDeleteOut)
def delete_leads_bulk_delete(
    body: LeadsBatchDeleteRequest,
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
) -> LeadsBatchDeleteOut:
    """Bulk delete (preferred path; avoids some proxies blocking paths with multiple segments)."""
    return _leads_batch_delete_handler(body, principal, db)


@router.post("/batch-delete", response_model=LeadsBatchDeleteOut)
def delete_leads_batch_delete(
    body: LeadsBatchDeleteRequest,
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
) -> LeadsBatchDeleteOut:
    return _leads_batch_delete_handler(body, principal, db)


@router.get("", response_model=PaginatedLeads)
def list_leads(
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    status: str | None = Query(default=None, max_length=64),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
) -> PaginatedLeads:
    if principal.role == "user" and workspace_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot scope other workspaces",
        )
    wid = _workspace_scope(principal, workspace_id)
    rows, total = lead_service.list_leads(
        db,
        workspace_id=wid,
        is_admin=principal.role == "admin",
        page=page,
        limit=limit,
        search=q,
        status=status,
        owner_user_id=principal.user_id if principal.role == "user" else None,
    )
    return PaginatedLeads.from_page(
        [LeadOut.model_validate(x) for x in rows],
        total,
        page,
        limit,
    )


@router.post("", response_model=LeadOut)
def create_lead(
    body: LeadCreate,
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int | None = Query(default=None),
) -> LeadOut:
    if principal.role == "admin":
        if workspace_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="workspace_id query required for admin",
            )
        wid = workspace_id
    else:
        wid = principal.workspace_id
        if wid is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No workspace assigned to this account",
            )
    owner_uid = principal.user_id if principal.role == "user" else None
    lead = lead_service.create_lead(db, wid, body, owner_user_id=owner_uid)
    return LeadOut.model_validate(lead)


@router.post("/import-csv", response_model=LeadCsvImportResult)
async def import_leads_csv(
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
    workspace_id: int | None = Query(default=None),
) -> LeadCsvImportResult:
    if principal.role == "admin":
        if workspace_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="workspace_id query required for admin",
            )
        wid = workspace_id
    else:
        wid = principal.workspace_id
        if wid is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No workspace assigned to this account",
            )
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a .csv file",
        )
    raw = await file.read()
    import io

    owner_uid = principal.user_id if principal.role == "user" else None
    result = lead_service.import_leads_from_csv(
        db, wid, io.BytesIO(raw), owner_user_id=owner_uid
    )
    return result


@router.put("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    body: LeadUpdate,
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
) -> LeadOut:
    lead = lead_service.update_lead(
        db,
        lead_id,
        body,
        workspace_id=principal.workspace_id,
        is_admin=principal.role == "admin",
        user_id=principal.user_id if principal.role == "user" else None,
    )
    return LeadOut.model_validate(lead)


@router.delete("/{lead_id}", status_code=204)
def delete_lead(
    lead_id: int,
    principal: Annotated[Principal, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    lead_service.delete_lead(
        db,
        lead_id,
        workspace_id=principal.workspace_id,
        is_admin=principal.role == "admin",
        user_id=principal.user_id if principal.role == "user" else None,
    )
