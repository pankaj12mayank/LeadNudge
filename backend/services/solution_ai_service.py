"""Draft the lead `solution` field from `problem_seen` using the workspace AI router."""

from agents.ai_router import FALLBACK_FOLLOWUP_BODY, ai_router


def suggest_solution_from_problem(
    *,
    problem_seen: str | None,
    company: str | None,
    role_title: str | None,
    lead_name: str | None,
    ai_mode: str,
    api_key: str | None,
    ollama_model: str | None,
    workspace_plan: str = "free",
) -> str:
    prob = (problem_seen or "").strip()
    if not prob:
        return ""

    nm = (lead_name or "").strip() or "this contact"
    co = (company or "").strip() or "n/a"
    role = (role_title or "").strip() or "n/a"

    prompt = (
        "You are helping a sales rep fill one CRM field: **Solution** — what they can realistically "
        "offer or do for this person, based ONLY on the problem described below.\n"
        "Rules: 2–4 short sentences, plain text, under 120 words. "
        "Professional and human; helpful positioning, not a hard pitch. "
        "No greeting, no sign-off, no bullet list unless essential. "
        "Do not invent product names, prices, or meetings. "
        "If the problem is vague, stay general but still useful.\n\n"
        f"Lead: {nm}\n"
        f"Company: {co}\n"
        f"Role: {role}\n"
        f"Problem / situation (from the rep):\n{prob[:4000]}\n\n"
        "Output only the Solution field text."
    )
    raw = (
        ai_router(
            prompt,
            ai_mode=ai_mode,
            api_key=api_key,
            ollama_model=ollama_model,
            workspace_plan=workspace_plan,
            failure_fallback="",
        )
        or ""
    ).strip()
    if raw == (FALLBACK_FOLLOWUP_BODY or "").strip():
        return ""
    if len(raw) > 8000:
        return raw[:8000].rstrip()
    return raw
