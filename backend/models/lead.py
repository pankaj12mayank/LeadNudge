from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


def _utc_now():
    return datetime.now(timezone.utc)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(64), default="new")
    tag: Mapped[str | None] = mapped_column(String(128), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    temperature_tag: Mapped[str | None] = mapped_column(
        String(16), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, index=True
    )
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    # Agency / outbound pipeline fields (CSV + manual form).
    role_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_link: Mapped[str | None] = mapped_column(String(512), nullable=True)
    agency_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    team_size_estimate: Mapped[str | None] = mapped_column(String(64), nullable=True)
    problem_seen: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_active_display: Mapped[str | None] = mapped_column(String(128), nullable=True)
    connection_sent_date: Mapped[str | None] = mapped_column(String(128), nullable=True)
    replied_y_n: Mapped[str | None] = mapped_column(String(8), nullable=True)
    solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    lead_type: Mapped[str | None] = mapped_column(String(8), nullable=True)
    # Portal users only see leads they own; NULL = admin-visible only (unassigned legacy).
    owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="leads")
    followups: Mapped[list["Followup"]] = relationship(
        "Followup", back_populates="lead", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="lead", cascade="all, delete-orphan"
    )
