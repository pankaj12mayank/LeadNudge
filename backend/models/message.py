from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


def _utc_now():
    return datetime.now(timezone.utc)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_lead_followup", "lead_id", "followup_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    followup_id: Mapped[int | None] = mapped_column(
        ForeignKey("followups.id", ondelete="SET NULL"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
    )

    lead: Mapped["Lead"] = relationship("Lead", back_populates="messages")
