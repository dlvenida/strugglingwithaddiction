"""Delivery of facility callback codes through Twilio SMS or development logs."""
from __future__ import annotations

import base64
import logging
from urllib import parse, request

from app.config import get_settings

logger = logging.getLogger("swa")
settings = get_settings()


def send_callback_code(phone: str, code: str) -> None:
    message = f"Your Struggling With Addiction facility ownership confirmation code is {code}. It expires in 15 minutes."
    if not all((settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from_number)):
        logger.warning("PHONE_CALLBACK development delivery phone=%s code=%s", phone, code)
        return

    body = parse.urlencode({"To": phone, "From": settings.twilio_from_number, "Body": message}).encode()
    credentials = f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode()
    token = base64.b64encode(credentials).decode()
    req = request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
        data=body,
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=20) as response:
        if response.status >= 300:
            raise RuntimeError(f"Twilio returned HTTP {response.status}")
