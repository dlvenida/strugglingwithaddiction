from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.billing import Subscription
from app.models.rehab import RehabCenter
from app.models.user import User
from app.schemas.rehab import RehabCenterPublic
from app.services.storage import resolve_image_url


def center_has_active_subscription(db: Session, center: RehabCenter) -> bool:
    if not center.owner_user_id:
        return False
    sub = db.query(Subscription).filter(Subscription.user_id == center.owner_user_id).first()
    # Preserve the paid listing while Stripe Smart Retries a failed renewal.
    return sub is not None and sub.status in ("active", "trialing", "past_due")


def center_to_public(db: Session, center: RehabCenter) -> RehabCenterPublic:
    premium = center.contact_visible or (
        center.claimed and center_has_active_subscription(db, center)
    )
    # When subscription lapses, public surface reverts to basic + claim CTA
    show_as_claimed = bool(premium)
    featured = bool(
        premium
        and center.featured_until
        and center.featured_until > datetime.now(timezone.utc)
    )
    return RehabCenterPublic(
        id=center.id,
        slug=center.slug,
        name=center.name,
        location=center.location_display,
        phone=center.phone if premium else None,
        website=center.website if premium else None,
        contact_email=center.contact_email if premium else None,
        image=resolve_image_url(center.image_key),
        specialties=center.specialties or [],
        description=center.description,
        rating=float(center.rating),
        claimed=show_as_claimed,
        verified_badge=bool(premium and center.verified_badge),
        featured=featured,
        insurances=(center.insurances or []) if premium else [],
        levels_of_care=(center.levels_of_care or []) if premium else [],
        amenities=(center.amenities or []) if premium else [],
        accreditations=(center.accreditations or []) if premium else [],
        google_maps_url=center.google_maps_url if premium else None,
        gallery_urls=[resolve_image_url(key) for key in (center.gallery_keys or [])] if premium else [],
        video_url=center.video_url if premium else None,
    )
