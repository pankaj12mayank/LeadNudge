"""DB-backed email templates + SMTP send via AppBranding transactional mail."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from models.email_template import EmailTemplate
from services import branding_service, system_log_service
from services.transactional_mail import mail_configured, send_plain_email

# Stable keys used in code triggers (admin UI edits subject/body).
TEMPLATE_ACCOUNT_CREATED = "account_created"
TEMPLATE_ACCOUNT_DELETED = "account_deleted"
TEMPLATE_ACCOUNT_ACTIVATED = "account_activated"
TEMPLATE_ACCOUNT_DEACTIVATED = "account_deactivated"
TEMPLATE_PASSWORD_CHANGED = "password_changed"
TEMPLATE_USAGE_LIMIT_REACHED = "usage_limit_reached"
TEMPLATE_USAGE_WARNING_90 = "usage_warning_90"
TEMPLATE_PLAN_EXPIRED = "plan_expired"
TEMPLATE_PASSWORD_REQUEST_RECEIVED = "password_request_received"

# Human-readable catalog for admin UI (key → title, when it fires).
EMAIL_TRIGGER_CATALOG: list[tuple[str, str, str]] = [
    (
        TEMPLATE_ACCOUNT_CREATED,
        "Account created",
        "When an admin creates a new user and a temporary password is set.",
    ),
    (
        TEMPLATE_ACCOUNT_DELETED,
        "Account deleted",
        "When a user account is removed from the workspace.",
    ),
    (
        TEMPLATE_ACCOUNT_ACTIVATED,
        "Account activated",
        "When a deactivated user is activated again.",
    ),
    (
        TEMPLATE_ACCOUNT_DEACTIVATED,
        "Account deactivated",
        "When an admin pauses a user’s sign-in access.",
    ),
    (
        TEMPLATE_PASSWORD_CHANGED,
        "Password set / changed",
        "When an admin sets a new password for a user (e.g. Set password & notify).",
    ),
    (
        TEMPLATE_USAGE_WARNING_90,
        "Usage warning",
        "When a workspace reaches about 90% of its AI message allowance (once per cycle).",
    ),
    (
        TEMPLATE_USAGE_LIMIT_REACHED,
        "AI usage limit reached",
        "When a workspace hits its AI message cap (scheduling new AI follow-ups stops until admin raises the limit).",
    ),
    (
        TEMPLATE_PLAN_EXPIRED,
        "Plan expired",
        "When a workspace plan end date has passed.",
    ),
    (
        TEMPLATE_PASSWORD_REQUEST_RECEIVED,
        "Password help request",
        "When a user submits “request password help” on the login page.",
    ),
]

EMAIL_TRIGGER_KEYS: frozenset[str] = frozenset(k for k, _, _ in EMAIL_TRIGGER_CATALOG)

_DEFAULT_SUBJECTS_BODIES: list[tuple[str, str, str]] = [
    (
        TEMPLATE_ACCOUNT_CREATED,
        "Welcome to {{project_name}}",
        "<p>Hi {{name}},</p><p>Your account is ready. Sign in with <strong>{{email}}</strong> and this "
        "temporary password: <strong>{{password}}</strong></p>"
        "<p>Change your password from Profile after you sign in.</p>"
        "<p>Regards,<br/>{{project_name}}</p>",
    ),
    (
        TEMPLATE_ACCOUNT_DELETED,
        "Your account was removed",
        "<p>Hi {{name}},</p><p>Your account ({{email}}) has been deleted from {{project_name}}.</p>",
    ),
    (
        TEMPLATE_ACCOUNT_ACTIVATED,
        "Your account is active",
        "<p>Hi {{name}},</p><p>Your sign-in for {{email}} has been activated again.</p>",
    ),
    (
        TEMPLATE_ACCOUNT_DEACTIVATED,
        "Your account access is paused",
        "<p>Hi {{name}},</p><p>Sign-in for {{email}} has been deactivated. Contact your administrator if this is unexpected.</p>",
    ),
    (
        TEMPLATE_PASSWORD_CHANGED,
        "Your new password",
        "<p>Hi {{name}},</p><p>An administrator set a new password for your account.</p>"
        "<p><strong>New password:</strong> {{password}}</p>"
        "<p>Sign in with your email {{email}}, then change your password from Profile if you like.</p>",
    ),
    (
        TEMPLATE_USAGE_WARNING_90,
        "Approaching your AI message limit",
        "<p>Hi {{name}},</p>"
        "<p>Your workspace has used about <strong>{{usage_percent}}%</strong> of its AI message "
        "allowance (<strong>{{used}}</strong> of <strong>{{limit}}</strong> messages).</p>"
        "<p>Please contact your administrator soon so they can raise the limit if you need to keep "
        "scheduling AI follow-ups.</p>"
        "<p>— {{project_name}}</p>",
    ),
    (
        TEMPLATE_USAGE_LIMIT_REACHED,
        "AI message quota exhausted",
        "<p>Hi {{name}},</p>"
        "<p>Your workspace has reached its AI message limit (<strong>{{used}}</strong> of "
        "<strong>{{limit}}</strong> used). <strong>New AI follow-ups cannot be scheduled or "
        "generated</strong> until your administrator increases the workspace limit under "
        "Admin → AI setup.</p>"
        "<p>Please contact your administrator to upgrade or extend your monthly allowance.</p>"
        "<p>— {{project_name}}</p>",
    ),
    (
        TEMPLATE_PLAN_EXPIRED,
        "Your plan has expired",
        "<p>Hi {{name}},</p><p>Your workspace plan for {{email}} has expired. Contact your administrator to renew access.</p>",
    ),
    (
        TEMPLATE_PASSWORD_REQUEST_RECEIVED,
        "We received your password help request",
        "<p>Hi {{name}},</p><p>We received a request to help with sign-in for <strong>{{email}}</strong>.</p>"
        "<p>An administrator will set a new password and notify you. If you did not ask for this, you can ignore this message.</p>"
        "<p>— {{project_name}}</p>",
    ),
]


def ensure_default_templates(db: Session) -> None:
    for name, subject, body in _DEFAULT_SUBJECTS_BODIES:
        row = db.query(EmailTemplate).filter(EmailTemplate.name == name).first()
        if row:
            continue
        db.add(EmailTemplate(name=name, subject=subject, body=body))
    db.commit()


def render_placeholders(text: str, variables: dict[str, Any]) -> str:
    out = text or ""
    merged = dict(variables)
    if "user_name" not in merged and merged.get("name") is not None:
        merged["user_name"] = merged["name"]
    if "name" not in merged and merged.get("user_name") is not None:
        merged["name"] = merged["user_name"]
    for key, val in merged.items():
        if key is None:
            continue
        repl = "" if val is None else str(val)
        out = out.replace("{{" + str(key) + "}}", repl)
    return out


def _strip_unresolved(t: str) -> str:
    return re.sub(r"\{\{[^}]+\}\}", "", t or "")


def get_template(db: Session, name: str) -> EmailTemplate | None:
    return db.query(EmailTemplate).filter(EmailTemplate.name == name).first()


def list_templates(db: Session) -> list[EmailTemplate]:
    """List rows as stored; defaults are inserted on app init, not on every list."""
    return db.query(EmailTemplate).order_by(EmailTemplate.name).all()


def list_trigger_definitions(db: Session) -> list[dict[str, str | bool]]:
    """All known triggers and whether a row exists (after delete, has_template is False)."""
    existing = {t.name for t in db.query(EmailTemplate).all()}
    out: list[dict[str, str | bool]] = []
    for key, label, desc in EMAIL_TRIGGER_CATALOG:
        out.append(
            {
                "key": key,
                "label": label,
                "description": desc,
                "has_template": key in existing,
            }
        )
    return out


def create_template(db: Session, name: str, *, subject: str, body: str) -> EmailTemplate:
    key = (name or "").strip()
    if key not in EMAIL_TRIGGER_KEYS:
        raise ValueError("Invalid or unsupported trigger key")
    if get_template(db, key):
        raise ValueError("A template for this trigger already exists")
    row = EmailTemplate(
        name=key,
        subject=(subject or "").strip() or "Notification",
        body=body if body is not None else "<p></p>",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_template(db: Session, name: str) -> None:
    key = (name or "").strip()
    if key not in EMAIL_TRIGGER_KEYS:
        raise ValueError("Unknown trigger key")
    row = get_template(db, key)
    if not row:
        raise ValueError("Template not found")
    db.delete(row)
    db.commit()


def update_template(
    db: Session, name: str, *, subject: str, body: str
) -> EmailTemplate:
    row = get_template(db, name)
    if not row:
        raise ValueError(f"Unknown template: {name}")
    row.subject = (subject or "").strip() or row.subject
    row.body = body if body is not None else row.body
    db.commit()
    db.refresh(row)
    return row


def send_template_email(
    db: Session,
    template_key: str,
    to_email: str,
    variables: dict[str, Any],
) -> None:
    t = get_template(db, template_key)
    if not t:
        raise ValueError(f"Missing template {template_key}")
    b = branding_service.get_or_create_branding(db)
    if not mail_configured(b):
        raise ValueError("Transactional SMTP is not configured (Admin → Account & branding).")
    merged = dict(variables)
    merged.setdefault("project_name", (b.project_name or "").strip() or "Workspace")
    subj = _strip_unresolved(render_placeholders(t.subject, merged)).strip() or "Notification"
    body = render_placeholders(t.body, merged)
    to_clean = (to_email or "").strip()
    send_plain_email(
        b,
        to_addr=to_clean,
        subject=subj,
        body=body,
    )
    try:
        system_log_service.log_event(
            db,
            kind="EMAIL",
            message=f"Template OK key={template_key} to={to_clean} subj={subj[:80]!r}",
        )
    except Exception:
        pass


def try_send_template(
    db: Session,
    template_key: str,
    to_email: str,
    variables: dict[str, Any],
) -> None:
    to_clean = (to_email or "").strip()
    if not to_clean:
        return
    try:
        send_template_email(db, template_key, to_clean, variables)
    except Exception as e:
        try:
            system_log_service.log_event(
                db,
                kind="EMAIL",
                message=(
                    f"Template FAIL key={template_key} to={to_clean}: {e!s}. "
                    "Check Admin → Account & branding SMTP."
                )[:8000],
            )
        except Exception:
            pass


def project_variables(db: Session) -> dict[str, str]:
    b = branding_service.get_or_create_branding(db)
    return {
        "project_name": (b.project_name or "").strip() or "Workspace",
    }
