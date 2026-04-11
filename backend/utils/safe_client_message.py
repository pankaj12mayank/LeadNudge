"""Sanitize strings returned to authenticated admin UIs (no secrets; bounded length)."""


def safe_client_detail(text: str | None, *, max_len: int = 800) -> str:
    if not text:
        return "Unknown error."
    s = "".join(ch for ch in str(text) if ord(ch) >= 32 or ch in "\n\r\t")
    s = s.replace("\x00", "")
    s = s.strip()
    if len(s) > max_len:
        return s[: max_len - 1] + "…"
    return s or "Unknown error."
