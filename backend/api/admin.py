import shutil
import subprocess
from math import ceil
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from api.deps import Principal, require_admin
from core.config import settings
from core.paths import UPLOAD_DIR
from db.session import get_db
from schemas.admin_profile import (
    AdminOut,
    AdminPasswordUpdate,
    AdminProfileUpdate,
    BrandingMailOut,
    BrandingMailUpdate,
    BrandingOut,
    BrandingUpdate,
    MailTestRequest,
)
from schemas.email_template import EmailTemplateOut, EmailTemplateUpdate
from schemas.pagination import PaginationParams
from schemas.password_request import (
    PaginatedPasswordRequests,
    PasswordRequestOut,
)
from schemas.settings import AdminSettingsUpdate, SettingsOut
from schemas.system_admin import (
    ActivityClearRequest,
    OllamaInstalledModelsOut,
    OllamaPullOut,
    OllamaPullRequest,
    OllamaTestOut,
    OllamaTestRequest,
    OpenAiTestOut,
    OpenAiTestRequest,
    PaginatedActivity,
    PaginatedSentEmails,
    PaginatedSystemLogs,
    PaginatedUserUsage,
    SentEmailRowOut,
    SentEmailsDeleteRequest,
    SystemStatusOut,
)
from schemas.user import (
    AdminUserPasswordSet,
    PaginatedUsers,
    UserAdminPatch,
    UserCreate,
    UserOut,
)
from schemas.workspace import WorkspaceOut, WorkspacePlanUpdate
from services import admin_service, admin_account_service, branding_service
from services import password_request_service, template_mail_service
from services.settings_service import get_settings_out
from services import system_log_service
from services.system_admin_service import (
    paginated_user_usage,
    get_system_status,
)
from services.transactional_mail import mail_configured, send_plain_email
from utils.logger import get_logger
from utils.safe_client_message import safe_client_detail
from utils.smtp_errors import format_smtp_error

log = get_logger("admin")

router = APIRouter(prefix="/admin", tags=["admin"])


def _branding_out(b) -> BrandingOut:
    return BrandingOut(
        project_name=b.project_name,
        logo_url=branding_service.logo_public_path(b.logo_filename),
        favicon_url=branding_service.logo_public_path(b.favicon_filename),
    )


def _branding_mail_out(b) -> BrandingMailOut:
    return BrandingMailOut(
        support_email=b.support_email,
        mail_smtp_host=b.mail_smtp_host,
        mail_smtp_port=b.mail_smtp_port,
        mail_smtp_email=b.mail_smtp_email,
        mail_smtp_password="***" if b.mail_smtp_password else None,
        reset_email_subject=b.reset_email_subject,
        reset_email_body=b.reset_email_body,
    )


@router.get("/me", response_model=AdminOut)
def admin_me(
    principal: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminOut:
    admin = admin_account_service.get_admin(db, principal.admin_id)
    return AdminOut.model_validate(admin)


@router.patch("/me", response_model=AdminOut)
def admin_update_profile(
    body: AdminProfileUpdate,
    principal: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminOut:
    admin = admin_account_service.update_profile(db, principal.admin_id, body)
    return AdminOut.model_validate(admin)


@router.post("/me/password", status_code=204)
def admin_change_password(
    body: AdminPasswordUpdate,
    principal: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    admin_account_service.change_password(db, principal.admin_id, body)


@router.get("/branding", response_model=BrandingOut)
def get_branding_admin(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> BrandingOut:
    b = branding_service.get_or_create_branding(db)
    return _branding_out(b)


@router.put("/branding", response_model=BrandingOut)
def put_branding(
    body: BrandingUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> BrandingOut:
    b = branding_service.update_project_name(db, body.project_name)
    return _branding_out(b)


@router.post("/branding/logo", response_model=BrandingOut)
async def post_branding_logo(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
) -> BrandingOut:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    b = await branding_service.save_logo_file(db, UPLOAD_DIR, file)
    return _branding_out(b)


@router.post("/branding/favicon", response_model=BrandingOut)
async def post_branding_favicon(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
) -> BrandingOut:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    b = await branding_service.save_favicon_file(db, UPLOAD_DIR, file)
    return _branding_out(b)


@router.get("/branding/mail", response_model=BrandingMailOut)
def get_branding_mail(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> BrandingMailOut:
    b = branding_service.get_or_create_branding(db)
    return _branding_mail_out(b)


@router.put("/branding/mail", response_model=BrandingMailOut)
def put_branding_mail(
    body: BrandingMailUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> BrandingMailOut:
    b = admin_account_service.apply_branding_mail_settings(db, body)
    return _branding_mail_out(b)


@router.post("/branding/mail/test", status_code=204)
def post_branding_mail_test(
    body: MailTestRequest,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    b = branding_service.get_or_create_branding(db)
    if not mail_configured(b):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configure SMTP host, port, and sender email first",
        )
    try:
        send_plain_email(
            b,
            to_addr=str(body.to_email),
            subject="Test email from your CRM",
            body="This is a test message. Your outgoing mail settings are working.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=format_smtp_error(e),
        ) from e


@router.get("/ollama/models", response_model=OllamaInstalledModelsOut)
def admin_ollama_models(
    _: Annotated[Principal, Depends(require_admin)],
) -> OllamaInstalledModelsOut:
    """Always HTTP 200 with JSON; lists Ollama tags when reachable."""
    base = (settings.ollama_base_url or "http://localhost:11434").rstrip("/")
    env_m = (settings.ollama_model or "llama3.2:latest").strip() or "llama3.2:latest"
    names: list[str] = []
    err: str | None = None
    try:
        r = httpx.get(f"{base}/api/tags", timeout=10.0)
        if r.status_code != 200:
            err = f"Ollama HTTP {r.status_code} at {base}/api/tags"
        else:
            data = r.json()
            if not isinstance(data, dict):
                err = "Unexpected response from Ollama /api/tags"
            else:
                for m in data.get("models") or []:
                    if not isinstance(m, dict):
                        continue
                    n = m.get("name") or m.get("model")
                    if n:
                        names.append(str(n))
    except httpx.ConnectError as e:
        err = (
            f"Cannot connect to Ollama at {base}. Start Ollama or set OLLAMA_URL / "
            f"OLLAMA_BASE_URL in backend/.env to match where it listens."
        )
        log.warning("Ollama connect failed: %s", e)
    except Exception as e:
        err = str(e) or repr(e)
    return OllamaInstalledModelsOut(
        env_default=env_m,
        models=sorted(set(names)),
        ollama_url=base,
        error=err,
    )


@router.post("/ollama/test", response_model=OllamaTestOut)
def admin_ollama_test(
    body: OllamaTestRequest,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> OllamaTestOut:
    """Run a tiny generation with the given model (admin-only; does not persist)."""
    import traceback

    from agents.ai_router import resolve_ollama_model, run_ollama_admin_test

    m = resolve_ollama_model(body.model)
    try:
        ok, msg, preview, used = run_ollama_admin_test(
            "Reply with exactly the single word: OK",
            model=m,
        )
        if not ok:
            try:
                system_log_service.log_event(
                    db,
                    kind="AI",
                    message=f"Ollama admin test failed model={used!r}: {msg}"[:15000],
                )
            except Exception:
                pass
            return OllamaTestOut(
                ok=False,
                message=msg,
                model=used,
                preview=None,
            )
        return OllamaTestOut(
            ok=True,
            message=msg,
            model=used,
            preview=preview,
        )
    except Exception as e:
        log.warning("Ollama test failed: %s", e)
        try:
            system_log_service.log_event(
                db,
                kind="AI",
                message=f"Ollama admin test exception model={m!r}: {e!r}\n{traceback.format_exc()}"[
                    :15000
                ],
            )
        except Exception:
            pass
        return OllamaTestOut(
            ok=False,
            message="AI service temporarily unavailable. Please try again.",
            model=m,
            preview=None,
        )


@router.post("/ollama/pull", response_model=OllamaPullOut)
def admin_ollama_pull(
    body: OllamaPullRequest,
    _: Annotated[Principal, Depends(require_admin)],
) -> OllamaPullOut:
    """Run `ollama pull` on the API server (requires Ollama CLI on PATH)."""
    from agents.ai_router import _sanitize_model_name

    name = _sanitize_model_name(body.model.strip())
    if not shutil.which("ollama"):
        return OllamaPullOut(
            ok=False,
            message="`ollama` CLI not found on the server PATH. Install Ollama or pull the model manually.",
        )
    try:
        proc = subprocess.run(
            ["ollama", "pull", name],
            capture_output=True,
            text=True,
            timeout=900,
            errors="replace",
        )
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "").strip() or f"exit {proc.returncode}"
            return OllamaPullOut(ok=False, message=safe_client_detail(err, max_len=1200))
        return OllamaPullOut(
            ok=True,
            message=f"Model pull finished: {name}. You can select it and test from AI settings.",
        )
    except subprocess.TimeoutExpired:
        return OllamaPullOut(
            ok=False,
            message="`ollama pull` timed out (15 min). Try again or pull from a terminal.",
        )
    except Exception as e:
        log.warning("ollama pull failed: %s", e)
        return OllamaPullOut(ok=False, message=safe_client_detail(str(e)))


@router.post("/openai/test", response_model=OpenAiTestOut)
def admin_openai_test(
    body: OpenAiTestRequest,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> OpenAiTestOut:
    """Verify an OpenAI key (inline, workspace-stored, or env) without saving."""
    from agents.ai_router import test_openai_key

    inline = (body.api_key or "").strip() or None
    ws_key = None
    try:
        row = admin_service.get_workspace_settings(db, body.workspace_id)
        ws_key = (row.api_key or "").strip() or None
    except HTTPException as e:
        if e.status_code != status.HTTP_404_NOT_FOUND:
            raise

    env_key = (settings.openai_api_key or "").strip() or None

    if inline:
        key = inline
        src = "request"
    elif ws_key:
        key = ws_key
        src = "workspace"
    elif env_key:
        key = env_key
        src = "env"
    else:
        return OpenAiTestOut(
            ok=False,
            message=(
                "No API key found. Paste a key in the field and test, save a workspace key first, "
                "or set OPENAI_API_KEY in backend/.env."
            ),
            preview=None,
            key_source="",
        )

    ok, msg, preview = test_openai_key(key)
    return OpenAiTestOut(ok=ok, message=msg, preview=preview, key_source=src)


@router.get("/system-status", response_model=SystemStatusOut)
def admin_system_status(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SystemStatusOut:
    return get_system_status(db)


@router.get("/activity", response_model=PaginatedActivity)
def admin_activity(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    period: str | None = Query(
        default=None,
        description="Filter: 'week' (7d) or 'month' (30d); omit for all recent",
    ),
) -> PaginatedActivity:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    p = (period or "").strip().lower()
    if p not in ("", "week", "month", "all"):
        p = None
    if p == "all":
        p = None
    return system_log_service.list_activity_paginated(
        db, page=page, limit=limit, period=p
    )


@router.post("/activity/clear", status_code=204)
def admin_activity_clear(
    body: ActivityClearRequest,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    rk = body.range.strip().lower()
    if rk not in ("week", "month"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="range must be 'week' or 'month'",
        )
    system_log_service.clear_activity_period(db, range_key=rk)


@router.get("/system-logs", response_model=PaginatedSystemLogs)
def admin_system_logs(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, ge=1, le=200),
    type: str | None = Query(default=None, alias="log_type"),
) -> PaginatedSystemLogs:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    rows, total = system_log_service.list_system_logs(
        db, page=page, limit=limit, type_filter=type
    )
    items = [system_log_service.log_row_to_out(r) for r in rows]
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedSystemLogs(
        items=items, total=total, page=page, limit=limit, pages=pages
    )


@router.get("/sent-emails", response_model=PaginatedSentEmails)
def admin_sent_emails(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, ge=1, le=200),
) -> PaginatedSentEmails:
    from datetime import timezone

    from models.sent_email import SentEmail

    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    q = db.query(SentEmail)
    total = q.count()
    offset = (page - 1) * limit
    rows = (
        q.order_by(SentEmail.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items: list[SentEmailRowOut] = []
    for r in rows:
        ts = r.sent_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        items.append(
            SentEmailRowOut(
                id=r.id,
                workspace_id=r.workspace_id,
                to_email=r.to_email,
                subject=r.subject,
                body=r.body[:8000],
                sent_at=ts.isoformat(),
                status=r.status,
            )
        )
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedSentEmails(
        items=items, total=total, page=page, limit=limit, pages=pages
    )


@router.post("/sent-emails/delete", status_code=204)
def admin_sent_emails_delete(
    body: SentEmailsDeleteRequest,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    from models.sent_email import SentEmail

    ids = [i for i in body.ids if isinstance(i, int) and i > 0]
    if not ids:
        return
    db.query(SentEmail).filter(SentEmail.id.in_(ids)).delete(
        synchronize_session=False
    )
    db.commit()


@router.get("/usage/users", response_model=PaginatedUserUsage)
def admin_usage_users(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int = Query(..., description="Workspace whose users to list"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
) -> PaginatedUserUsage:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    return paginated_user_usage(
        db, workspace_id=workspace_id, page=page, limit=limit
    )


@router.get("/workspaces", response_model=list[WorkspaceOut])
def list_workspaces(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[WorkspaceOut]:
    items = admin_service.list_workspaces(db)
    return [WorkspaceOut.model_validate(w) for w in items]


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceOut)
def update_workspace_plan(
    workspace_id: int,
    body: WorkspacePlanUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkspaceOut:
    ws = admin_service.update_workspace_plan(db, workspace_id, body)
    return WorkspaceOut.model_validate(ws)


@router.get("/email-templates", response_model=list[EmailTemplateOut])
def admin_list_email_templates(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[EmailTemplateOut]:
    rows = template_mail_service.list_templates(db)
    return [EmailTemplateOut.model_validate(r) for r in rows]


@router.put("/email-templates/{name}", response_model=EmailTemplateOut)
def admin_put_email_template(
    name: str,
    body: EmailTemplateUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> EmailTemplateOut:
    try:
        row = template_mail_service.update_template(
            db, name, subject=body.subject, body=body.body
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown template name",
        ) from None
    return EmailTemplateOut.model_validate(row)


@router.get("/password-requests", response_model=PaginatedPasswordRequests)
def admin_list_password_requests(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, ge=1, le=200),
) -> PaginatedPasswordRequests:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    rows, total = password_request_service.list_password_requests(
        db, page=page, limit=limit
    )
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedPasswordRequests(
        items=[PasswordRequestOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.patch("/password-requests/{request_id}", response_model=PasswordRequestOut)
def admin_resolve_password_request(
    request_id: int,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> PasswordRequestOut:
    try:
        row = password_request_service.resolve_password_request(db, request_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        ) from None
    return PasswordRequestOut.model_validate(row)


@router.post("/users", response_model=UserOut)
def create_user(
    body: UserCreate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    user = admin_service.create_user(db, body)
    return UserOut.model_validate(user)


@router.get("/users", response_model=PaginatedUsers)
def list_users(
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    workspace_id: int | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    plan: str | None = Query(default=None, description="free | pro"),
    status: str | None = Query(default=None, description="active | inactive"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
) -> PaginatedUsers:
    page = PaginationParams.clamp_page(page)
    limit = PaginationParams.clamp_limit(limit)
    if plan is not None and plan not in ("free", "pro"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="plan must be free or pro",
        )
    if status is not None and status not in ("active", "inactive"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be active or inactive",
        )
    active_filter: bool | None = None
    if status == "active":
        active_filter = True
    elif status == "inactive":
        active_filter = False
    users, total = admin_service.list_users(
        db,
        workspace_id,
        page=page,
        limit=limit,
        search=q,
        plan=plan,
        active=active_filter,
    )
    pages = max(1, ceil(total / limit)) if limit else 1
    return PaginatedUsers(
        items=[UserOut.model_validate(u) for u in users],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.patch("/users/{user_id}", response_model=UserOut)
def patch_user(
    user_id: int,
    body: UserAdminPatch,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    u = admin_service.patch_user(db, user_id, body)
    return UserOut.model_validate(u)


@router.post("/users/{user_id}/password", response_model=UserOut)
def admin_set_user_password(
    user_id: int,
    body: AdminUserPasswordSet,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    u = admin_service.admin_set_user_password(db, user_id, body.new_password)
    return UserOut.model_validate(u)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    admin_service.delete_user(db, user_id)


@router.put("/settings", response_model=SettingsOut)
def update_settings(
    body: AdminSettingsUpdate,
    _: Annotated[Principal, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SettingsOut:
    row = admin_service.update_admin_settings(db, body)
    return get_settings_out(db, row.workspace_id, mask_api_key=False)
