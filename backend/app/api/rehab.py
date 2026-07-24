from datetime import datetime, timezone
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.api.rehab_helpers import center_to_public
from app.core.deps import AdminUser, ClientUser, CurrentUser, get_current_user_optional
from app.core.security import hash_password
from app.database import get_db
from app.models.profile import UserProfile
from app.models.rehab import (
    ClaimStatus,
    RehabCenter,
    RehabCenterClaim,
    ListingStatus,
    CenterSource,
)
from app.models.user import User, UserRole
from app.schemas.rehab import (
    ClaimAdmin,
    ClaimedClientAdmin,
    ClaimCreate,
    ClaimOut,
    ClaimReview,
    ClaimStatusPublic,
    CenterReviewsOut,
    ReviewItem,
    RehabCenterAdmin,
    RehabCenterCreate,
    RehabCenterPublic,
    RehabCenterUpdate,
)
from app.config import get_settings
from app.services.email import send_email
from app.services.google_reviews import fetch_google_reviews, normalize_manual_testimonials
from app.services.tickets import generate_claim_ticket

router = APIRouter(tags=["rehab"])
settings = get_settings()


def _landing_segment(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")


@router.get("/api/rehab-centers", response_model=list[RehabCenterPublic])
def list_centers(
    db: Annotated[Session, Depends(get_db)],
    state: str | None = Query(default=None, max_length=100),
    city: str | None = Query(default=None, max_length=100),
):
    query = db.query(RehabCenter).filter(RehabCenter.listing_status == ListingStatus.published, RehabCenter.deleted_at.is_(None))
    if state:
        query = query.filter(RehabCenter.state.ilike(state.strip()))
    if city:
        query = query.filter(RehabCenter.city.ilike(city.strip()))
    centers = query.order_by(RehabCenter.featured_until.desc().nullslast(), RehabCenter.name).all()
    return [center_to_public(db, c) for c in centers]


@router.get("/api/rehab-centers/landing/{state}/{city}/{facility}", response_model=RehabCenterPublic)
def get_claimed_center_landing(
    state: str,
    city: str,
    facility: str,
    db: Annotated[Session, Depends(get_db)],
):
    """Resolve canonical location URLs only for subscribed, claimed centers."""
    candidates = (
        db.query(RehabCenter)
        .filter(RehabCenter.listing_status == ListingStatus.published, RehabCenter.deleted_at.is_(None))
        .all()
    )
    center = next(
        (
            item
            for item in candidates
            if _landing_segment(item.state) == state
            and _landing_segment(item.city) == city
            and _landing_segment(item.name) == facility
        ),
        None,
    )
    if not center:
        raise HTTPException(status_code=404, detail="Claimed center landing page not found")
    public = center_to_public(db, center)
    if not public.claimed:
        raise HTTPException(status_code=404, detail="Claimed center landing page not found")
    return public


@router.get("/api/rehab-centers/{slug}", response_model=RehabCenterPublic)
def get_center(slug: str, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(
        RehabCenter.slug == slug,
        RehabCenter.listing_status == ListingStatus.published,
        RehabCenter.deleted_at.is_(None),
    ).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    return center_to_public(db, center)


@router.get("/api/rehab-centers/{slug}/reviews", response_model=CenterReviewsOut)
def get_center_reviews(slug: str, db: Annotated[Session, Depends(get_db)]):
    """Return Google Place reviews when configured, otherwise listing testimonials."""
    center = db.query(RehabCenter).filter(
        RehabCenter.slug == slug,
        RehabCenter.listing_status == ListingStatus.published,
        RehabCenter.deleted_at.is_(None),
    ).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")

    public = center_to_public(db, center)
    address = ", ".join(
        part for part in [center.address_line, center.city, center.state, center.zip] if part
    ) or public.location

    google = fetch_google_reviews(
        name=center.name,
        address=address,
        google_reviews_url=center.google_reviews_url,
        google_maps_url=center.google_maps_url,
    )
    if google and google.get("reviews"):
        return CenterReviewsOut(
            source="google",
            rating=google.get("rating") if google.get("rating") is not None else public.rating,
            user_ratings_total=google.get("user_ratings_total"),
            google_maps_url=google.get("google_maps_url") or public.google_maps_url,
            google_reviews_url=public.google_reviews_url or google.get("google_maps_url"),
            reviews=[ReviewItem(**item) for item in google["reviews"]],
        )

    manual = normalize_manual_testimonials(public.testimonials, default_rating=public.rating)
    return CenterReviewsOut(
        source="manual",
        rating=public.rating,
        user_ratings_total=len(manual) or None,
        google_maps_url=public.google_maps_url,
        google_reviews_url=public.google_reviews_url,
        reviews=[ReviewItem(**item) for item in manual],
    )


@router.post("/api/rehab/claims", response_model=ClaimOut)
def submit_claim(body: ClaimCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User | None, Depends(get_current_user_optional)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == body.rehab_center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    if center.claimed:
        raise HTTPException(status_code=400, detail="Center already claimed")
    ticket = generate_claim_ticket(db)
    claim = RehabCenterClaim(
        ticket_number=ticket,
        rehab_center_id=center.id,
        submitter_user_id=user.id if user else None,
        full_name=body.full_name,
        job_title=body.job_title,
        work_email=body.work_email.lower(),
        phone=body.phone,
        affiliation_text=body.affiliation_text,
        facility_role=body.facility_role,
        business_license_url=body.business_license_url,
        proof_of_affiliation_url=body.proof_of_affiliation_url,
        status=ClaimStatus.pending,
    )
    db.add(claim)
    db.commit()
    return ClaimOut(
        ticket_number=ticket,
        status=ClaimStatus.pending,
        center_name=center.name,
        message="Your claim has been submitted. Save your ticket number for status updates.",
    )


@router.get("/api/rehab/claims/{ticket}", response_model=ClaimStatusPublic)
def claim_status(ticket: str, db: Annotated[Session, Depends(get_db)]):
    claim = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .filter(RehabCenterClaim.ticket_number == ticket.upper())
        .first()
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Ticket not found")
    messages = {
        ClaimStatus.pending: "Upload your rehab certification to continue.",
        ClaimStatus.under_review: "Your certification is under review.",
        ClaimStatus.certified: "Verified — subscribe ($9.99/mo or $99/yr) to claim your listing.",
        ClaimStatus.approved: "Claimed and active. Log in to manage your listing.",
        ClaimStatus.rejected: "Your claim was not approved. Contact support for details.",
        ClaimStatus.abandoned: "This claim expired. Start again from the listing page.",
    }
    return ClaimStatusPublic(
        ticket_number=claim.ticket_number,
        status=claim.status,
        center_name=claim.center.name,
        submitted_at=claim.created_at,
        reviewed_at=claim.reviewed_at,
        message=messages.get(claim.status, ""),
        certification_uploaded=bool(claim.business_license_url),
        email_domain_matched=bool(claim.email_domain_matched),
        phone_verified=bool(claim.phone_verified_at),
    )


@router.get("/api/admin/rehab-centers", response_model=list[RehabCenterAdmin])
def admin_list_centers(_: AdminUser, db: Annotated[Session, Depends(get_db)], trash: bool = Query(False)):
    from app.services.storage import resolve_image_url
    q = db.query(RehabCenter)
    q = q.filter(RehabCenter.deleted_at.isnot(None) if trash else RehabCenter.deleted_at.is_(None))
    centers = q.order_by(RehabCenter.updated_at.desc()).all()
    result = []
    for c in centers:
        item = RehabCenterAdmin.model_validate(c)
        item.image_url = resolve_image_url(c.image_key)
        result.append(item)
    return result


@router.get("/api/admin/rehab-centers/{center_id}", response_model=RehabCenterAdmin)
def admin_get_center(center_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    from app.services.storage import resolve_image_url
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    item = RehabCenterAdmin.model_validate(center)
    item.image_url = resolve_image_url(center.image_key)
    return item


@router.post("/api/admin/rehab-centers", response_model=RehabCenterAdmin, status_code=201)
def create_center(body: RehabCenterCreate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    if db.query(RehabCenter).filter(RehabCenter.slug == body.slug).first():
        raise HTTPException(status_code=400, detail="Slug exists")
    center = RehabCenter(**body.model_dump())
    if center.listing_status == ListingStatus.published and not center.published_at:
        center.published_at = body.published_at or datetime.now(timezone.utc)
    db.add(center)
    db.commit()
    db.refresh(center)
    out = RehabCenterAdmin.model_validate(center)
    return out


@router.patch("/api/admin/rehab-centers/{center_id}", response_model=RehabCenterAdmin)
def update_center(center_id: int, body: RehabCenterUpdate, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(center, k, v)
    if body.listing_status == ListingStatus.published and center.published_at is None:
        center.published_at = body.published_at if body.published_at is not None else datetime.now(timezone.utc)
    db.commit()
    db.refresh(center)
    return RehabCenterAdmin.model_validate(center)


@router.delete("/api/admin/rehab-centers/{center_id}", status_code=204)
def trash_center(center_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    if center.deleted_at:
        raise HTTPException(status_code=400, detail="Already in trash")
    center.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/api/admin/rehab-centers/{center_id}/restore", response_model=RehabCenterAdmin)
def restore_center(center_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    center.deleted_at = None
    db.commit()
    db.refresh(center)
    return RehabCenterAdmin.model_validate(center)


@router.delete("/api/admin/rehab-centers/{center_id}/permanent", status_code=204)
def permanent_delete_center(center_id: int, _: AdminUser, db: Annotated[Session, Depends(get_db)]):
    center = db.query(RehabCenter).filter(RehabCenter.id == center_id).first()
    if not center:
        raise HTTPException(status_code=404, detail="Center not found")
    if not center.deleted_at:
        raise HTTPException(status_code=400, detail="Move to trash first")
    db.delete(center)
    db.commit()


@router.get("/api/admin/claims", response_model=list[ClaimAdmin])
def list_claims(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    claims = db.query(RehabCenterClaim).options(joinedload(RehabCenterClaim.center)).order_by(RehabCenterClaim.created_at.desc()).all()
    return [
        ClaimAdmin(
            id=c.id,
            ticket_number=c.ticket_number,
            rehab_center_id=c.rehab_center_id,
            center_name=c.center.name,
            status=c.status,
            full_name=c.full_name,
            job_title=c.job_title,
            work_email=c.work_email,
            phone=c.phone,
            affiliation_text=c.affiliation_text,
            facility_role=c.facility_role,
            business_license_url=c.business_license_url,
            proof_of_affiliation_url=c.proof_of_affiliation_url,
            email_domain_matched=bool(c.email_domain_matched),
            cert_verified_at=c.cert_verified_at,
            admin_notes=c.admin_notes,
            created_at=c.created_at,
            reviewed_at=c.reviewed_at,
        )
        for c in claims
    ]


@router.get("/api/admin/claimed-clients", response_model=list[ClaimedClientAdmin])
def list_claimed_clients(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    centers = (
        db.query(RehabCenter)
        .filter(RehabCenter.claimed.is_(True), RehabCenter.deleted_at.is_(None))
        .order_by(RehabCenter.updated_at.desc())
        .all()
    )
    result: list[ClaimedClientAdmin] = []
    for center in centers:
        approved = (
            db.query(RehabCenterClaim)
            .filter(
                RehabCenterClaim.rehab_center_id == center.id,
                RehabCenterClaim.status == ClaimStatus.approved,
            )
            .order_by(RehabCenterClaim.reviewed_at.desc())
            .first()
        )
        owner = db.query(User).filter(User.id == center.owner_user_id).first() if center.owner_user_id else None
        profile = db.query(UserProfile).filter(UserProfile.user_id == owner.id).first() if owner else None
        result.append(
            ClaimedClientAdmin(
                rehab_center_id=center.id,
                center_name=center.name,
                location_display=center.location_display or "",
                listing_status=center.listing_status,
                client_user_id=owner.id if owner else None,
                client_name=(profile.display_name if profile else None) or (approved.full_name if approved else None),
                client_email=owner.email if owner else (approved.work_email if approved else None),
                client_active=owner.is_active if owner else None,
                ticket_number=approved.ticket_number if approved else None,
                job_title=approved.job_title if approved else None,
                phone=approved.phone if approved else center.phone,
                claimed_at=(approved.reviewed_at if approved else center.updated_at),
            )
        )
    return result


@router.patch("/api/admin/claims/{claim_id}", response_model=ClaimAdmin)
def review_claim(claim_id: int, body: ClaimReview, admin: AdminUser, db: Annotated[Session, Depends(get_db)]):
    claim = db.query(RehabCenterClaim).options(joinedload(RehabCenterClaim.center)).filter(RehabCenterClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    claim.status = body.status
    claim.admin_notes = body.admin_notes
    claim.reviewed_by_id = admin.id
    claim.reviewed_at = datetime.now(timezone.utc)
    center = claim.center
    now = datetime.now(timezone.utc)

    def ensure_client_user() -> User | None:
        email = claim.work_email.lower()
        user = db.query(User).filter(User.email == email).first()
        if not user and body.create_client_user and body.client_password:
            user = User(
                email=email,
                password_hash=hash_password(body.client_password),
                role=UserRole.client,
                is_active=False,
            )
            db.add(user)
            db.flush()
            db.add(UserProfile(user_id=user.id, display_name=claim.full_name, slug=f"center-{center.id}-{user.id}"))
        if user:
            center.owner_user_id = user.id
            claim.submitter_user_id = user.id
        return user

    if body.status == ClaimStatus.certified:
        if not claim.business_license_url:
            raise HTTPException(status_code=400, detail="No certification uploaded yet")
        if not claim.email_domain_matched:
            raise HTTPException(status_code=400, detail="Claimant work email does not match the center website domain")
        if not claim.phone_verified_at:
            raise HTTPException(status_code=400, detail="Facility phone callback must be verified before certification approval")
        claim.cert_verified_at = now
        center.cert_verified_at = now
        ensure_client_user()
        # Ownership reserved but listing not claimed until Stripe payment
        center.claimed = False
        center.contact_visible = False
    elif body.status == ClaimStatus.approved:
        # Legacy path — prefer payment webhook; still allow admin force-approve
        ensure_client_user()
        center.claimed = True
        center.contact_visible = True
        if claim.cert_verified_at is None:
            claim.cert_verified_at = now
            center.cert_verified_at = now
    elif body.status == ClaimStatus.rejected:
        pass
    db.commit()
    db.refresh(claim)

    claim_url = f"{settings.public_site_url}/claim-status/{claim.ticket_number}"
    if body.status == ClaimStatus.certified and claim.work_email:
        send_email(
            db,
            to_email=claim.work_email,
            template_key="claim_certified",
            context={
                "name": claim.full_name,
                "center_name": center.name,
                "ticket": claim.ticket_number,
                "claim_url": claim_url,
                "billing_url": f"{settings.admin_site_url}/client/billing",
            },
            user_id=claim.submitter_user_id,
            rehab_center_id=center.id,
        )
    elif body.status == ClaimStatus.approved and claim.work_email:
        send_email(
            db,
            to_email=claim.work_email,
            template_key="welcome",
            context={
                "name": claim.full_name,
                "center_name": center.name,
                "login_url": f"{settings.admin_site_url}/login",
                "billing_url": f"{settings.admin_site_url}/client/billing",
                "receipt_url": f"{settings.admin_site_url}/client/billing",
                "support_email": settings.email_from,
            },
            user_id=claim.submitter_user_id,
            rehab_center_id=center.id,
        )
    elif body.status == ClaimStatus.rejected and claim.work_email:
        send_email(
            db,
            to_email=claim.work_email,
            template_key="claim_rejected",
            context={
                "name": claim.full_name,
                "center_name": center.name,
                "ticket": claim.ticket_number,
                "admin_notes": (claim.admin_notes or body.admin_notes or "Please contact support if you believe this was in error."),
                "support_email": settings.email_from,
            },
            user_id=claim.submitter_user_id,
            rehab_center_id=center.id,
        )

    return ClaimAdmin(
        id=claim.id,
        ticket_number=claim.ticket_number,
        rehab_center_id=claim.rehab_center_id,
        center_name=center.name,
        status=claim.status,
        full_name=claim.full_name,
        job_title=claim.job_title,
        work_email=claim.work_email,
        phone=claim.phone,
        affiliation_text=claim.affiliation_text,
        facility_role=claim.facility_role,
        business_license_url=claim.business_license_url,
        proof_of_affiliation_url=claim.proof_of_affiliation_url,
        email_domain_matched=bool(claim.email_domain_matched),
        cert_verified_at=claim.cert_verified_at,
        admin_notes=claim.admin_notes,
        created_at=claim.created_at,
        reviewed_at=claim.reviewed_at,
    )


# GET /api/client/my-center is provided by leads_upsells (enriched with completeness)
