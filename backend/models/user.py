from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    # Personal AI message cap; NULL = use workspace master cap from settings.usage_limit.
    ai_message_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_email_90_sent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    usage_email_limit_sent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="users")
