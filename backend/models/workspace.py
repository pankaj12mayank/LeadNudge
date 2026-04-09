from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    plan_type: Mapped[str] = mapped_column(String(32), default="free")

    users: Mapped[list["User"]] = relationship("User", back_populates="workspace")
    leads: Mapped[list["Lead"]] = relationship("Lead", back_populates="workspace")
    settings_row: Mapped["WorkspaceSettings | None"] = relationship(
        "WorkspaceSettings",
        back_populates="workspace",
        uselist=False,
    )
