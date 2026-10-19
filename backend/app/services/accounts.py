from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import User


def grant_admin(user: User) -> None:
    if user.email in get_settings().admin_email_set:
        user.is_admin = True


async def user_for_email(session: AsyncSession, email: str) -> User:
    """The player with this (already verified) email, created on their first sign-in. Doesn't commit."""
    await session.execute(insert(User).values(email=email).on_conflict_do_nothing(index_elements=["email"]))
    user = await session.scalar(select(User).where(User.email == email))
    grant_admin(user)
    return user
