import hashlib
import random

from agents.ai_router import ai_router


def generate_followup(
    *,
    lead_name: str,
    lead_email: str,
    lead_status: str,
    lead_tag: str | None,
    lead_company: str | None = None,
    ai_mode: str,
    api_key: str | None,
    ollama_model: str | None = None,
    last_context: str | None = None,
    previous_followup_bodies: list[str] | None = None,
    tone: str | None = None,
    workspace_plan: str = "free",
    message_kind: str = "followup_reminder",
    send_timing_label: str | None = None,
    lead_id: int = 0,
    followup_id: int = 0,
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
    else:
        ctx_block = (
            "There is **no saved lead note or thread** yet. Personalize using pipeline status, "
            "name, and company only — do not invent facts, products they bought, or meetings.\n\n"
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
    company_line = ""
    if lead_company and str(lead_company).strip():
        company_line = f"Company / org (context only): {str(lead_company).strip()}\n"

    kind = (message_kind or "followup_reminder").strip().lower()
    kind_instructions = {
        "first_contact": (
            "Message type: First contact. Introduce value briefly, reference their note/status, "
            "and invite a light next step — no assumption they remember prior emails."
        ),
        "followup_reminder": (
            "Message type: Follow-up reminder. Nudge on the prior thread or note without "
            "repeating earlier wording; add one fresh angle or question."
        ),
        "closing_attempt": (
            "Message type: Closing attempt. Respectful urgency: confirm fit, address hesitation, "
            "offer a crisp decision step (call, trial, or clear yes/no question)."
        ),
        "recovery_friendly": (
            "Message type: Recovery — friendly check-in. You have not heard back; sound human, "
            "low pressure, offer to close the loop or reschedule."
        ),
        "recovery_reminder": (
            "Message type: Recovery — reminder. Gentle reminder of what they asked for or "
            "next step promised; one short paragraph on why it still matters."
        ),
        "recovery_offer": (
            "Message type: Recovery — offer-based. Lead with a concise helpful offer "
            "(resource, quick audit, pricing recap) tied to their context."
        ),
    }
    kind_block = kind_instructions.get(
        kind, kind_instructions["followup_reminder"]
    )

    timing_line = ""
    if send_timing_label:
        timing_line = (
            f"Scheduled send window: {send_timing_label}. Keep pacing and energy appropriate "
            "for that part of the day (no “good morning” if evening).\n\n"
        )

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

    uniq_src = f"{lead_id}|{followup_id}|{last_context or ''}|{lead_email}|{message_kind}"
    uniq = hashlib.sha256(uniq_src.encode("utf-8", errors="replace")).hexdigest()[:16]

    detail_rule = (
        "When any lead note or thread text exists above, you must reflect at least one "
        "concrete detail from it: a phrase, product, timeline, objection, or question they raised. "
        "Do not write a generic paragraph that could apply to any lead."
        if (last_context and last_context.strip())
        else "Keep the body specific to this person's name, status, and company context only."
    )

    prompt = (
        "You are writing the middle only of a follow-up email (the main paragraphs). "
        "A greeting line (e.g. Hi Name,) and a signature block will be added automatically "
        "by the system — do not include Hi/Hello/Dear, do not include "
        "Best regards / Thanks / your name / sign-off.\n\n"
        f"Use a {tone_pick} tone: "
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
        "No AI disclaimers, no bullet lists unless essential, no emojis.\n"
        "2–4 short paragraphs, under 200 words. No placeholder brackets like [company].\n"
        "Do not wrap the lead's note in parentheses or brackets. Wrong: what you shared (Interested). "
        "Right: what you shared **Interested** — or weave the idea in without quoting.\n"
        "Never use (note text) or [note text]. When you echo words from their saved note or thread, "
        "put only those words inside double asterisks: **note text** (at most one or two short spans). "
        "The email body must stay about that note; do not write a generic follow-up that ignores it.\n"
        f"{detail_rule}\n"
        f"Internal reference token (never output or quote this token): {uniq}\n\n"
        f"{timing_line}"
        f"{kind_block}\n\n"
        f"Lead name (for context only; do not address them in a salutation): {lead_name}\n"
        f"Lead email (do not paste): {lead_email}\n"
        f"Pipeline status: {lead_status}\n"
        f"Tag: {tag}\n"
        f"{company_line}\n"
        f"{prev_block}"
        f"{ctx_block}"
        "Output only the middle paragraphs (plain text), following the bold rules above."
    )
    return ai_router(
        prompt,
        ai_mode=ai_mode,
        api_key=api_key,
        ollama_model=ollama_model,
        workspace_plan=workspace_plan,
    )
