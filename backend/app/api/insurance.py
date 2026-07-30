"""USA insurance catalog — public list + admin enable/disable."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.bootstrap import seed_insurance_catalog
from app.core.deps import AdminUser
from app.database import get_db
from app.models.insurance import InsuranceCatalog

router = APIRouter(tags=["insurance"])


class InsuranceOut(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: str
    enabled: bool
    sort_order: int

    model_config = {"from_attributes": True}


class InsuranceAdminUpdate(BaseModel):
    enabled: bool | None = None
    sort_order: int | None = None
    name: str | None = Field(default=None, max_length=120)


def _logo_url(path: str) -> str:
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://") or path.startswith("/"):
        return path
    return f"/{path.lstrip('/')}"


def to_out(row: InsuranceCatalog) -> InsuranceOut:
    return InsuranceOut(
        id=row.id,
        name=row.name,
        slug=row.slug,
        logo_url=_logo_url(row.logo_path),
        enabled=row.enabled,
        sort_order=row.sort_order,
    )


@router.get("/api/insurances", response_model=list[InsuranceOut])
def list_enabled_insurances(db: Annotated[Session, Depends(get_db)]):
    rows = (
        db.query(InsuranceCatalog)
        .filter(InsuranceCatalog.enabled.is_(True))
        .order_by(InsuranceCatalog.sort_order.asc(), InsuranceCatalog.name.asc())
        .all()
    )
    return [to_out(r) for r in rows]


@router.get("/api/admin/insurances", response_model=list[InsuranceOut])
def list_admin_insurances(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    rows = (
        db.query(InsuranceCatalog)
        .order_by(InsuranceCatalog.sort_order.asc(), InsuranceCatalog.name.asc())
        .all()
    )
    return [to_out(r) for r in rows]


@router.patch("/api/admin/insurances/{insurance_id}", response_model=InsuranceOut)
def update_insurance(
    insurance_id: int,
    body: InsuranceAdminUpdate,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    row = db.query(InsuranceCatalog).filter(InsuranceCatalog.id == insurance_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Insurance not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return to_out(row)


@router.post("/api/admin/insurances/bulk")
def bulk_toggle_insurances(
    body: dict,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Body: { enabled: bool, ids?: number[] }. If ids omitted, apply to all."""
    enabled = body.get("enabled")
    if enabled is None:
        raise HTTPException(status_code=400, detail="enabled is required")
    q = db.query(InsuranceCatalog)
    ids = body.get("ids")
    if ids:
        q = q.filter(InsuranceCatalog.id.in_(ids))
    updated = q.update({InsuranceCatalog.enabled: bool(enabled)}, synchronize_session=False)
    db.commit()
    return {"updated": updated, "enabled": bool(enabled)}


class InsuranceSeedResult(BaseModel):
    created: int
    updated: int
    total: int


@router.post("/api/admin/insurances/seed", response_model=InsuranceSeedResult)
def reseed_insurances(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    """Insert missing USA catalog rows and refresh name/logo/sort for existing slugs."""
    return seed_insurance_catalog(db)
