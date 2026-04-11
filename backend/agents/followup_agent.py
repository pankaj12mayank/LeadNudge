from agents.ai_router import ai_router


def generate_followup(
    *,
    lead_name: str,
    lead_email: str,
    lead_status: str,
    lead_tag: str | None,
    ai_mode: str,
    api_key: str | None,
    ollama_model: str | None = None,
) -> str:
    tag = lead_tag or "none"
    prompt = (
        "You are a concise B2B sales assistant. Draft a short, professional "
        "follow-up email (subject line optional, body only is fine) for this lead.\n\n"
        f"Name: {lead_name}\n"
        f"Email: {lead_email}\n"
        f"Status: {lead_status}\n"
        f"Tag: {tag}\n\n"
        "Keep it under 180 words. No placeholder brackets."
    )
    return ai_router(
        prompt, ai_mode=ai_mode, api_key=api_key, ollama_model=ollama_model
    )
