import re
import smtplib
import ssl
from email.message import EmailMessage

from models.lead import Lead
from models.settings import WorkspaceSettings
from utils.logger import get_logger

log = get_logger("email")

# Strip common AI-ish markers and emoji from outbound mail
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F9FF"
    "\u2600-\u26FF"
    "\u2700-\u27BF"
    "]+",
    flags=re.UNICODE,
)


def _clean_body(text: str) -> str:
    t = _EMOJI_RE.sub("", text)
    t = re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", t)
    lines = [ln.rstrip() for ln in t.splitlines()]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines).strip()


def format_followup_email(lead: Lead, ai_message: str) -> tuple[str, str]:
    subject = f"Follow-up — {lead.name}"
    body = _clean_body(ai_message)
    if not body:
        body = (
            f"Hello {lead.name},\n\n"
            "I wanted to follow up with you. Please let me know a convenient time to connect.\n\n"
            "Best regards"
        )
    return subject, body


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

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to_addr
    msg.set_content(body_plain)

    context = ssl.create_default_context()
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
