from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from api import admin, auth, followups, leads, public, settings as settings_router
from core.config import settings
from core.paths import STATIC_ROOT, UPLOAD_DIR
from core.security import hash_password
from db.session import SessionLocal, init_db
from models.admin import Admin
from utils.logger import get_logger

log = get_logger("main")


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
    yield


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
app.include_router(admin.router)
app.include_router(leads.router)
app.include_router(followups.router)
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
