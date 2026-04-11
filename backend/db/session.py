from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
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


def _sqlite_migrate_settings_ollama_model() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        try:
            conn.execute(
                text("ALTER TABLE settings ADD COLUMN ollama_model VARCHAR(128)")
            )
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


def _ensure_column_if_missing(
    table: str,
    column: str,
    *,
    sqlite_ddl: str,
    postgres_ddl: str,
) -> None:
    """Add a column when the table exists but predates the model (any engine)."""
    try:
        insp = inspect(engine)
        if table not in insp.get_table_names():
            return
        names = {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return
    if column in names:
        return
    url = settings.database_url.lower()
    with engine.begin() as conn:
        try:
            if url.startswith("sqlite"):
                conn.execute(text(sqlite_ddl))
            elif "postgresql" in url or "postgres" in url:
                conn.execute(text(postgres_ddl))
            else:
                conn.execute(text(sqlite_ddl))
        except Exception:
            pass


def _sqlite_migrate_lead_last_message() -> None:
    """Legacy SQLite path; superseded by _ensure_column_if_missing for cross-DB."""
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE leads ADD COLUMN last_message TEXT"))
        except Exception:
            pass


def _sqlite_migrate_message_followup_id() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        try:
            conn.execute(
                text("ALTER TABLE messages ADD COLUMN followup_id INTEGER")
            )
        except Exception:
            pass


def _sqlite_migrate_followup_sent_at() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        try:
            conn.execute(
                text(
                    "ALTER TABLE followups ADD COLUMN sent_at TIMESTAMP"
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
    from models import email_template  # noqa: F401
    from models import followup  # noqa: F401
    from models import lead  # noqa: F401
    from models import message  # noqa: F401
    from models import outbound_email  # noqa: F401
    from models import password_request  # noqa: F401
    from models import password_reset  # noqa: F401
    from models import sent_email  # noqa: F401
    from models import system_log  # noqa: F401
    from models import settings as settings_model  # noqa: F401
    from models import user  # noqa: F401
    from models import workspace  # noqa: F401

    Base.metadata.create_all(bind=engine)
    if settings.database_url.startswith("sqlite"):
        with engine.begin() as conn:
            try:
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_messages_lead_followup "
                        "ON messages (lead_id, followup_id)"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_password_requests_status_id "
                        "ON password_requests (status, id)"
                    )
                )
            except Exception:
                pass
    _ensure_column_if_missing(
        "leads",
        "last_message",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN last_message TEXT",
        postgres_ddl="ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_message TEXT",
    )
    _ensure_column_if_missing(
        "messages",
        "followup_id",
        sqlite_ddl="ALTER TABLE messages ADD COLUMN followup_id INTEGER",
        postgres_ddl="ALTER TABLE messages ADD COLUMN IF NOT EXISTS followup_id INTEGER",
    )
    _ensure_column_if_missing(
        "followups",
        "sent_at",
        sqlite_ddl="ALTER TABLE followups ADD COLUMN sent_at TIMESTAMP",
        postgres_ddl="ALTER TABLE followups ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ",
    )
    _ensure_column_if_missing(
        "workspaces",
        "plan_expires_at",
        sqlite_ddl="ALTER TABLE workspaces ADD COLUMN plan_expires_at TIMESTAMP",
        postgres_ddl="ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ",
    )
    _ensure_column_if_missing(
        "users",
        "display_name",
        sqlite_ddl="ALTER TABLE users ADD COLUMN display_name VARCHAR(120)",
        postgres_ddl="ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(120)",
    )
    _ensure_column_if_missing(
        "users",
        "phone",
        sqlite_ddl="ALTER TABLE users ADD COLUMN phone VARCHAR(64)",
        postgres_ddl="ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(64)",
    )
    _ensure_column_if_missing(
        "users",
        "is_active",
        sqlite_ddl="ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1 NOT NULL",
        postgres_ddl=(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN "
            "NOT NULL DEFAULT true"
        ),
    )
    _sqlite_migrate_admins_display_name()
    _sqlite_migrate_leads_contact()
    _sqlite_migrate_settings_smtp()
    _sqlite_migrate_settings_ollama_model()
    _ensure_column_if_missing(
        "settings",
        "followup_subject_template",
        sqlite_ddl="ALTER TABLE settings ADD COLUMN followup_subject_template VARCHAR(255)",
        postgres_ddl=(
            "ALTER TABLE settings ADD COLUMN IF NOT EXISTS "
            "followup_subject_template VARCHAR(255)"
        ),
    )
    _ensure_column_if_missing(
        "settings",
        "followup_opening_line",
        sqlite_ddl="ALTER TABLE settings ADD COLUMN followup_opening_line VARCHAR(500)",
        postgres_ddl=(
            "ALTER TABLE settings ADD COLUMN IF NOT EXISTS "
            "followup_opening_line VARCHAR(500)"
        ),
    )
    _ensure_column_if_missing(
        "settings",
        "followup_closing_template",
        sqlite_ddl="ALTER TABLE settings ADD COLUMN followup_closing_template TEXT",
        postgres_ddl=(
            "ALTER TABLE settings ADD COLUMN IF NOT EXISTS followup_closing_template TEXT"
        ),
    )
    _ensure_column_if_missing(
        "settings",
        "followup_sender_display_name",
        sqlite_ddl="ALTER TABLE settings ADD COLUMN followup_sender_display_name VARCHAR(120)",
        postgres_ddl=(
            "ALTER TABLE settings ADD COLUMN IF NOT EXISTS "
            "followup_sender_display_name VARCHAR(120)"
        ),
    )
    _sqlite_migrate_users_profile()
    _sqlite_migrate_messages_created_at()
    _sqlite_migrate_followup_failure()
    _sqlite_migrate_lead_last_message()
    _sqlite_migrate_message_followup_id()
    _sqlite_migrate_followup_sent_at()
    _sqlite_migrate_branding_extras()

    from services import admin_service
    from services.template_mail_service import ensure_default_templates

    db = SessionLocal()
    try:
        admin_service.ensure_fixed_workspaces(db)
        ensure_default_templates(db)
    finally:
        db.close()
