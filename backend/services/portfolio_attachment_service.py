"""Optional workspace portfolio PDF attached to AI follow-up emails."""

import re
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from core.paths import UPLOAD_DIR
from models.settings import WorkspaceSettings

MAX_BYTES = 8 * 1024 * 1024
_SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")


def portfolio_dir(workspace_id: int) -> Path:
    d = UPLOAD_DIR / "portfolios" / f"ws_{int(workspace_id)}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def resolved_portfolio_path(row: WorkspaceSettings | None) -> Path | None:
    if not row:
        return None
    rel = (row.portfolio_attachment_path or "").strip().replace("\\", "/")
    if not rel or ".." in rel.split("/"):
        return None
    p = UPLOAD_DIR / rel
    if p.is_file():
        return p
    return None


async def save_workspace_portfolio(
    db: Session,
    workspace_id: int,
    file: UploadFile,
) -> WorkspaceSettings:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Settings not found")
    old = resolved_portfolio_path(row)
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Portfolio file must be 8 MB or smaller",
        )
    fn = (file.filename or "portfolio.pdf").strip()
    if not fn.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed for portfolio",
        )
    base = Path(fn).name
    base = _SAFE_NAME.sub("_", base) or "portfolio.pdf"
    if not base.lower().endswith(".pdf"):
        base = f"{base}.pdf"

    d = portfolio_dir(workspace_id)
    dest = d / base
    dest.write_bytes(raw)
    row.portfolio_attachment_path = (
        Path("portfolios") / f"ws_{workspace_id}" / base
    ).as_posix()
    if old and old.is_file() and old.resolve() != dest.resolve():
        try:
            old.unlink()
        except OSError:
            pass
    db.commit()
    db.refresh(row)
    return row


def clear_workspace_portfolio(db: Session, workspace_id: int) -> None:
    row = (
        db.query(WorkspaceSettings)
        .filter(WorkspaceSettings.workspace_id == workspace_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Settings not found")
    p = resolved_portfolio_path(row)
    if p and p.is_file():
        try:
            p.unlink()
        except OSError:
            pass
    row.portfolio_attachment_path = None
    db.commit()
