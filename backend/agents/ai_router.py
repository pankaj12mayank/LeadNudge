import shutil
import subprocess

import httpx

from core.config import settings
from utils.ai_parser import (
    clean_text,
    extract_ollama_completion,
    parse_ollama_response_body,
)
from utils.logger import get_logger
from utils.safe_client_message import safe_client_detail

log = get_logger("ai_router")

OLLAMA_TIMEOUT = 120.0


def _log_ai_fallback_to_db(reason: str, model: str) -> None:
    try:
        from db.session import SessionLocal
        from services.system_log_service import log_event

        s = SessionLocal()
        try:
            log_event(
                s,
                kind="AI",
                message=f"Ollama follow-up fallback: {reason} model={model}"[:8000],
            )
        finally:
            s.close()
    except Exception:
        pass

# Returned as plain email body when AI is unavailable (never crash callers).
FALLBACK_FOLLOWUP_BODY = (
    "Following up regarding our last discussion. Let me know a good time to connect."
)


def _sanitize_model_name(model: str | None) -> str:
    s = (model or "").strip()
    s = "".join(ch for ch in s if ord(ch) >= 32)
    s = s.strip()
    return s or "llama3.2:latest"


def resolve_ollama_model(model: str | None) -> str:
    return _sanitize_model_name(model or settings.ollama_model or "llama3.2:latest")


def _sanitize_ollama_text(text: str | None) -> str:
    s = (text or "").strip()
    return "".join(ch for ch in s if ord(ch) >= 32 or ch in "\n\r\t")


def _ollama_tags_names(client: httpx.Client, base: str) -> set[str]:
    r = client.get(f"{base}/api/tags", timeout=30.0)
    r.raise_for_status()
    data = r.json()
    out: set[str] = set()
    for m in data.get("models") or []:
        if isinstance(m, dict) and m.get("name"):
            out.add(str(m["name"]))
    return out


def _normalize_ollama_base() -> str:
    raw = (settings.ollama_base_url or "").strip()
    return raw.rstrip("/")


def ollama_health_reachable(client: httpx.Client, base: str) -> tuple[bool, str | None]:
    """Try /api/version then /api/tags. Returns (ok, user_facing_error)."""
    for path, timeout in (("/api/version", 8.0), ("/api/tags", 15.0)):
        try:
            r = client.get(f"{base}{path}", timeout=timeout)
            if r.status_code == 200:
                return True, None
        except httpx.ConnectError:
            return (
                False,
                "Cannot connect to the AI service. Start Ollama and ensure OLLAMA_BASE_URL "
                "in backend/.env matches your server (e.g. http://localhost:11434).",
            )
        except Exception:
            continue
    return (
        False,
        "The AI service did not respond. Check that Ollama is running and OLLAMA_BASE_URL is correct.",
    )


def model_installed_in_tags(installed: set[str], model: str) -> bool:
    """True if `model` or a compatible tag (e.g. llama3.2 vs llama3.2:latest) exists."""
    m = _sanitize_model_name(model)
    if m in installed:
        return True
    base_name = m.split(":", 1)[0].strip()
    for tag in installed:
        if tag == base_name or tag.startswith(base_name + ":"):
            return True
    return False


def _maybe_pull_model(model: str) -> None:
    if not shutil.which("ollama"):
        return
    try:
        subprocess.run(
            ["ollama", "pull", model],
            capture_output=True,
            timeout=600,
            text=True,
            errors="replace",
        )
    except Exception as e:
        log.warning("ollama pull skipped/failed for %s: %s", model, e)


def _ensure_model_available(client: httpx.Client, base: str, model: str) -> None:
    try:
        names = _ollama_tags_names(client, base)
    except Exception as e:
        log.warning("Could not list Ollama models: %s", e)
        return
    if model in names:
        return
    log.info("Model %s not in tags; attempting ollama pull", model)
    _maybe_pull_model(model)


def _post_generate_once(
    client: httpx.Client, base: str, model: str, prompt: str
) -> str | None:
    gen_url = f"{base}/api/generate"
    body = {
        "model": model,
        "prompt": _sanitize_ollama_text(prompt),
        "stream": False,
    }
    r = client.post(gen_url, json=body)
    if r.status_code != 200:
        log.warning("Ollama generate HTTP %s", r.status_code)
        return None
    data: object | None
    try:
        data = r.json()
    except Exception:
        data = parse_ollama_response_body(r.content)
        if data is None:
            log.warning("Ollama generate body was not valid JSON")
            return None
    text = extract_ollama_completion(data)
    if not text and isinstance(data, dict):
        log.warning(
            "Ollama generate parsed but no text (keys=%s)",
            list(data.keys())[:12],
        )
    return text


def _post_chat_once(
    client: httpx.Client, base: str, model: str, prompt: str
) -> str | None:
    """Fallback when /api/generate returns empty or wrong shape (common for instruct models)."""
    url = f"{base}/api/chat"
    body = {
        "model": model,
        "messages": [{"role": "user", "content": _sanitize_ollama_text(prompt)}],
        "stream": False,
    }
    r = client.post(url, json=body)
    if r.status_code != 200:
        log.warning("Ollama chat HTTP %s", r.status_code)
        return None
    try:
        data = r.json()
    except Exception:
        data = parse_ollama_response_body(r.content)
        if data is None:
            return None
    return extract_ollama_completion(data)


def _ollama_generate_once(prompt: str, model: str) -> str:
    base = _normalize_ollama_base()
    if not base or not base.lower().startswith(("http://", "https://")):
        raise RuntimeError(
            "OLLAMA_BASE_URL is missing or invalid. Set it in backend/.env to your Ollama server "
            "(e.g. http://localhost:11434)."
        )
    m = _sanitize_model_name(model)
    with httpx.Client(timeout=OLLAMA_TIMEOUT) as client:
        try:
            _ensure_model_available(client, base, m)
        except Exception as e:
            log.warning("Ollama model check: %s", e)
        for label, fn in (
            ("generate", _post_generate_once),
            ("chat", _post_chat_once),
        ):
            text = fn(client, base, m, prompt)
            if text:
                return text
            log.info("Ollama %s empty; retry once", label)
            text = fn(client, base, m, prompt)
            if text:
                return text
        raise RuntimeError(
        f"Ollama did not return usable text for model {m!r} "
        f"(tried /api/generate and /api/chat). Check OLLAMA_BASE_URL and `ollama list`."
    )


def run_ollama_admin_test(
    prompt: str,
    model: str | None = None,
) -> tuple[bool, str, str | None, str]:
    """
    Admin-only test: health check, model presence, /api/generate then /api/chat.
    Returns (ok, user_message, preview_safe, resolved_model). No stack traces in message.
    """
    m = resolve_ollama_model(model)
    base = _normalize_ollama_base()
    if not base or not base.lower().startswith(("http://", "https://")):
        return (
            False,
            "AI service URL is not configured. Set OLLAMA_BASE_URL in backend/.env "
            "(default http://localhost:11434).",
            None,
            m,
        )
    with httpx.Client(timeout=OLLAMA_TIMEOUT) as client:
        ok_h, err_h = ollama_health_reachable(client, base)
        if not ok_h:
            return False, err_h or "AI service unavailable.", None, m
        try:
            names = _ollama_tags_names(client, base)
        except httpx.ConnectError:
            return (
                False,
                "Cannot connect to the AI service. Start Ollama or fix OLLAMA_BASE_URL.",
                None,
                m,
            )
        except Exception:
            return (
                False,
                "Could not read installed models from the AI service.",
                None,
                m,
            )
        if not model_installed_in_tags(names, m):
            return (
                False,
                f'Model "{m}" is not installed. Install it on the Ollama host (e.g. ollama pull '
                f'{m.split(":")[0]}), then try again.',
                None,
                m,
            )
        text = _post_generate_once(client, base, m, prompt)
        if not (text or "").strip():
            text = _post_chat_once(client, base, m, prompt)
        if not (text or "").strip():
            text = _post_generate_once(client, base, m, prompt)
        if not (text or "").strip():
            text = _post_chat_once(client, base, m, prompt)
    p = (text or "").strip()
    fb = (FALLBACK_FOLLOWUP_BODY or "").strip()
    if not p or p == fb:
        return (
            False,
            "AI service temporarily unavailable. Please try again.",
            None,
            m,
        )
    return (
        True,
        "Ollama is working. Model responded successfully.",
        safe_client_detail(p, max_len=280),
        m,
    )


def run_ollama(
    prompt: str,
    model: str | None = None,
    *,
    allow_fallback: bool = True,
    raise_on_failure: bool = False,
) -> str:
    """
    Ollama: POST /api/generate then /api/chat fallback, stream=false.
    Retries once per endpoint; optional default model then safe template body.
    """
    m = resolve_ollama_model(model)
    default_m = _sanitize_model_name(
        (settings.ollama_model or "llama3.2:latest").strip()
    )

    def _try(mm: str) -> str:
        return _ollama_generate_once(prompt, mm)

    try:
        return _try(m)
    except Exception as e:
        if allow_fallback and m != default_m:
            try:
                log.warning("Ollama model %s failed; trying default %s", m, default_m)
                return _try(default_m)
            except Exception as e2:
                log.warning("Ollama default model failed: %s", e2)
                if raise_on_failure:
                    raise RuntimeError(str(e2)) from e2
                _log_ai_fallback_to_db(str(e2)[:500], default_m)
                return FALLBACK_FOLLOWUP_BODY
        if raise_on_failure:
            raise RuntimeError(str(e)) from e
        log.warning("Ollama failed; fallback body. Cause: %s", e)
        _log_ai_fallback_to_db(str(e)[:500], m)
        return FALLBACK_FOLLOWUP_BODY


def test_openai_key(api_key: str) -> tuple[bool, str, str | None]:
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
        "messages": [{"role": "user", "content": clean_text(prompt)}],
        "temperature": 0.7,
        "stream": False,
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
    Production path: never raises — returns draft text or FALLBACK_FOLLOWUP_BODY.
    """
    force_local = (settings.mode or "local").strip().lower() == "local"
    if force_local:
        return run_ollama(prompt, model=ollama_model, raise_on_failure=False)

    ws_key = (api_key or "").strip() or None
    env_key = (settings.openai_api_key or "").strip() or None
    effective_key = ws_key or env_key

    if ai_mode == "api" and effective_key:
        try:
            out = _run_openai(prompt, effective_key)
            if out:
                return out
        except Exception as e:
            log.warning("OpenAI failed, falling back to Ollama/fallback: %s", e)
    return run_ollama(prompt, model=ollama_model, raise_on_failure=False)

