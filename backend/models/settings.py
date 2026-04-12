from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class WorkspaceSettings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id"), unique=True, index=True
    )
    ai_mode: Mapped[str] = mapped_column(String(16), default="local")
    api_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    usage_limit: Mapped[int] = mapped_column(Integer, default=1000)
    ollama_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smtp_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(Text, nullable=True)
    followup_subject_template: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    followup_opening_line: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    followup_closing_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    followup_sender_display_name: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )
    dashboard_manual_replies: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dashboard_manual_conversions: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    usage_email_90_sent: Mapped[bool] = mapped_column(default=False, nullable=False)
    usage_email_limit_sent: Mapped[bool] = mapped_column(default=False, nullable=False)

    workspace: Mapped["Workspace"] = relationship(
        "Workspace", back_populates="settings_row"
    )
