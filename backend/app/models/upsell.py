import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class UpsellProductType(str, enum.Enum):
    verified_badge = "verified_badge"
    featured_placement = "featured_placement"
    featured_article = "featured_article"
    article_aeo = "article_aeo"


class UpsellFulfillment(str, enum.Enum):
    self_serve = "self_serve"
    human = "human"


class UpsellOrderStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    fulfilled = "fulfilled"
    canceled = "canceled"


class UpsellOrder(Base, TimestampMixin):
    __tablename__ = "upsell_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    rehab_center_id: Mapped[int] = mapped_column(ForeignKey("rehab_centers.id", ondelete="CASCADE"), index=True)
    product_type: Mapped[UpsellProductType] = mapped_column(Enum(UpsellProductType))
    fulfillment: Mapped[UpsellFulfillment] = mapped_column(Enum(UpsellFulfillment))
    status: Mapped[UpsellOrderStatus] = mapped_column(Enum(UpsellOrderStatus), default=UpsellOrderStatus.pending)
    amount_cents: Mapped[int] = mapped_column(default=0)
    currency: Mapped[str] = mapped_column(String(10), default="usd")
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship()  # noqa: F821
    center: Mapped["RehabCenter"] = relationship(back_populates="upsell_orders")  # noqa: F821
