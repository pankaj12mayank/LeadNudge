"""User-facing SMTP error messages (Gmail, etc.)."""


def format_smtp_error(exc: BaseException) -> str:
    raw = str(exc).strip()
    low = raw.lower()

    if "534" in raw or "application-specific password" in low or "invalidsecondfactor" in low:
        return (
            "Gmail blocked sign-in: use an App Password, not your normal password. "
            "Google Account → Security → 2-Step Verification → App passwords → "
            "create one for “Mail”, then paste it here. "
            "Also use smtp.gmail.com, port 587."
        )

    if "535" in raw and "authentication failed" in low:
        return (
            "SMTP username or password was rejected. For Gmail use your full email "
            "as the username and an App Password if 2FA is on."
        )

    if "gmail" in low and "less secure" in low:
        return "Gmail no longer supports “less secure apps”. Use an App Password instead."

    return raw or "SMTP connection failed"
