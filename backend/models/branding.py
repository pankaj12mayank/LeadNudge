from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class AppBranding(Base):
    """Singleton row (id=1): product name and optional logo file under /static/uploads."""

    __tablename__ = "app_branding"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_name: Mapped[str] = mapped_column(String(255), default="Sales Follow-up Console")
    logo_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
