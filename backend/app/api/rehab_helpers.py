from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.billing import Subscription
from app.models.insurance import InsuranceCatalog
from app.models.rehab import RehabCenter
from app.schemas.rehab import InsuranceDetail, RehabCenterPublic
from app.services.storage import resolve_image_url


def center_has_active_subscription(db: Session, center: RehabCenter) -> bool:
    if not center.owner_user_id:
        return False
    sub = db.query(Subscription).filter(Subscription.user_id == center.owner_user_id).first()
    # Preserve the paid listing while Stripe Smart Retries a failed renewal.
    return sub is not None and sub.status in ("active", "trialing", "past_due")


def _norm(value: str) -> str:
    return " ".join(str(value or "").lower().replace("-", " ").split())


def resolve_insurance_details(db: Session, names: list[str] | None) -> list[InsuranceDetail]:
    """Map free-text insurance names to catalog rows (logos) when possible."""
    if not names:
        return []
    catalog = db.query(InsuranceCatalog).filter(InsuranceCatalog.enabled.is_(True)).all()
    by_name = {_norm(row.name): row for row in catalog}
    by_slug = {_norm(row.slug): row for row in catalog}
    # Common aliases
    aliases = {
        "blue cross": "blue cross blue shield",
        "bluecross blueshield": "blue cross blue shield",
        "bcbs": "blue cross blue shield",
        "united healthcare": "unitedhealthcare",
        "united health": "unitedhealthcare",
        "uhc": "unitedhealthcare",
        "private pay": "private pay",
        "self-pay": "self pay",
        "selfpay": "self pay",
        "most major insurance": None,
    }
    details: list[InsuranceDetail] = []
    seen: set[str] = set()
    for raw in names:
        key = _norm(raw)
        if not key or key in seen:
            continue
        seen.add(key)
        alias = aliases.get(key, key)
        if alias is None:
            details.append(InsuranceDetail(name=raw, slug=None, logo_url=None))
            continue
        row = by_name.get(alias) or by_slug.get(alias.replace(" ", "-")) or by_name.get(key) or by_slug.get(key)
        if row:
            path = row.logo_path or ""
            logo = path if path.startswith("/") or path.startswith("http") else f"/{path}"
            details.append(InsuranceDetail(name=row.name, slug=row.slug, logo_url=logo))
        else:
            details.append(InsuranceDetail(name=raw, slug=None, logo_url=None))
    return details


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
    insurance_names = (center.insurances or []) if premium else []
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
        insurances=insurance_names,
        insurance_details=resolve_insurance_details(db, insurance_names) if premium else [],
        levels_of_care=(center.levels_of_care or []) if premium else [],
        amenities=(center.amenities or []) if premium else [],
        accreditations=(center.accreditations or []) if premium else [],
        google_maps_url=center.google_maps_url if premium else None,
        gallery_urls=[resolve_image_url(key) for key in (center.gallery_keys or [])] if premium else [],
        video_url=center.video_url if premium else None,
        address_line=center.address_line if premium else None,
        city=center.city if premium else None,
        state=center.state if premium else None,
        zip=center.zip if premium else None,
        google_reviews_url=center.google_reviews_url if premium else None,
        testimonials=(center.testimonials or []) if premium else [],
    )
