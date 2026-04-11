import json

import httpx

from core.config import settings
from utils.logger import get_logger
from utils.safe_client_message import safe_client_detail

log = get_logger("ai_router")


def _sanitize_model_name(model: str | None) -> str:
    s = (model or "").strip()
    s = "".join(ch for ch in s if ord(ch) >= 32)
    s = s.strip()
    return s or "llama3.2:latest"


def resolve_ollama_model(model: str | None) -> str:
    return _sanitize_model_name(model or settings.ollama_model or "llama3.2:latest")


def _sanitize_ollama_text(text: str | None) -> str:
    """Strip NUL/control chars Ollama's JSON decoder rejects (often from DB / imports)."""
    s = (text or "").strip()
    return "".join(ch for ch in s if ord(ch) >= 32 or ch in "\n\r\t")


def _parse_ollama_json_body(r: httpx.Response) -> dict | None:
    """Ollama should return one JSON object; tolerate NUL/BOM, NDJSON lines, minor garbage."""
    raw = (r.content or b"").replace(b"\x00", b"")
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    try:
        if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
            text = raw.decode("utf-16", errors="replace")
        else:
            text = raw.decode("utf-8", errors="replace")
    except Exception:
        return None
    text = text.replace("\x00", "")
    text = "".join(
        ch for ch in text if ch in "\n\r\t" or ord(ch) >= 32 or ch == "\ufeff"
    )
    text = text.strip("\ufeff\t\n\r ")
    if not text:
        return None
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    for line in text.splitlines():
        line = line.strip()
        line = line.replace("\x00", "")
        if line.startswith("data:"):
            line = line[5:].strip()
        if not line or line[0] not in "{[":
            continue
        try:
            obj = json.loads(line)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            continue
    return None


def _ollama_body_error(r: httpx.Response) -> str | None:
    data = _parse_ollama_json_body(r)
    if isinstance(data, dict):
        err = data.get("error")
        if err:
            return str(err).strip()
    return None


def run_ollama(prompt: str, model: str | None = None) -> str:
    """
    Call Ollama. Prefer /api/chat (reliable for instruct/chat models); fall back to /api/generate.
    Some models return HTTP 500 on /api/generate while /api/chat works.
    """
    m = resolve_ollama_model(model)
    base = settings.ollama_base_url.rstrip("/")
    timeout = 180.0

    chat_url = f"{base}/api/chat"
    gen_url = f"{base}/api/generate"

    safe_prompt = _sanitize_ollama_text(prompt)
    chat_body = {
        "model": m,
        "messages": [{"role": "user", "content": safe_prompt}],
        "stream": False,
    }
    gen_body = {"model": m, "prompt": safe_prompt, "stream": False}

    last_err: str | None = None

    def _bad_json_hint(url: str, resp: httpx.Response) -> str:
        ct = (resp.headers.get("content-type") or "").lower()
        if "text/html" in ct:
            return (
                f"Response was HTML, not JSON from {url}. "
                "OLLAMA_BASE_URL may point at the wrong service (e.g. a web app), not Ollama."
            )
        return (
            f"Response was not valid JSON from {url} (often wrong port/proxy or corrupted body). "
            f"Confirm Ollama is on {base} and `curl {base}/api/tags` returns JSON."
        )

    with httpx.Client(timeout=timeout) as client:
        try:
            r = client.post(chat_url, json=chat_body)
            if r.status_code == 200:
                data = _parse_ollama_json_body(r)
                if data is None:
                    last_err = _bad_json_hint(chat_url, r)
                elif isinstance(data, dict):
                    be = data.get("error")
                    if be:
                        last_err = str(be)
                    else:
                        msg = data.get("message") or {}
                        text = (msg.get("content") or "").strip()
                        if text:
                            return text
                        last_err = "Ollama chat returned empty content"
                else:
                    last_err = "Ollama chat returned unexpected JSON"
            else:
                last_err = _ollama_body_error(r) or f"HTTP {r.status_code} from /api/chat"
        except httpx.RequestError as e:
            last_err = f"Cannot reach Ollama at {base}: {e}"
            raise RuntimeError(last_err) from e

        log.info("Ollama /api/chat did not return text; trying /api/generate")

        try:
            r2 = client.post(gen_url, json=gen_body)
            if r2.status_code == 200:
                data = _parse_ollama_json_body(r2)
                if data is None:
                    raise RuntimeError(_bad_json_hint(gen_url, r2))
                if isinstance(data, dict):
                    be = data.get("error")
                    if be:
                        raise RuntimeError(str(be))
                    text = (data.get("response") or "").strip()
                    if text:
                        return text
                raise RuntimeError("Ollama /api/generate returned empty response")
            gen_err = (
                _ollama_body_error(r2)
                or safe_client_detail(r2.text[:800])
                or f"HTTP {r2.status_code}"
            )
            raise RuntimeError(
                f"Ollama failed. Chat: {last_err}. Generate: {gen_err}. "
                f"Check model name matches `ollama list` (e.g. ollama pull {m})."
            )
        except httpx.RequestError as e:
            raise RuntimeError(
                f"Ollama generate request failed: {e}. Earlier chat error: {last_err}"
            ) from e


def test_openai_key(api_key: str) -> tuple[bool, str, str | None]:
    """
    Lightweight check for admin UI. Returns (ok, message, short_preview).
    Does not raise; never includes the key in messages.
    """
    key = (api_key or "").strip()
    if not key:
        return False, "No API key to test. Paste a key above or set OPENAI_API_KEY in backend/.env.", None
    try:
        preview = _run_openai(
            "Reply with exactly the single word: OK",
            key,
        )
        p = (preview or "").strip()
        if not p:
            return False, "OpenAI returned an empty reply.", None
        return (
            True,
            "OpenAI API key works and the model replied successfully.",
            safe_client_detail(p, max_len=240),
        )
    except httpx.HTTPStatusError as e:
        msg = _openai_http_error_message(e)
        return False, safe_client_detail(msg), None
    except httpx.RequestError as e:
        return False, safe_client_detail(f"Network error calling OpenAI: {e}"), None
    except Exception as e:
        return False, safe_client_detail(str(e)), None


def _openai_http_error_message(e: httpx.HTTPStatusError) -> str:
    try:
        j = e.response.json()
        err = j.get("error")
        if isinstance(err, dict):
            return str(err.get("message") or err.get("code") or err)[:800]
        if isinstance(err, str):
            return err[:800]
    except Exception:
        pass
    t = (e.response.text or "")[:800]
    return t or f"HTTP {e.response.status_code}"


def _run_openai(prompt: str, api_key: str) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
    }
    with httpx.Client(timeout=120.0) as client:
        r = client.post(url, json=body, headers=headers)
        r.raise_for_status()
        data = r.json()
        return (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )


def ai_router(
    prompt: str,
    *,
    ai_mode: str,
    api_key: str | None,
    ollama_model: str | None = None,
) -> str:
    """
    - ollama_base_url: local generation via run_ollama (chat + generate fallback).
    - Workspace OpenAI key or env OPENAI_API_KEY when workspace ai_mode is api.
    - MODE=local forces Ollama only.
    """
    force_local = (settings.mode or "local").strip().lower() == "local"
    if force_local:
        return run_ollama(prompt, model=ollama_model)

    ws_key = (api_key or "").strip() or None
    env_key = (settings.openai_api_key or "").strip() or None
    effective_key = ws_key or env_key

    if ai_mode == "api" and effective_key:
        try:
            return _run_openai(prompt, effective_key)
        except Exception as e:
            log.warning("OpenAI failed, falling back to Ollama: %s", e)
    return run_ollama(prompt, model=ollama_model)
