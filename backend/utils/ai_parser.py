"""Helpers for Ollama HTTP JSON (generate + chat, non-streaming)."""

import json
from typing import Any


def clean_text(text: str | None) -> str:
    """Remove NUL bytes and trim (avoids JSON / transport glitches)."""
    if text is None:
        return ""
    return str(text).replace("\x00", "").strip()


def extract_ollama_completion(data: Any) -> str | None:
    """
    Parse Ollama JSON from POST /api/generate or /api/chat (stream: false).

    Handles:
    - Standard generate: top-level "response" string
    - Chat shape: message.content (some models / proxies)
    - Rare: list of partial objects (take last non-empty response fragment)
    """
    if data is None:
        return None
    if isinstance(data, list):
        parts: list[str] = []
        for item in data:
            t = extract_ollama_completion(item)
            if t:
                parts.append(t)
        merged = "\n".join(parts).strip()
        return merged or None
    if not isinstance(data, dict):
        return None
    err = data.get("error")
    if err:
        return None
    r = data.get("response")
    if r is not None:
        t = clean_text(str(r))
        if t:
            return t
    msg = data.get("message")
    if isinstance(msg, dict):
        c = msg.get("content")
        if c is not None:
            t = clean_text(str(c))
            if t:
                return t
    if isinstance(msg, str):
        t = clean_text(msg)
        if t:
            return t
    return None


def safe_parse(data: dict | None) -> str | None:
    """Backward-compatible alias for dict-only callers."""
    return extract_ollama_completion(data)


def parse_ollama_response_body(raw: bytes) -> Any | None:
    """
    Prefer a single JSON value; if body is NDJSON (multiple lines), merge parse attempts.
    """
    cleaned = (raw or b"").replace(b"\x00", b"")
    if not cleaned.strip():
        return None
    try:
        return json.loads(cleaned.decode("utf-8", errors="replace"))
    except json.JSONDecodeError:
        pass
    objs: list[Any] = []
    for line in cleaned.split(b"\n"):
        line = line.strip()
        if not line:
            continue
        try:
            objs.append(json.loads(line.decode("utf-8", errors="replace")))
        except json.JSONDecodeError:
            continue
    if not objs:
        return None
    if len(objs) == 1:
        return objs[0]
    return objs
