import logging

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)


async def send_otp_email(email: str, code: str) -> None:
    s = get_settings()
    if not s.resend_api_key:
        # Dev mode: no email provider configured, so print the code for local testing.
        log.warning("DEV login code for %s: %s", email, code)
        return

    minutes = s.otp_ttl_minutes
    body = {
        "from": s.email_from,
        "to": [email],
        "subject": f"{code} is your Communitie Racing login code",
        "text": f"Your login code is {code}. It expires in {minutes} minutes.\n\n"
        "If you didn't ask for this, you can ignore this email.",
        "html": f"<p>Your login code is</p><p style='font-size:28px;font-weight:700;letter-spacing:6px'>{code}</p>"
        f"<p>It expires in {minutes} minutes. If you didn't ask for this, you can ignore this email.</p>",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.resend.com/emails", json=body, headers={"Authorization": f"Bearer {s.resend_api_key}"}
        )
    if r.status_code >= 300:
        log.error("Resend rejected login email for %s: %s %s", email, r.status_code, r.text[:300])
        raise RuntimeError("email send failed")
