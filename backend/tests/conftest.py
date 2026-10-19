"""Tests run against a real Postgres database named <your db>_test, created and reset automatically."""

import asyncio
import os
from urllib.parse import urlsplit

import pytest

# Point the app at the test database before anything imports app.core.db.
os.environ.setdefault("JWT_SECRET", "test-secret")
from app.core.config import Settings  # noqa: E402

_base = os.environ.get("TEST_DATABASE_URL") or Settings().database_url
_parts = urlsplit(_base)
_test_db = _parts.path.strip("/").split("?")[0] + "_test"
os.environ["DATABASE_URL"] = _parts._replace(path="/" + _test_db).geturl()
os.environ["DB_NULLPOOL"] = "true"
os.environ["RESEND_API_KEY"] = ""
os.environ["ADMIN_EMAILS"] = "admin@example.com"
os.environ["FRONTEND_ORIGIN"] = "http://testserver"

import logging  # noqa: E402

import asyncpg  # noqa: E402
import httpx  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import models  # noqa: E402,F401
from app.core.db import Base, async_url, engine  # noqa: E402
from app.main import app  # noqa: E402

logging.getLogger("httpx").setLevel(logging.WARNING)


async def _create_schema() -> None:
    dsn = async_url(os.environ["DATABASE_URL"])[0].replace("+asyncpg", "")
    admin_dsn = dsn.rsplit("/", 1)[0] + "/postgres"
    conn = await asyncpg.connect(admin_dsn)
    try:
        if not await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", _test_db):
            await conn.execute(f'CREATE DATABASE "{_test_db}"')
    finally:
        await conn.close()
    async with engine.begin() as c:
        await c.run_sync(Base.metadata.drop_all)
        await c.run_sync(Base.metadata.create_all)
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def schema():
    asyncio.run(_create_schema())


@pytest.fixture(autouse=True)
async def clean_tables():
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    async with engine.begin() as c:
        await c.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def outbox(monkeypatch) -> dict[str, str]:
    """Captures login codes instead of emailing them: {email: latest code}."""
    sent: dict[str, str] = {}

    async def fake_send(email: str, code: str) -> None:
        sent[email] = code

    monkeypatch.setattr("app.api.auth.send_otp_email", fake_send)
    return sent


@pytest.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as c:
        yield c


@pytest.fixture
def login(client, outbox):
    """login("a@b.com") -> auth headers for that user."""

    async def _login(email: str) -> dict[str, str]:
        await client.post("/auth/otp/request", json={"email": email})
        r = await client.post("/auth/otp/verify", json={"email": email, "code": outbox[email.lower()]})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _login


# ---------- quiz helpers ----------

from datetime import timedelta  # noqa: E402

from sqlalchemy import update  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import utcnow  # noqa: E402
from app.models import Race  # noqa: E402

QUESTIONS = [
    {"prompt": "Who wins the race?", "type": "single", "weight": 10, "options": ["VER", "NOR", "LEC", "HAM"]},
    {"prompt": "Predict the podium", "type": "ranked", "weight": 15,
     "options": ["VER", "NOR", "LEC", "HAM", "PIA"], "config": {"pick": 3}},
    {"prompt": "Pick 3 drivers in the top 10 after lap 10", "type": "multi", "weight": 9,
     "options": ["VER", "NOR", "LEC", "HAM", "PIA", "ALO"], "config": {"pick": 3}},
    {"prompt": "Will there be a safety car?", "type": "yes_no", "weight": 5},
    {"prompt": "How many cars pit under the safety car?", "type": "number", "weight": 6,
     "config": {"min": 0, "max": 20, "tolerance": 1}},
]


@pytest.fixture
async def admin(login):
    return await login("admin@example.com")


@pytest.fixture
def make_race(client, admin):
    """make_race(round=1, open=True) -> race detail dict. Window: opened 1h ago, closes in 1h."""

    async def _make(round: int = 1, season: int = 2026, questions=None, open: bool = True, **extra) -> dict:
        now = utcnow()
        body = {"season": season, "round": round, "name": f"Test GP {round}", "circuit": "Test Circuit",
                "quiz_opens_at": (now - timedelta(hours=1)).isoformat(),
                "quiz_closes_at": (now + timedelta(hours=1)).isoformat(),
                "questions": QUESTIONS if questions is None else questions, **extra}
        r = await client.post("/admin/races", json=body, headers=admin)
        assert r.status_code == 201, r.text
        race = r.json()
        if open:
            assert (await client.post(f"/admin/races/{race['id']}/open", headers=admin)).status_code == 200
        return race

    return _make


async def set_window(race_id: int, opens_in: timedelta, closes_in: timedelta) -> None:
    """Move a race's quiz window relative to now (negative = in the past)."""
    now = utcnow()
    async with SessionLocal() as s:
        await s.execute(update(Race).where(Race.id == race_id)
                        .values(quiz_opens_at=now + opens_in, quiz_closes_at=now + closes_in))
        await s.commit()


async def deadline_passed(race_id: int) -> None:
    await set_window(race_id, timedelta(hours=-2), timedelta(seconds=-1))


def qids(race: dict) -> list[int]:
    return [q["id"] for q in race["questions"]]
