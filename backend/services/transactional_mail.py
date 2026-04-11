import re
import smtplib
import ssl
from email.message import EmailMessage
from html import unescape

from models.branding import AppBranding
from services.email_service import log_smtp_event


def mail_configured(b: AppBranding) -> bool:
    return bool(
        (b.mail_smtp_host or "").strip()
        and b.mail_smtp_port
        and (b.mail_smtp_email or "").strip()
    )


def _looks_html(body: str) -> bool:
    t = (body or "").strip()
    if not t.startswith("<"):
        return False
    low = t.lower()
    return "<html" in low or "<p" in low or "<div" in low or "<br" in low


def _html_to_plain(html_body: str) -> str:
    t = re.sub(r"<br\s*/?>", "\n", html_body, flags=re.I)
    t = re.sub(r"</p>", "\n\n", t, flags=re.I)
    t = re.sub(r"</div>", "\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    return unescape(t).strip()


def send_plain_email(
    b: AppBranding,
    *,
    to_addr: str,
    subject: str,
    body: str,
) -> None:
    host = (b.mail_smtp_host or "").strip()
    port = b.mail_smtp_port
    user = (b.mail_smtp_email or "").strip()
    password = b.mail_smtp_password or ""
    if not host or port is None or not user:
        raise ValueError("Mail SMTP is not configured")

    to_clean = to_addr.strip()
    msg = EmailMessage()
    msg["Subject"] = (subject or "").strip() or "(no subject)"
    msg["From"] = user
    msg["To"] = to_clean

    raw_body = body or ""
    if _looks_html(raw_body):
        plain = _html_to_plain(raw_body) or (
            "You have a password reset message. Please open this email in an HTML-capable client."
        )
        msg.set_content(plain)
        msg.add_alternative(raw_body.strip(), subtype="html")
    else:
        msg.set_content(raw_body)

    context = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, int(port), timeout=30, context=context) as smtp:
                smtp.login(user, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, int(port), timeout=30) as smtp:
                smtp.ehlo()
                if smtp.has_extn("STARTTLS"):
                    smtp.starttls(context=context)
                    smtp.ehlo()
                if password:
                    smtp.login(user, password)
                smtp.send_message(msg)
        log_smtp_event(f"transactional_email sent host={host} to={to_clean}")
        try:
            from services.sent_email_log import append_sent_email

            plain_for_log = _html_to_plain(raw_body) if _looks_html(raw_body) else raw_body
            append_sent_email(
                workspace_id=None,
                to_email=to_clean,
                subject=subject.strip(),
                body=plain_for_log[:50000],
                status="sent",
            )
        except Exception:
            pass
    except Exception as e:
        log_smtp_event(
            f"transactional_email FAILED host={host} port={port} to={to_clean}",
            exc=e,
        )
        try:
            from services.sent_email_log import append_sent_email
            from services.system_log_service import log_event
            from db.session import SessionLocal

            plain_for_log = _html_to_plain(raw_body) if _looks_html(raw_body) else raw_body
            append_sent_email(
                workspace_id=None,
                to_email=to_clean,
                subject=subject.strip(),
                body=plain_for_log[:50000],
                status="failed",
            )
            ldb = SessionLocal()
            try:
                log_event(
                    ldb,
                    kind="EMAIL",
                    message=f"Transactional SMTP failed to={to_clean}: {e!s}"[:8000],
                )
            finally:
                ldb.close()
        except Exception:
            pass
        raise
