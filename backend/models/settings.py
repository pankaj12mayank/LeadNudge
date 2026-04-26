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
    # Relative to UPLOAD_DIR, e.g. portfolios/ws_3/file.pdf — optional follow-up attachment.
    portfolio_attachment_path: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    # Required workspace template merged into follow-up AI prompt (see followup_agent placeholders).
    followup_ai_custom_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON: optional per-workspace overrides over global merge-field labels (see merge_field_labels_service).
    lead_merge_field_labels_override_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    workspace: Mapped["Workspace"] = relationship(
        "Workspace", back_populates="settings_row"
    )
