import html
import logging
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from core.paths import BACKEND_ROOT
from models.lead import Lead
from models.settings import WorkspaceSettings
from utils.logger import get_logger

log = get_logger("email")


def _followup_template_vars(lead: Lead, settings_row: WorkspaceSettings) -> dict[str, str]:
    sender = (settings_row.followup_sender_display_name or "").strip()
    if not sender:
        em = (settings_row.smtp_email or "").strip()
        sender = em.split("@")[0].replace(".", " ").title() if em else "Team"
    smtp_em = (settings_row.smtp_email or "").strip()
    return {
        "lead_name": ((lead.name or "").strip() or "there"),
        "lead_email": (lead.email or "").strip(),
        "sender_name": sender,
        "sender_email": smtp_em,
    }


def _apply_followup_placeholders(template: str, vars_map: dict[str, str]) -> str:
    """Replace {{key}} and common {key} typos."""
    out = template
    for key, val in vars_map.items():
        out = out.replace("{{" + key + "}}", val)
        out = out.replace("{" + key + "}", val)
    return out

_EMAIL_LOG_PATH = BACKEND_ROOT / "logs" / "email.log"
_file_log = logging.getLogger("ais.email_file")


def _setup_email_file_log() -> None:
    if _file_log.handlers:
        return
    _EMAIL_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(_EMAIL_LOG_PATH, encoding="utf-8")
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    _file_log.addHandler(handler)
    _file_log.setLevel(logging.INFO)


def log_smtp_event(message: str, exc: BaseException | None = None) -> None:
    """Append SMTP-related events to logs/email.log (under backend/)."""
    _setup_email_file_log()
    if exc is not None:
        _file_log.exception("%s", message)
    else:
        _file_log.info("%s", message)


# Strip common AI-ish markers and emoji from outbound mail
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F9FF"
    "\u2600-\u26FF"
    "\u2700-\u27BF"
    "]+",
    flags=re.UNICODE,
)


def _sanitize_ai_middle(text: str) -> str:
    """Strip emoji; trim whitespace. Preserve **phrase** for HTML bold in the MIME HTML part."""
    t = _EMOJI_RE.sub("", text)
    lines = [ln.rstrip() for ln in t.splitlines()]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines).strip()


def _strip_bold_markers_for_plain_mime(text: str) -> str:
    """Plain-text alternative: show emphasized words without asterisks."""
    return re.sub(r"\*\*([^*]+)\*\*", r"\1", text)


def _line_with_bold_html(line: str) -> str:
    """Escape a line; segments wrapped in **double asterisks** become <strong>."""
    if "**" not in line:
        return html.escape(line)
    parts = re.split(r"(\*\*[^*]+\*\*)", line)
    out: list[str] = []
    for p in parts:
        if not p:
            continue
        if len(p) >= 4 and p.startswith("**") and p.endswith("**"):
            inner = p[2:-2]
            out.append(
                f'<strong style="font-weight:600;">{html.escape(inner)}</strong>'
            )
        else:
            out.append(html.escape(p))
    return "".join(out)


def _plain_body_to_html_fragment(plain: str) -> str:
    blocks = [b.strip() for b in plain.split("\n\n") if b.strip()]
    if not blocks:
        t = _line_with_bold_html(plain.strip() or " ")
        return f'<p style="margin:0 0 1em 0;">{t}</p>'
    parts: list[str] = []
    for b in blocks:
        inner = "<br/>".join(_line_with_bold_html(ln) for ln in b.split("\n"))
        parts.append(f'<p style="margin:0 0 1em 0;">{inner}</p>')
    return "".join(parts)


def workspace_smtp_ready(settings_row: WorkspaceSettings) -> bool:
    """True when host, port, and sender email are set (password optional for some relays)."""
    host = (settings_row.smtp_host or "").strip()
    port = settings_row.smtp_port
    user = (settings_row.smtp_email or "").strip()
    return bool(host and port is not None and user)


def build_followup_html(body_plain: str) -> str:
    """Readable HTML wrapper; plain body already includes greeting + signature."""
    inner = _plain_body_to_html_fragment(body_plain)
    return (
        "<!DOCTYPE html><html><body "
        'style="margin:0;padding:24px;background:#f6f6f6;">'
        '<div style="max-width:560px;margin:0 auto;background:#ffffff;'
        "padding:28px 32px;border-radius:8px;"
        'border:1px solid #e5e5e5;font-family:Georgia,\"Times New Roman\",serif;'
        'font-size:16px;line-height:1.55;color:#1a1a1a;">'
        f"{inner}"
        "</div></body></html>"
    )


def format_followup_email(
    lead: Lead,
    ai_message: str,
    settings_row: WorkspaceSettings,
) -> tuple[str, str]:
    vm = _followup_template_vars(lead, settings_row)
    subj_tpl = (settings_row.followup_subject_template or "").strip()
    if not subj_tpl:
        subj_tpl = "Following up — {{lead_name}}"
    subject = _apply_followup_placeholders(subj_tpl, vm).strip() or (
        f"Following up — {vm['lead_name']}"
    )

    opening_tpl = (settings_row.followup_opening_line or "").strip()
    if not opening_tpl:
        opening_tpl = "Hi {{lead_name}},"
    opening = _apply_followup_placeholders(opening_tpl, vm).strip()

    closing_tpl = (settings_row.followup_closing_template or "").strip()
    if not closing_tpl:
        closing_tpl = "Best regards,\n{{sender_name}}"
    closing = _apply_followup_placeholders(closing_tpl, vm).strip()
    # If the user saved a display name but did not use {{sender_name}} in the closing, append it
    # so the sign-off still shows (common expectation from the "Your name" field).
    sn = (vm.get("sender_name") or "").strip()
    if sn:
        has_ph = "{{sender_name}}" in closing_tpl or "{sender_name}" in closing_tpl
        if not has_ph and sn.lower() not in closing.lower():
            closing = f"{closing}\n\n{sn}".strip()

    body_mid = _sanitize_ai_middle(ai_message)
    if not body_mid:
        body_mid = (
            "I wanted to follow up and see if you had any questions or a good time to reconnect."
        )

    body_plain = f"{opening}\n\n{body_mid}\n\n{closing}".strip()
    return subject, body_plain


def followup_plain_text_for_mime(full_body_plain: str) -> str:
    """Use for EmailMessage.set_content so text/plain has no ** markers."""
    return _strip_bold_markers_for_plain_mime(full_body_plain)


def send_followup_email(
    settings_row: WorkspaceSettings,
    lead: Lead,
    subject: str,
    body_plain: str,
) -> None:
    host = (settings_row.smtp_host or "").strip()
    port = settings_row.smtp_port
    user = (settings_row.smtp_email or "").strip()
    password = settings_row.smtp_password or ""

    if not host or port is None or not user:
        log.debug("SMTP not configured; skip send")
        return

    to_addr = (lead.email or "").strip()
    if not to_addr:
        log.warning("Lead has no email; skip send")
        return

    display = (settings_row.followup_sender_display_name or "").strip()
    if not display:
        display = user.split("@")[0].replace(".", " ").title() if user else "Team"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((display, user))
    msg["To"] = to_addr
    msg.set_content(followup_plain_text_for_mime(body_plain))
    msg.add_alternative(
        build_followup_html(body_plain),
        subtype="html",
    )

    context = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=30, context=context) as smtp:
                smtp.login(user, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                smtp.ehlo()
                if smtp.has_extn("STARTTLS"):
                    smtp.starttls(context=context)
                    smtp.ehlo()
                if password:
                    smtp.login(user, password)
                smtp.send_message(msg)
        log_smtp_event(f"followup_email sent host={host} to={to_addr}")
        try:
            from services.sent_email_log import append_sent_email

            append_sent_email(
                workspace_id=settings_row.workspace_id,
                to_email=to_addr,
                subject=subject,
                body=body_plain,
                status="sent",
            )
        except Exception:
            pass
    except Exception as e:
        log_smtp_event(
            f"followup_email FAILED host={host} port={port} to={to_addr}",
            exc=e,
        )
        try:
            from services.sent_email_log import append_sent_email
            from services.system_log_service import log_event
            from db.session import SessionLocal

            append_sent_email(
                workspace_id=settings_row.workspace_id,
                to_email=to_addr,
                subject=subject,
                body=body_plain,
                status="failed",
            )
            ldb = SessionLocal()
            try:
                log_event(
                    ldb,
                    kind="EMAIL",
                    message=f"Follow-up SMTP failed to={to_addr}: {e!s}"[:8000],
                )
            finally:
                ldb.close()
        except Exception:
            pass
        raise
