import asyncio

import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import normalize_email
from app.models import User
from app.services.accounts import grant_admin, user_for_email

GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")

# Google rotates its signing keys every few days; they're fetched once and cached between sign-ins.
_jwks = jwt.PyJWKClient(GOOGLE_CERTS, cache_keys=True, lifespan=3600, timeout=10)


class GoogleAuthError(Exception):
    def __init__(self, message: str, status: int = 401):
        super().__init__(message)
        self.status = status


def _signing_key(token: str):
    return _jwks.get_signing_key_from_jwt(token).key


def _claims(token: str, client_id: str) -> dict:
    return jwt.decode(
        token,
        _signing_key(token),
        algorithms=["RS256"],
        audience=client_id,
        issuer=GOOGLE_ISSUERS,
        leeway=30,
        options={"require": ["exp", "iat", "iss", "aud", "sub", "email"]},
    )


def _google_owns_address(email: str, claims: dict) -> bool:
    # Google only vouches that the person still holds the address for Gmail and for its
    # Workspace domains (the `hd` claim). Any other address was checked once, when the Google
    # account was made, and may have changed hands since.
    return email.endswith(("@gmail.com", "@googlemail.com")) or bool(claims.get("hd"))


async def sign_in_with_google(session: AsyncSession, credential: str) -> User:
    """Check the ID token from the "Continue with Google" button. Returns the (possibly new) user."""
    client_id = get_settings().google_client_id
    if not client_id:
        raise GoogleAuthError("Google sign-in isn't set up.", 404)
    try:
        # The first sign-in after a restart fetches Google's keys over the network; keep it off the event loop.
        claims = await asyncio.to_thread(_claims, credential, client_id)
    except jwt.PyJWKClientConnectionError:
        raise GoogleAuthError("Couldn't reach Google. Try again in a minute.", 503)
    except jwt.PyJWTError:
        raise GoogleAuthError("Google sign-in didn't work. Try again.")
    if claims.get("email_verified") is not True:
        raise GoogleAuthError("Your Google account's email isn't verified. Log in with an email code instead.")

    sub, email = claims["sub"], normalize_email(claims["email"])
    user = await session.scalar(select(User).where(User.google_sub == sub))
    if user is None:
        existing = await session.scalar(select(User).where(User.email == email))
        if existing and not _google_owns_address(email, claims):
            raise GoogleAuthError("This email already has an account. Log in with an email code instead.", 409)
        # Links an email-code account to Google on first use (or replaces an older Google link).
        user = await user_for_email(session, email)
        user.google_sub = sub
    grant_admin(user)
    await session.commit()
    return user
