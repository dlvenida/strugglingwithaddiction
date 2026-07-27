from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PlatformEmailSettings(Base, TimestampMixin):
    """Singleton (id=1) email delivery + branding settings for the admin platform."""

    __tablename__ = "platform_email_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    # auto | resend | gmail_smtp | smtp
    provider: Mapped[str] = mapped_column(String(32), default="auto")
    email_from: Mapped[str | None] = mapped_column(String(255), nullable=True)
    postal_address: Mapped[str | None] = mapped_column(String(512), nullable=True)
    site_name: Mapped[str] = mapped_column(String(255), default="Struggling With Addiction")
    logo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    resend_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smtp_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(Text, nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    social_facebook: Mapped[str | None] = mapped_column(String(512), nullable=True)
    social_twitter: Mapped[str | None] = mapped_column(String(512), nullable=True)
    social_youtube: Mapped[str | None] = mapped_column(String(512), nullable=True)
    social_instagram: Mapped[str | None] = mapped_column(String(512), nullable=True)
    social_linkedin: Mapped[str | None] = mapped_column(String(512), nullable=True)
