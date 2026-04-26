/** Keep in sync with backend/core/followup_ai_defaults.py */
export const MIN_FOLLOWUP_AI_INSTRUCTIONS_LEN = 50;

export const DEFAULT_FOLLOWUP_AI_BODY_INSTRUCTIONS = `Write 2–4 short paragraphs for the email body (no greeting or sign-off).

1) Open by reflecting the lead's situation using their own words from {{problem_seen}} when present; otherwise reference {{lead_status}} and {{company}} briefly.

2) Explain how we can help using {{solution}} — weave it naturally, do not paste as a bullet list or marketing brochure.

3) Use {{context}} as extra background; if it conflicts with {{problem_seen}}, prefer the problem note.

4) End with one clear, soft question for next steps — no high-pressure close.

Tone: human, concise, specific. Do not invent meetings or facts not in the placeholders.`;
