from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from core.config import settings
from models.branding import AppBranding

ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".svg", ".webp"}
ALLOWED_FAVICON_EXT = ALLOWED_EXT | {".ico"}
MAX_BYTES = 2 * 1024 * 1024


def get_or_create_branding(db: Session) -> AppBranding:
    row = db.get(AppBranding, 1)
    if not row:
        row = AppBranding(
            id=1,
            project_name="Sales Follow-up Console",
            logo_filename=None,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def logo_public_path(filename: str | None) -> str | None:
    if not filename:
        return None
    return f"/static/uploads/{filename}"


def public_site_payload(db: Session) -> dict:
    b = get_or_create_branding(db)
    return {
        "project_name": b.project_name,
        "logo_url": logo_public_path(b.logo_filename),
        "favicon_url": logo_public_path(b.favicon_filename),
        "support_email": b.support_email,
        "ollama_base_url": (settings.ollama_base_url or "http://127.0.0.1:11434").rstrip(
            "/"
        ),
        "ollama_model": settings.ollama_model or "llama3.2:latest",
        "openai_chat_model": "gpt-4o-mini",
    }


def update_project_name(db: Session, name: str) -> AppBranding:
    b = get_or_create_branding(db)
    b.project_name = name
    db.commit()
    db.refresh(b)
    return b


async def save_logo_file(
    db: Session, upload_dir: Path, file: UploadFile
) -> AppBranding:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file name")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Allowed types: {', '.join(sorted(ALLOWED_EXT))}",
        )
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 2MB)")
    upload_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{uuid4().hex}{suffix}"
    path = upload_dir / fname
    path.write_bytes(data)
    b = get_or_create_branding(db)
    old = b.logo_filename
    b.logo_filename = fname
    db.commit()
    db.refresh(b)
    if old:
        old_path = upload_dir / old
        try:
            old_path.unlink(missing_ok=True)
        except OSError:
            pass
    return b


async def save_favicon_file(
    db: Session, upload_dir: Path, file: UploadFile
) -> AppBranding:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file name")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_FAVICON_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Allowed favicon types: {', '.join(sorted(ALLOWED_FAVICON_EXT))}",
        )
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 2MB)")
    upload_dir.mkdir(parents=True, exist_ok=True)
    fname = f"fav_{uuid4().hex}{suffix}"
    path = upload_dir / fname
    path.write_bytes(data)
    b = get_or_create_branding(db)
    old = b.favicon_filename
    b.favicon_filename = fname
    db.commit()
    db.refresh(b)
    if old:
        old_path = upload_dir / old
        try:
            old_path.unlink(missing_ok=True)
        except OSError:
            pass
    return b
