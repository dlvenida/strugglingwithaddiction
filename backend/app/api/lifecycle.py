"""Admin-operated lifecycle runbook endpoint.

Call this from a scheduled job once daily, or from the dashboard when testing.
"""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.api.claim_journey import schedule_abandon_reminder
from app.config import get_settings
from app.core.deps import AdminUser
from app.database import get_db
from app.models.billing import Subscription
from app.models.email_log import EmailLog
from app.models.rehab import RehabCenterClaim
from app.services.email import send_email

router = APIRouter(prefix="/api/admin/lifecycle", tags=["lifecycle"])
settings = get_settings()


@router.post("/run")
def run_lifecycle(_: AdminUser, db: Annotated[Session, Depends(get_db)]):
    return run_lifecycle_jobs(db)


def run_lifecycle_jobs(db: Session) -> dict:
    """Idempotent lifecycle work callable by the scheduler and the admin dashboard."""
    reminders = 0
    claims = (
        db.query(RehabCenterClaim)
        .options(joinedload(RehabCenterClaim.center))
        .filter(RehabCenterClaim.reminder_sent_at.is_(None))
        .all()
    )
    for claim in claims:
        before = claim.reminder_sent_at
        schedule_abandon_reminder(db, claim)
        if not before and claim.reminder_sent_at:
            reminders += 1

    renewal_reminders = 0
    now = datetime.now(timezone.utc)
    subs = (
        db.query(Subscription)
        .filter(
            Subscription.status.in_(("active", "trialing")),
            Subscription.current_period_end.isnot(None),
            Subscription.current_period_end >= now,
            Subscription.current_period_end <= now + timedelta(days=7),
        )
        .all()
    )
    for sub in subs:
        if not sub.user:
            continue
        already_sent = (
            db.query(EmailLog)
            .filter(
                EmailLog.user_id == sub.user_id,
                EmailLog.template_key == "renewal_reminder",
                EmailLog.created_at >= now - timedelta(days=25),
                EmailLog.status == "sent",
            )
            .first()
        )
        if already_sent:
            continue
        center = sub.user.owned_center
        if send_email(
            db,
            to_email=sub.user.email,
            template_key="renewal_reminder",
            context={
                "name": sub.user.email,
                "center_name": center.name if center else "your center",
                "renewal_date": sub.current_period_end.strftime("%B %-d, %Y"),
                "billing_url": f"{settings.admin_site_url}/client/billing",
            },
            user_id=sub.user_id,
            rehab_center_id=center.id if center else None,
        ):
            renewal_reminders += 1
    return {
        "claim_abandon_reminders": reminders,
        "renewal_reminders": renewal_reminders,
        "note": "Schedule POST /api/admin/lifecycle/run once per day using an authenticated admin automation.",
    }
