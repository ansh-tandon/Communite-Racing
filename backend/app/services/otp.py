from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_otp, new_otp, normalize_email, otp_matches, utcnow
from app.models import OtpCode, User


class OtpError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


async def issue_code(session: AsyncSession, email: str) -> str:
    """Store a new hashed code for this email and return the plain code for sending."""
    s = get_settings()
    email = normalize_email(email)
    now = utcnow()
    recent = await session.scalar(
        select(func.count()).where(OtpCode.email == email, OtpCode.created_at > now - timedelta(hours=1))
    )
    if recent >= s.otp_requests_per_hour:
        raise OtpError("Too many codes requested. Try again in an hour.", 429)

    code = new_otp()
    session.add(OtpCode(email=email, code_hash=hash_otp(email, code), expires_at=now + timedelta(minutes=s.otp_ttl_minutes)))
    await session.commit()
    return code


async def verify_code(session: AsyncSession, email: str, code: str) -> User:
    """Check the newest live code for this email. Returns the (possibly new) user."""
    s = get_settings()
    email = normalize_email(email)
    now = utcnow()

    # Row lock stops two parallel guesses sharing one attempt.
    otp = await session.scalar(
        select(OtpCode)
        .where(OtpCode.email == email, OtpCode.consumed_at.is_(None), OtpCode.expires_at > now)
        .order_by(OtpCode.id.desc())
        .limit(1)
        .with_for_update()
    )
    if otp is None:
        raise OtpError("This code has expired. Request a new one.")
    if otp.attempts >= s.otp_max_attempts:
        raise OtpError("Too many wrong tries. Request a new code.")
    if not otp_matches(email, code, otp.code_hash):
        otp.attempts += 1
        left = s.otp_max_attempts - otp.attempts
        await session.commit()
        raise OtpError(f"Wrong code. {left} {'try' if left == 1 else 'tries'} left." if left else "Too many wrong tries. Request a new code.")

    otp.consumed_at = now
    await session.execute(insert(User).values(email=email).on_conflict_do_nothing(index_elements=["email"]))
    user = await session.scalar(select(User).where(User.email == email))
    if email in s.admin_email_set:
        user.is_admin = True
    await session.commit()
    return user
