import smtplib
import ssl
from email.message import EmailMessage

from models.branding import AppBranding


def mail_configured(b: AppBranding) -> bool:
    return bool(
        (b.mail_smtp_host or "").strip()
        and b.mail_smtp_port
        and (b.mail_smtp_email or "").strip()
    )


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

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to_addr.strip()
    msg.set_content(body)

    context = ssl.create_default_context()
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
