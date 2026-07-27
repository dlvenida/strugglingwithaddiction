from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import create_action_token, decode_token
from app.core.deps import AdminUser
from app.database import get_db
from app.models.rehab import RehabCenter
from app.services.email import send_email
from app.services.samhsa_import import CSV_HEADERS, build_template_csv, import_centers_csv

router = APIRouter(tags=["import"])
settings = get_settings()


class ImportSummary(BaseModel):
    created: int
    updated: int
    skipped: int
    total_rows: int
    errors: list[str] = Field(default_factory=list)
    headers: list[str] = Field(default_factory=lambda: list(CSV_HEADERS))


class OutreachResult(BaseModel):
    sent: int
    skipped: int
    errors: list[str] = Field(default_factory=list)


@router.get("/api/admin/import/template")
def download_import_template(_: AdminUser):
    csv_text = build_template_csv()
    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="samhsa-listing-import-template.csv"'},
    )


@router.get("/api/admin/import/columns")
def import_columns(_: AdminUser):
    return {
        "headers": CSV_HEADERS,
        "required": ["name"],
        "notes": [
            "List columns (specialties, levels_of_care, insurances, amenities, accreditations) use | or ; separators.",
            "Upsert key: samhsa_id when present; otherwise name + city + state.",
            "Imported rows publish as basic unclaimed listings (claim CTA enabled).",
        ],
    }


@router.post("/api/admin/import/centers", response_model=ImportSummary)
async def import_centers_csv_endpoint(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
    publish: bool = True,
):
    content = await file.read()
    result = import_centers_csv(db, content, publish=publish)
    return ImportSummary(
        created=result.created,
        updated=result.updated,
        skipped=result.skipped,
        total_rows=result.total_rows,
        errors=result.errors[:50],
    )


@router.post("/api/admin/import/outreach", response_model=OutreachResult)
def send_outreach_invites(_: AdminUser, db: Annotated[Session, Depends(get_db)], limit: int = 100):
    """Send claim-invite emails to imported centers that have outreach_email set."""
    centers = (
        db.query(RehabCenter)
        .filter(
            RehabCenter.outreach_email.isnot(None),
            RehabCenter.outreach_unsubscribed_at.is_(None),
            RehabCenter.claimed.is_(False),
            RehabCenter.deleted_at.is_(None),
        )
        .order_by(RehabCenter.id)
        .limit(min(limit, 500))
        .all()
    )
    sent = 0
    skipped = 0
    errors: list[str] = []
    for center in centers:
        email = (center.outreach_email or "").strip()
        if not email or "@" not in email:
            skipped += 1
            continue
        listing_url = f"{settings.public_site_url}/rehab-centers/{center.slug}"
        unsubscribe_token = create_action_token(str(center.id), "outreach_unsubscribe", expires_minutes=60 * 24 * 365 * 5)
        ok = send_email(
            db,
            to_email=email,
            template_key="outreach_invite",
            context={
                "center_name": center.name,
                "listing_url": listing_url,
                "claim_url": listing_url,
                "unsubscribe_url": f"{settings.public_site_url}/unsubscribe?token={unsubscribe_token}",
            },
            rehab_center_id=center.id,
        )
        if ok:
            sent += 1
        else:
            errors.append(f"{center.name}: send failed")
    return OutreachResult(sent=sent, skipped=skipped, errors=errors[:20])


@router.get("/api/outreach/unsubscribe")
def unsubscribe_outreach(token: str, db: Annotated[Session, Depends(get_db)]):
    payload = decode_token(token)
    if not payload or payload.get("type") != "action" or payload.get("action") != "outreach_unsubscribe":
        return {"message": "This unsubscribe link is invalid or expired."}
    center = db.query(RehabCenter).filter(RehabCenter.id == int(payload.get("sub", 0))).first()
    if not center:
        return {"message": "This unsubscribe link is invalid."}
    center.outreach_unsubscribed_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "You will no longer receive listing outreach emails."}
