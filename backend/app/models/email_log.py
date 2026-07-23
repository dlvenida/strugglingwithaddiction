from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class EmailLog(Base, TimestampMixin):
    __tablename__ = "email_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    to_email: Mapped[str] = mapped_column(String(255), index=True)
    template_key: Mapped[str] = mapped_column(String(100), index=True)
    subject: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), default="sent")  # sent | failed | skipped
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rehab_center_id: Mapped[int | None] = mapped_column(ForeignKey("rehab_centers.id", ondelete="SET NULL"), nullable=True)
    meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)
