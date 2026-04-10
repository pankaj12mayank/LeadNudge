from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from core.config import settings
from db.base import Base

connect_args = {"check_same_thread": False} if settings.database_url.startswith(
    "sqlite"
) else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_migrate_admins_display_name() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        try:
            conn.execute(
                text("ALTER TABLE admins ADD COLUMN display_name VARCHAR(120)")
            )
        except Exception:
            pass


def _sqlite_migrate_leads_contact() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        for stmt in (
            "ALTER TABLE leads ADD COLUMN phone_number VARCHAR(64)",
            "ALTER TABLE leads ADD COLUMN country_code VARCHAR(8)",
        ):
            try:
                conn.execute(text(stmt))
            except Exception:
                pass


def _sqlite_migrate_settings_smtp() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        for stmt in (
            "ALTER TABLE settings ADD COLUMN smtp_host VARCHAR(255)",
            "ALTER TABLE settings ADD COLUMN smtp_port INTEGER",
            "ALTER TABLE settings ADD COLUMN smtp_email VARCHAR(255)",
            "ALTER TABLE settings ADD COLUMN smtp_password TEXT",
        ):
            try:
                conn.execute(text(stmt))
            except Exception:
                pass


def _sqlite_migrate_users_profile() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        for stmt in (
            "ALTER TABLE users ADD COLUMN display_name VARCHAR(120)",
            "ALTER TABLE users ADD COLUMN phone VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1 NOT NULL",
        ):
            try:
                conn.execute(text(stmt))
            except Exception:
                pass


def _sqlite_migrate_messages_created_at() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        try:
            conn.execute(
                text(
                    "ALTER TABLE messages ADD COLUMN created_at TIMESTAMP"
                )
            )
        except Exception:
            pass
        try:
            conn.execute(
                text(
                    "UPDATE messages SET created_at = CURRENT_TIMESTAMP "
                    "WHERE created_at IS NULL"
                )
            )
        except Exception:
            pass


def _sqlite_migrate_followup_failure() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        try:
            conn.execute(
                text(
                    "ALTER TABLE followups ADD COLUMN failure_reason VARCHAR(512)"
                )
            )
        except Exception:
            pass


def _sqlite_migrate_branding_extras() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        for stmt in (
            "ALTER TABLE app_branding ADD COLUMN favicon_filename VARCHAR(512)",
            "ALTER TABLE app_branding ADD COLUMN support_email VARCHAR(255)",
            "ALTER TABLE app_branding ADD COLUMN mail_smtp_host VARCHAR(255)",
            "ALTER TABLE app_branding ADD COLUMN mail_smtp_port INTEGER",
            "ALTER TABLE app_branding ADD COLUMN mail_smtp_email VARCHAR(255)",
            "ALTER TABLE app_branding ADD COLUMN mail_smtp_password TEXT",
            "ALTER TABLE app_branding ADD COLUMN reset_email_subject VARCHAR(255)",
            "ALTER TABLE app_branding ADD COLUMN reset_email_body TEXT",
        ):
            try:
                conn.execute(text(stmt))
            except Exception:
                pass


def init_db() -> None:
    from models import admin  # noqa: F401
    from models import branding  # noqa: F401
    from models import followup  # noqa: F401
    from models import lead  # noqa: F401
    from models import message  # noqa: F401
    from models import password_reset  # noqa: F401
    from models import settings as settings_model  # noqa: F401
    from models import user  # noqa: F401
    from models import workspace  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _sqlite_migrate_admins_display_name()
    _sqlite_migrate_leads_contact()
    _sqlite_migrate_settings_smtp()
    _sqlite_migrate_users_profile()
    _sqlite_migrate_messages_created_at()
    _sqlite_migrate_followup_failure()
    _sqlite_migrate_branding_extras()

    from services import admin_service

    db = SessionLocal()
    try:
        admin_service.ensure_fixed_workspaces(db)
    finally:
        db.close()
