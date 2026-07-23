"""Transactional email sender for claim-to-subscription lifecycle."""
from __future__ import annotations

import json
import logging
import smtplib
from email.message import EmailMessage
from typing import Any
from urllib import error, request

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.email_log import EmailLog
from app.models.profile import UserProfile

logger = logging.getLogger("swa")
settings = get_settings()

TEMPLATES: dict[str, tuple[str, str]] = {
    "outreach_invite": (
        "Your center is listed on Struggling With Addiction — claim it today",
        "Hi,\n\nYour facility appears in our directory at {listing_url}.\n\n"
        "Claim your listing to manage your profile and receive visitor inquiries:\n{claim_url}\n\n"
        "— Struggling With Addiction\n{postal_address}\nUnsubscribe: {unsubscribe_url}\n",
    ),
    "verification": (
        "Upload rehab certification to confirm your claim",
        "Hi {name},\n\nWe received your claim for {center_name} (ticket {ticket}).\n\n"
        "Please upload your state license or accreditation certificate here:\n{claim_url}\n\n"
        "Edit rights unlock after verification and subscription.\n",
    ),
    "welcome": (
        "Welcome — your listing is claimed",
        "Hi {name},\n\nPayment received. Your listing {center_name} is now claimed.\n\n"
        "One-click login: {login_url}\nGetting started checklist: complete your profile, add media, "
        "services, insurances, and levels of care.\n\n"
        "Billing portal: {billing_url}\nReceipt: {receipt_url}\nSupport: {support_email}\n",
    ),
    "dunning": (
        "Update payment before your listing downgrades",
        "Hi {name},\n\nWe could not renew your subscription for {center_name}.\n\n"
        "Update your card here before access ends: {billing_url}\n",
    ),
    "cancellation": (
        "Your subscription cancellation is confirmed",
        "Hi {name},\n\nYour subscription for {center_name} will end on {access_end}.\n\n"
        "Until then you keep full access. After that the listing reverts to the basic view.\n"
        "Resubscribe anytime: {billing_url}\n",
    ),
    "win_back": (
        "Resubscribe — everything restores instantly",
        "Hi {name},\n\nYour listing {center_name} is back on the basic view.\n\n"
        "Resubscribe to restore your full profile and dashboard: {billing_url}\n",
    ),
    "password_reset": (
        "Reset your password",
        "Hi {name},\n\nUse this secure link to set a new password:\n{reset_url}\n\n"
        "If you did not request this, ignore this email.\n",
    ),
    "email_confirmation": (
        "Confirm your email address",
        "Hi {name},\n\nConfirm your email address to secure your account:\n{confirmation_url}\n\n"
        "This link expires in one hour.\n",
    ),
    "new_lead_alert": (
        "New inquiry for {center_name}",
        "You have a new lead.\n\nName: {lead_name}\nEmail: {lead_email}\nPhone: {lead_phone}\n"
        "Message:\n{lead_message}\n\nSource: {source_url}\nOpen inbox: {inbox_url}\n",
    ),
    "lead_reply": (
        "{center_name} replied to your inquiry",
        "Hi {lead_name},\n\n{reply_message}\n\n— {center_name}\n",
    ),
    "payment_receipt": (
        "Receipt for your Struggling With Addiction subscription",
        "Hi {name},\n\nThanks for your payment of {amount} for {center_name}.\n\n"
        "View receipt: {receipt_url}\nManage billing: {billing_url}\n",
    ),
    "profile_published": (
        "Your listing changes are live",
        "Hi {name},\n\nUpdates to {center_name} are now published:\n{listing_url}\n",
    ),
    "renewal_reminder": (
        "Your card will be charged soon",
        "Hi {name},\n\nYour subscription for {center_name} renews on {renewal_date}.\n\n"
        "Manage billing: {billing_url}\n",
    ),
    "claim_abandon_reminder": (
        "Finish claiming {center_name}",
        "Hi {name},\n\nYou started a claim for {center_name} but did not finish.\n\n"
        "Continue here: {claim_url}\n",
    ),
    "upsell_human_lead": (
        "Hot content upsell lead — {product_label}",
        "Internal alert: {name} ({email}) purchased interest in {product_label} for {center_name}.\n"
        "Order id: {order_id}\nRoute to senior / PJ to close.\n",
    ),
}

PREFERENCE_BY_TEMPLATE = {
    "new_lead_alert": "lead_alerts",
    "dunning": "billing_alerts",
    "cancellation": "billing_alerts",
    "payment_receipt": "billing_alerts",
    "renewal_reminder": "renewal_reminders",
}


def _send_smtp(to_email: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.email_from
    msg["To"] = to_email
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


def _send_resend(to_email: str, subject: str, body: str) -> None:
    payload = json.dumps(
        {
            "from": settings.email_from,
            "to": [to_email],
            "subject": subject,
            "text": body,
        }
    ).encode("utf-8")
    req = request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=20) as resp:
        if resp.status >= 300:
            raise RuntimeError(f"Resend HTTP {resp.status}")


def send_email(
    db: Session | None,
    *,
    to_email: str,
    template_key: str,
    context: dict[str, Any] | None = None,
    user_id: int | None = None,
    rehab_center_id: int | None = None,
) -> bool:
    context = context or {}
    defaults = {
        "name": "there",
        "center_name": "your center",
        "ticket": "",
        "listing_url": settings.public_site_url,
        "claim_url": settings.public_site_url,
        "login_url": f"{settings.admin_site_url}/login",
        "billing_url": f"{settings.admin_site_url}/client/billing",
        "receipt_url": f"{settings.admin_site_url}/client/billing",
        "support_email": settings.email_from,
        "postal_address": settings.postal_address,
        "unsubscribe_url": f"{settings.public_site_url}/privacy",
        "verify_url": settings.admin_site_url,
        "confirmation_url": settings.admin_site_url,
        "reset_url": settings.admin_site_url,
        "inbox_url": f"{settings.admin_site_url}/client/leads",
        "lead_name": "",
        "lead_email": "",
        "lead_phone": "",
        "lead_message": "",
        "reply_message": "",
        "source_url": "",
        "amount": "$9.99",
        "access_end": "",
        "renewal_date": "",
        "product_label": "",
        "email": to_email,
        "order_id": "",
    }
    defaults.update({k: v for k, v in context.items() if v is not None})

    if template_key not in TEMPLATES:
        logger.warning("Unknown email template %s", template_key)
        return False

    preference = PREFERENCE_BY_TEMPLATE.get(template_key)
    if preference and db is not None and user_id:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if profile and (profile.notification_preferences or {}).get(preference) is False:
            db.add(
                EmailLog(
                    to_email=to_email,
                    template_key=template_key,
                    subject=TEMPLATES[template_key][0],
                    status="skipped",
                    error=f"{preference} disabled by user",
                    user_id=user_id,
                    rehab_center_id=rehab_center_id,
                )
            )
            db.commit()
            return False

    subject_tmpl, body_tmpl = TEMPLATES[template_key]
    try:
        subject = subject_tmpl.format(**defaults)
        body = body_tmpl.format(**defaults)
    except KeyError as exc:
        logger.exception("Email template context missing %s", exc)
        return False

    status = "sent"
    err_text = None
    try:
        if settings.resend_api_key:
            _send_resend(to_email, subject, body)
        elif settings.smtp_host:
            _send_smtp(to_email, subject, body)
        else:
            status = "skipped"
            logger.info("EMAIL[%s] to=%s subject=%s\n%s", template_key, to_email, subject, body)
    except Exception as exc:  # noqa: BLE001
        status = "failed"
        err_text = str(exc)
        logger.exception("Failed sending email %s to %s", template_key, to_email)

    if db is not None:
        db.add(
            EmailLog(
                to_email=to_email,
                template_key=template_key,
                subject=subject,
                status=status,
                error=err_text,
                user_id=user_id,
                rehab_center_id=rehab_center_id,
                meta_json=json.dumps(defaults, default=str)[:4000],
            )
        )
        try:
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
            logger.exception("Failed to persist email log")

    return status == "sent" or status == "skipped"
