import re

# E.164-ish or common national formats (digits, spaces, dashes, parens, leading +)
_PHONE_RE = re.compile(r"^\+?[0-9][0-9\s\-().]{5,24}$")


def is_valid_phone(value: str | None) -> bool:
    if value is None or value == "":
        return True
    s = value.strip()
    if not s:
        return True
    return bool(_PHONE_RE.match(s))


def normalize_country_code(value: str | None) -> str | None:
    if value is None:
        return None
    s = value.strip().upper()
    if not s:
        return None
    if len(s) == 2 and s.isalpha():
        return s
    if s.startswith("+") and s[1:].isdigit() and 1 <= len(s) <= 5:
        return s
    return s


def is_csv_phone_numeric(phone: str | None) -> bool:
    """CSV import: national number must be numeric (digits only after stripping separators)."""
    if phone is None:
        return False
    raw = phone.strip()
    if not raw:
        return False
    compact = re.sub(r"\D", "", raw)
    return compact.isdigit() and len(compact) >= 6


def is_valid_import_country_code(value: str | None) -> bool:
    """Require a non-empty country code (+digits or ISO alpha-2)."""
    if value is None or not str(value).strip():
        return False
    n = normalize_country_code(value)
    if not n:
        return False
    if len(n) == 2 and n.isalpha():
        return True
    if n.startswith("+") and n[1:].isdigit() and 2 <= len(n) <= 5:
        return True
    return False
