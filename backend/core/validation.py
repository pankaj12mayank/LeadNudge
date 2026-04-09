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
