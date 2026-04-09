import httpx

from core.config import settings
from utils.logger import get_logger

log = get_logger("ai_router")


def run_ollama(prompt: str, model: str | None = None) -> str:
    m = model or settings.ollama_model
    url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
    payload = {"model": m, "prompt": prompt, "stream": False}
    try:
        with httpx.Client(timeout=120.0) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            return (data.get("response") or "").strip()
    except Exception as e:
        log.warning("Ollama request failed: %s", e)
        raise


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
) -> str:
    """
    - OLLAMA_URL / ollama_base_url is used for local generation.
    - Workspace OPENAI key or env OPENAI_API_KEY can be used when workspace ai_mode is api.
    - Env MODE=local forces Ollama only (no OpenAI), regardless of workspace.
    """
    force_local = (settings.mode or "local").strip().lower() == "local"
    if force_local:
        return run_ollama(prompt)

    ws_key = (api_key or "").strip() or None
    env_key = (settings.openai_api_key or "").strip() or None
    effective_key = ws_key or env_key

    if ai_mode == "api" and effective_key:
        try:
            return _run_openai(prompt, effective_key)
        except Exception as e:
            log.warning("OpenAI failed, falling back to Ollama: %s", e)
    return run_ollama(prompt)
