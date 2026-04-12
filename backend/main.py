import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from api import (
    account,
    admin,
    auth,
    dashboard,
    followups,
    leads,
    outbound_mails,
    public,
    settings as settings_router,
)
from core.config import settings
from core.paths import STATIC_ROOT, UPLOAD_DIR
from core.security import hash_password
from db.session import SessionLocal, init_db
from models.admin import Admin
from utils.logger import get_logger

log = get_logger("main")


async def _followup_scheduler_loop() -> None:
    from services import followup_service

    await asyncio.sleep(4)
    while True:
        db = SessionLocal()
        try:
            n = followup_service.process_due_followups_batch(db)
            if n:
                log.info("Processed %s due follow-up(s)", n)
        except Exception:
            log.exception("Follow-up scheduler tick failed")
        finally:
            db.close()
        await asyncio.sleep(30)


async def _daily_sales_maintenance_loop() -> None:
    """Once per UTC day: refresh lead temperature tags and queue missed-lead recovery."""
    from datetime import date, datetime, timezone

    from services import lead_service, recovery_service

    await asyncio.sleep(60)
    last_run: date | None = None
    while True:
        today = datetime.now(timezone.utc).date()
        if last_run != today:
            db = SessionLocal()
            try:
                n_tag = lead_service.recompute_all_temperature_tags(db)
                n_rec = recovery_service.run_daily_recovery(db)
                last_run = today
                if n_tag or n_rec:
                    log.info(
                        "Daily maintenance: temperature updates=%s recovery queued=%s",
                        n_tag,
                        n_rec,
                    )
            except Exception:
                log.exception("Daily sales maintenance failed")
            finally:
                db.close()
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    STATIC_ROOT.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        email = settings.bootstrap_admin_email
        password = settings.bootstrap_admin_password
        if email and password and not db.query(Admin).filter(Admin.email == email).first():
            db.add(Admin(email=email, password=hash_password(password)))
            db.commit()
            log.info("Bootstrap admin created: %s", email)
    finally:
        db.close()
    task_followups = asyncio.create_task(_followup_scheduler_loop())
    task_daily = asyncio.create_task(_daily_sales_maintenance_loop())
    yield
    task_followups.cancel()
    task_daily.cancel()
    for t in (task_followups, task_daily):
        try:
            await t
        except asyncio.CancelledError:
            pass


app = FastAPI(title="AI Sales Follow-up Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_ROOT)),
    name="static",
)
app.include_router(public.router)
app.include_router(auth.router)
app.include_router(account.router)
app.include_router(admin.router)
app.include_router(leads.router)
app.include_router(dashboard.router)
app.include_router(followups.router)
app.include_router(outbound_mails.router)
app.include_router(settings_router.router)


@app.exception_handler(StarletteHTTPException)
async def http_exc_handler(_, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exc_handler(_, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"service": "ai-sales-followup-agent"}
