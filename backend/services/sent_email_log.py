"""Persist rows to sent_emails for admin reporting (avoids circular imports)."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from db.session import SessionLocal
from models.sent_email import SentEmail


def append_sent_email(
    *,
    workspace_id: int | None,
    to_email: str,
    subject: str,
    body: str,
    status: str = "sent",
) -> None:
    db = SessionLocal()
    try:
        db.add(
            SentEmail(
                workspace_id=workspace_id,
                to_email=to_email.strip()[:255],
                subject=subject.strip()[:512],
                body=body[:50000],
                sent_at=datetime.now(timezone.utc),
                status=status[:32],
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def append_sent_email_with_db(
    db: Session,
    *,
    workspace_id: int | None,
    to_email: str,
    subject: str,
    body: str,
    status: str = "sent",
) -> None:
    db.add(
        SentEmail(
            workspace_id=workspace_id,
            to_email=to_email.strip()[:255],
            subject=subject.strip()[:512],
            body=body[:50000],
            sent_at=datetime.now(timezone.utc),
            status=status[:32],
        )
    )
