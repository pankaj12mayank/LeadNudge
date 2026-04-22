"""Missed-lead recovery (automatic queue) — disabled; users schedule follow-ups explicitly."""

from sqlalchemy.orm import Session


def run_daily_recovery(db: Session, *, max_per_run: int = 80) -> int:
    """
    Previously queued automatic "recovery" follow-ups without an explicit user schedule.

    That sent mail users did not ask for. Recovery auto-queue is disabled; users schedule
    normal follow-ups from the portal when they want mail sent.
    """
    return 0
