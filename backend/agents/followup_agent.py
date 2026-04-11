import random

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
    last_context: str | None = None,
    previous_followup_bodies: list[str] | None = None,
    tone: str | None = None,
    workspace_plan: str = "free",
) -> str:
    tag = lead_tag or "none"
    ctx_block = ""
    if last_context and last_context.strip():
        ctx_block = (
            "Context to use (prefer the lead note when it conflicts with older thread text):\n"
            "---\n"
            f"{last_context.strip()[:6000]}\n"
            "---\n\n"
        )

    prev = previous_followup_bodies or []
    prev_block = ""
    if prev:
        lines = "\n\n".join(
            f"--- Prior follow-up {i + 1} ---\n{p[:1200]}" for i, p in enumerate(prev)
        )
        prev_block = (
            "Earlier AI drafts already sent to this lead (do NOT repeat wording, structure, "
            "or calls-to-action — write a clearly different variation):\n"
            f"{lines}\n\n"
        )

    tone_pick = tone or random.choice(["friendly", "professional", "direct"])
    opening_hint = random.choice(
        [
            "Start the body with a specific hook tied to the context (not a generic opener).",
            "Open with something that shows you read their situation — avoid template phrases.",
            "Reference the lead note or thread naturally in the first sentence when possible.",
        ]
    )
    cta_hint = random.choice(
        [
            "End with one clear, varied call-to-action (question, short meeting ask, or next step).",
            "Close with a concrete next step that fits the tone.",
            "Suggest a specific follow-up that does not mirror prior drafts.",
        ]
    )

    prompt = (
        f"You are writing the **middle only** of a follow-up email (the main paragraphs). "
        f"A greeting line (e.g. Hi Name,) and a signature block will be added **automatically** "
        f"by the system — do **not** include Hi/Hello/Dear, do **not** include "
        f"Best regards / Thanks / your name / sign-off.\n\n"
        f"Use a **{tone_pick}** tone: "
        + (
            "warm and conversational."
            if tone_pick == "friendly"
            else (
                "polished and concise."
                if tone_pick == "professional"
                else "short, confident, and direct."
            )
        )
        + "\n"
        f"{opening_hint}\n"
        f"{cta_hint}\n\n"
        "No AI disclaimers, no bullet lists unless essential, no emojis, no markdown asterisks.\n"
        "2–4 short paragraphs, under 200 words. No placeholder brackets like [company].\n\n"
        f"Lead name (for context only; do not address them in a salutation): {lead_name}\n"
        f"Lead email (do not paste): {lead_email}\n"
        f"Pipeline status: {lead_status}\n"
        f"Tag: {tag}\n\n"
        f"{prev_block}"
        f"{ctx_block}"
        "Output **only** the middle paragraphs (plain text)."
    )
    return ai_router(
        prompt,
        ai_mode=ai_mode,
        api_key=api_key,
        ollama_model=ollama_model,
        workspace_plan=workspace_plan,
    )
