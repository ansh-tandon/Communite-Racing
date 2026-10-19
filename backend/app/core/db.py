from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def async_url(url: str) -> tuple[str, dict]:
    """Turn a Render/Neon-style postgres:// URL into an asyncpg URL plus connect args.

    asyncpg doesn't understand ?sslmode=..., so it's stripped and mapped to connect_args.
    """
    base, _, query = url.partition("?")
    base = base.replace("postgres://", "postgresql://", 1).replace("postgresql://", "postgresql+asyncpg://", 1)
    connect_args = {"ssl": "require"} if "sslmode=require" in query else {}
    return base, connect_args


def make_engine(url: str, nullpool: bool = False) -> AsyncEngine:
    dsn, connect_args = async_url(url)
    if nullpool:
        return create_async_engine(dsn, connect_args=connect_args, poolclass=NullPool)
    # One uvicorn worker on a 512 MB instance; 100 users never need more than this.
    return create_async_engine(dsn, connect_args=connect_args, pool_size=5, max_overflow=5, pool_pre_ping=True)


_settings = get_settings()
engine = make_engine(_settings.database_url, _settings.db_nullpool)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
