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


def _backfill_outbound_emails_owner_user_id() -> None:
    """Attach portal user to legacy outbound rows (per-user Sent mail isolation)."""
    try:
        insp = inspect(engine)
        if "outbound_emails" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("outbound_emails")}
        if "owner_user_id" not in cols:
            return
    except Exception:
        return
    stmts = [
        (
            "UPDATE outbound_emails SET owner_user_id = ("
            "SELECT l.owner_user_id FROM leads l WHERE l.id = outbound_emails.lead_id"
            ") WHERE owner_user_id IS NULL AND lead_id IS NOT NULL"
        ),
        (
            "UPDATE outbound_emails SET owner_user_id = ("
            "SELECT f.scheduled_by_user_id FROM followups f "
            "WHERE f.id = outbound_emails.followup_id"
            ") WHERE owner_user_id IS NULL AND followup_id IS NOT NULL"
        ),
    ]
    for stmt in stmts:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception:
            pass


def _ensure_followup_pending_lead_schedule_unique() -> None:
    """
    Prevent duplicate pending follow-ups for the same lead and scheduled instant (race-safe).
    Normalizes/dedupes existing rows, then adds a partial unique index.
    """
    from services.followup_service import dedupe_and_normalize_pending_followups

    db = SessionLocal()
    try:
        dedupe_and_normalize_pending_followups(db)
    finally:
        db.close()

    idx = (
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_uq_followups_pending_lead_scheduled "
        "ON followups (lead_id, scheduled_at) WHERE status = 'pending'"
    )
    try:
        with engine.begin() as conn:
            conn.execute(text(idx))
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
    from models import user_usage_history  # noqa: F401
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
        "workspaces",
        "plan_expired_email_sent",
        sqlite_ddl=(
            "ALTER TABLE workspaces ADD COLUMN plan_expired_email_sent "
            "INTEGER DEFAULT 0 NOT NULL"
        ),
        postgres_ddl=(
            "ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan_expired_email_sent "
            "BOOLEAN NOT NULL DEFAULT false"
        ),
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
    _ensure_column_if_missing(
        "leads",
        "company",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN company VARCHAR(255)",
        postgres_ddl="ALTER TABLE leads ADD COLUMN IF NOT EXISTS company VARCHAR(255)",
    )
    _ensure_column_if_missing(
        "leads",
        "temperature_tag",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN temperature_tag VARCHAR(16)",
        postgres_ddl="ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperature_tag VARCHAR(16)",
    )
    _ensure_column_if_missing(
        "leads",
        "owner_user_id",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN owner_user_id INTEGER",
        postgres_ddl=(
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_user_id INTEGER "
            "REFERENCES users(id) ON DELETE SET NULL"
        ),
    )
    _ensure_column_if_missing(
        "leads",
        "created_at",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN created_at TIMESTAMP",
        postgres_ddl=(
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ"
        ),
    )
    _ensure_column_if_missing(
        "leads",
        "role_title",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN role_title VARCHAR(255)",
        postgres_ddl="ALTER TABLE leads ADD COLUMN IF NOT EXISTS role_title VARCHAR(255)",
    )
    _ensure_column_if_missing(
        "leads",
        "profile_link",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN profile_link VARCHAR(512)",
        postgres_ddl="ALTER TABLE leads ADD COLUMN IF NOT EXISTS profile_link VARCHAR(512)",
    )
    _ensure_column_if_missing(
        "leads",
        "agency_type",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN agency_type VARCHAR(128)",
        postgres_ddl="ALTER TABLE leads ADD COLUMN IF NOT EXISTS agency_type VARCHAR(128)",
    )
    _ensure_column_if_missing(
        "leads",
        "team_size_estimate",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN team_size_estimate VARCHAR(64)",
        postgres_ddl="ALTER TABLE leads ADD COLUMN IF NOT EXISTS team_size_estimate VARCHAR(64)",
    )
    _ensure_column_if_missing(
        "leads",
        "problem_seen",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN problem_seen TEXT",
        postgres_ddl="ALTER TABLE leads ADD COLUMN IF NOT EXISTS problem_seen TEXT",
    )
    _ensure_column_if_missing(
        "leads",
        "last_active_display",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN last_active_display VARCHAR(128)",
        postgres_ddl=(
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_active_display VARCHAR(128)"
        ),
    )
    _ensure_column_if_missing(
        "leads",
        "connection_sent_date",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN connection_sent_date VARCHAR(128)",
        postgres_ddl=(
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS connection_sent_date VARCHAR(128)"
        ),
    )
    _ensure_column_if_missing(
        "leads",
        "replied_y_n",
        sqlite_ddl="ALTER TABLE leads ADD COLUMN replied_y_n VARCHAR(8)",
        postgres_ddl="ALTER TABLE leads ADD COLUMN IF NOT EXISTS replied_y_n VARCHAR(8)",
    )
    _ensure_column_if_missing(
        "followups",
        "followup_type",
        sqlite_ddl="ALTER TABLE followups ADD COLUMN followup_type VARCHAR(16) DEFAULT 'normal' NOT NULL",
        postgres_ddl=(
            "ALTER TABLE followups ADD COLUMN IF NOT EXISTS followup_type VARCHAR(16) "
            "DEFAULT 'normal' NOT NULL"
        ),
    )
    _ensure_column_if_missing(
        "settings",
        "dashboard_manual_replies",
        sqlite_ddl=(
            "ALTER TABLE settings ADD COLUMN dashboard_manual_replies INTEGER DEFAULT 0 NOT NULL"
        ),
        postgres_ddl=(
            "ALTER TABLE settings ADD COLUMN IF NOT EXISTS dashboard_manual_replies "
            "INTEGER NOT NULL DEFAULT 0"
        ),
    )
    _ensure_column_if_missing(
        "settings",
        "dashboard_manual_conversions",
        sqlite_ddl=(
            "ALTER TABLE settings ADD COLUMN dashboard_manual_conversions INTEGER DEFAULT 0 NOT NULL"
        ),
        postgres_ddl=(
            "ALTER TABLE settings ADD COLUMN IF NOT EXISTS dashboard_manual_conversions "
            "INTEGER NOT NULL DEFAULT 0"
        ),
    )
    _ensure_column_if_missing(
        "settings",
        "usage_email_90_sent",
        sqlite_ddl=(
            "ALTER TABLE settings ADD COLUMN usage_email_90_sent INTEGER DEFAULT 0 NOT NULL"
        ),
        postgres_ddl=(
            "ALTER TABLE settings ADD COLUMN IF NOT EXISTS usage_email_90_sent "
            "BOOLEAN NOT NULL DEFAULT false"
        ),
    )
    _ensure_column_if_missing(
        "settings",
        "usage_email_limit_sent",
        sqlite_ddl=(
            "ALTER TABLE settings ADD COLUMN usage_email_limit_sent INTEGER DEFAULT 0 NOT NULL"
        ),
        postgres_ddl=(
            "ALTER TABLE settings ADD COLUMN IF NOT EXISTS usage_email_limit_sent "
            "BOOLEAN NOT NULL DEFAULT false"
        ),
    )
    _ensure_column_if_missing(
        "users",
        "ai_message_limit",
        sqlite_ddl="ALTER TABLE users ADD COLUMN ai_message_limit INTEGER",
        postgres_ddl="ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_message_limit INTEGER",
    )
    _ensure_column_if_missing(
        "users",
        "usage_email_90_sent",
        sqlite_ddl=(
            "ALTER TABLE users ADD COLUMN usage_email_90_sent INTEGER DEFAULT 0 NOT NULL"
        ),
        postgres_ddl=(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_email_90_sent "
            "BOOLEAN NOT NULL DEFAULT false"
        ),
    )
    _ensure_column_if_missing(
        "users",
        "usage_email_limit_sent",
        sqlite_ddl=(
            "ALTER TABLE users ADD COLUMN usage_email_limit_sent INTEGER DEFAULT 0 NOT NULL"
        ),
        postgres_ddl=(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_email_limit_sent "
            "BOOLEAN NOT NULL DEFAULT false"
        ),
    )
    _ensure_column_if_missing(
        "users",
        "dashboard_manual_replies",
        sqlite_ddl=(
            "ALTER TABLE users ADD COLUMN dashboard_manual_replies INTEGER DEFAULT 0 NOT NULL"
        ),
        postgres_ddl=(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_manual_replies "
            "INTEGER NOT NULL DEFAULT 0"
        ),
    )
    _ensure_column_if_missing(
        "users",
        "dashboard_manual_conversions",
        sqlite_ddl=(
            "ALTER TABLE users ADD COLUMN dashboard_manual_conversions INTEGER DEFAULT 0 NOT NULL"
        ),
        postgres_ddl=(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_manual_conversions "
            "INTEGER NOT NULL DEFAULT 0"
        ),
    )
    _ensure_column_if_missing(
        "followups",
        "scheduled_by_user_id",
        sqlite_ddl="ALTER TABLE followups ADD COLUMN scheduled_by_user_id INTEGER",
        postgres_ddl=(
            "ALTER TABLE followups ADD COLUMN IF NOT EXISTS scheduled_by_user_id INTEGER"
        ),
    )
    _ensure_column_if_missing(
        "messages",
        "created_by_user_id",
        sqlite_ddl="ALTER TABLE messages ADD COLUMN created_by_user_id INTEGER",
        postgres_ddl=(
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER"
        ),
    )
    _ensure_column_if_missing(
        "outbound_emails",
        "owner_user_id",
        sqlite_ddl="ALTER TABLE outbound_emails ADD COLUMN owner_user_id INTEGER",
        postgres_ddl=(
            "ALTER TABLE outbound_emails ADD COLUMN IF NOT EXISTS owner_user_id INTEGER"
        ),
    )
    if settings.database_url.startswith("sqlite"):
        with engine.begin() as conn:
            try:
                conn.execute(
                    text(
                        "UPDATE leads SET created_at = CURRENT_TIMESTAMP "
                        "WHERE created_at IS NULL"
                    )
                )
            except Exception:
                pass
    else:
        with engine.begin() as conn:
            try:
                conn.execute(
                    text(
                        "UPDATE leads SET created_at = NOW() AT TIME ZONE 'utc' "
                        "WHERE created_at IS NULL"
                    )
                )
            except Exception:
                pass

    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE followups SET followup_type = 'normal' "
                    "WHERE followup_type IS NULL OR TRIM(followup_type) = ''"
                )
            )
    except Exception:
        pass

    _ensure_followup_pending_lead_schedule_unique()

    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE leads SET owner_user_id = ("
                    "SELECT MIN(u.id) FROM users u WHERE u.workspace_id = leads.workspace_id "
                    "AND u.is_active = 1"
                    ") WHERE owner_user_id IS NULL AND ("
                    "SELECT COUNT(*) FROM users u2 WHERE u2.workspace_id = leads.workspace_id "
                    "AND u2.is_active = 1"
                    ") = 1"
                )
            )
    except Exception:
        pass

    _backfill_outbound_emails_owner_user_id()

    from services import admin_service
    from services.template_mail_service import ensure_default_templates

    db = SessionLocal()
    try:
        admin_service.ensure_fixed_workspaces(db)
        ensure_default_templates(db)
    finally:
        db.close()
