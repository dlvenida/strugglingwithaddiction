from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class EmailTemplateOverride(Base, TimestampMixin):
    """Admin-edited subject/body overrides for built-in transactional templates."""

    __tablename__ = "email_template_overrides"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    subject: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
