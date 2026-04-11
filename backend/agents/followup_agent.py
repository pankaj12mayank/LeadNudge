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
) -> str:
    tag = lead_tag or "none"
    ctx_block = ""
    if last_context and last_context.strip():
        ctx_block = (
            "Most recent thread / note from this lead (use only if relevant; do not quote "
            "verbatim if it looks like system text):\n"
            "---\n"
            f"{last_context.strip()[:6000]}\n"
            "---\n\n"
        )

    prev = previous_followup_bodies or []
    prev_block = ""
    if prev:
        lines = "\n\n".join(f"--- Prior follow-up {i + 1} ---\n{p[:1200]}" for i, p in enumerate(prev))
        prev_block = (
            "Earlier AI follow-up drafts you already sent this lead (do NOT repeat wording, "
            "structure, or calls-to-action from these — write a clearly different variation):\n"
            f"{lines}\n\n"
        )

    tone_pick = tone or random.choice(["friendly", "professional", "direct"])
    opening_hint = random.choice(
        [
            "Start with a natural, specific opening (not a generic greeting template).",
            "Open with a light personal touch or a crisp business opener matching the tone.",
            "Vary how you acknowledge the last touch — avoid repeating the same opener style.",
        ]
    )
    cta_hint = random.choice(
        [
            "End with one clear, varied call-to-action (question, short meeting ask, or soft next step).",
            "Close with a different CTA than a typical 'just checking in' line.",
            "Suggest a concrete next step that fits the tone and does not mirror prior drafts.",
        ]
    )

    prompt = (
        f"Write a follow-up email body as a real salesperson would. Use a **{tone_pick}** tone "
        f"throughout: "
        + (
            "warm and conversational, easy to read."
            if tone_pick == "friendly"
            else (
                "polished and concise, suitable for enterprise buyers."
                if tone_pick == "professional"
                else "short, confident, and to the point."
            )
        )
        + "\n"
        f"{opening_hint}\n"
        f"{cta_hint}\n\n"
        "No AI disclaimers, no overused openers unless they fit naturally, "
        "no bullet lists unless essential, no emojis, no markdown asterisks.\n\n"
        "Use a normal business email structure: greeting with the person's name, 2–4 short "
        "paragraphs, polite close. Sound like one thoughtful person wrote it, not a template "
        "generator.\n\n"
        f"Lead name: {lead_name}\n"
        f"Lead email (do not paste into body): {lead_email}\n"
        f"Pipeline status: {lead_status}\n"
        f"Tag: {tag}\n\n"
        f"{prev_block}"
        f"{ctx_block}"
        "Keep total length under 220 words. No placeholder brackets like [company]. "
        "Output only the email body (no subject line)."
    )
    return ai_router(
        prompt, ai_mode=ai_mode, api_key=api_key, ollama_model=ollama_model
    )
