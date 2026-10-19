import html
import logging
from functools import lru_cache
from pathlib import Path
from string import Template

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)

_TEMPLATES = Path(__file__).resolve().parent.parent / "templates" / "email"
_FONT = "font-family:'Titillium Web',Arial,Helvetica,sans-serif"


@lru_cache
def _template(name: str) -> Template:
    return Template((_TEMPLATES / name).read_text(encoding="utf-8"))


def _brand(logo_url: str) -> str:
    # The white logo (733x224) at 36px tall; without a hosted copy, the name set in type instead.
    if logo_url:
        return (
            f'<img src="{html.escape(logo_url)}" width="118" height="36" alt="Communitie Racing" '
            'style="display:block;border:0;outline:none;height:36px;width:118px;">'
        )
    return f'<span style="{_FONT};font-size:18px;font-weight:700;letter-spacing:1px;color:#ffffff;">COMMUNITIE RACING</span>'


def login_email(code: str, minutes: int, logo_url: str) -> tuple[str, str]:
    """(html, text) for a login code email."""
    body = _template("login_code.html").substitute(code=code, minutes=minutes, brand=_brand(logo_url))
    text = (
        f"Your Communitie Racing login code is {code}\n\n"
        f"Enter it on the login page to take your place on the grid. "
        f"It expires in {minutes} minutes and works once.\n\n"
        "Didn't ask for this? You can ignore this email. Nobody can sign in without the code.\n\n"
        "Communitie Racing Quiz League"
    )
    return body, text


async def send_otp_email(email: str, code: str) -> None:
    s = get_settings()
    if not s.resend_api_key:
        # Dev mode: no email provider configured, so print the code for local testing.
        log.warning("DEV login code for %s: %s", email, code)
        return

    body_html, body_text = login_email(code, s.otp_ttl_minutes, s.email_logo_url)
    body = {
        "from": s.email_from,
        "to": [email],
        "subject": f"{code} is your Communitie Racing login code",
        "text": body_text,
        "html": body_html,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.resend.com/emails", json=body, headers={"Authorization": f"Bearer {s.resend_api_key}"}
        )
    if r.status_code >= 300:
        log.error("Resend rejected login email for %s: %s %s", email, r.status_code, r.text[:300])
        raise RuntimeError("email send failed")
