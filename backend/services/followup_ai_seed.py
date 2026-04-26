"""One-time / idempotent seeding for required follow-up AI instructions."""

from sqlalchemy.orm import Session

from core.followup_ai_defaults import DEFAULT_FOLLOWUP_AI_CUSTOM_PROMPT
from models.settings import WorkspaceSettings


def seed_followup_ai_defaults(db: Session) -> None:
    """Set followup_ai_custom_prompt when missing so AI follow-ups are never unconfigured."""
    rows = db.query(WorkspaceSettings).all()
    changed = False
    for row in rows:
        raw = getattr(row, "followup_ai_custom_prompt", None) or ""
        if not str(raw).strip():
            row.followup_ai_custom_prompt = DEFAULT_FOLLOWUP_AI_CUSTOM_PROMPT
            changed = True
    if changed:
        db.commit()
