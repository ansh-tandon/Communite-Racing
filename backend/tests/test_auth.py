from datetime import timedelta

from sqlalchemy import update

from app.core.db import SessionLocal
from app.core.security import create_token, decode_token, utcnow
from app.models import OtpCode


async def test_login_happy_path(client, outbox):
    r = await client.post("/auth/otp/request", json={"email": "Lando@Example.com "})
    assert r.status_code == 202
    code = outbox["lando@example.com"]
    assert len(code) == 6 and code.isdigit()

    r = await client.post("/auth/otp/verify", json={"email": "lando@example.com", "code": code})
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == "lando@example.com"
    assert body["user"]["is_admin"] is False
    assert body["user"]["display_name"] is None

    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["email"] == "lando@example.com"


async def test_same_user_on_second_login(login, client):
    h1 = await login("max@example.com")
    h2 = await login("MAX@example.com")
    a = (await client.get("/auth/me", headers=h1)).json()
    b = (await client.get("/auth/me", headers=h2)).json()
    assert a["id"] == b["id"]


async def test_code_works_only_once(client, outbox):
    await client.post("/auth/otp/request", json={"email": "a@example.com"})
    payload = {"email": "a@example.com", "code": outbox["a@example.com"]}
    assert (await client.post("/auth/otp/verify", json=payload)).status_code == 200
    r = await client.post("/auth/otp/verify", json=payload)
    assert r.status_code == 400 and "expired" in r.json()["detail"]


async def test_wrong_code_counts_down_then_locks(client, outbox):
    await client.post("/auth/otp/request", json={"email": "a@example.com"})
    good = outbox["a@example.com"]
    bad = "000000" if good != "000000" else "111111"

    for left in (4, 3, 2, 1):
        r = await client.post("/auth/otp/verify", json={"email": "a@example.com", "code": bad})
        assert r.status_code == 400 and f"{left} tr" in r.json()["detail"]
    r = await client.post("/auth/otp/verify", json={"email": "a@example.com", "code": bad})
    assert "Too many" in r.json()["detail"]

    # Even the right code is refused once the attempts are used up.
    r = await client.post("/auth/otp/verify", json={"email": "a@example.com", "code": good})
    assert r.status_code == 400 and "Too many" in r.json()["detail"]


async def test_expired_code_rejected(client, outbox):
    await client.post("/auth/otp/request", json={"email": "a@example.com"})
    async with SessionLocal() as s:
        await s.execute(update(OtpCode).values(expires_at=utcnow() - timedelta(seconds=1)))
        await s.commit()
    r = await client.post("/auth/otp/verify", json={"email": "a@example.com", "code": outbox["a@example.com"]})
    assert r.status_code == 400 and "expired" in r.json()["detail"]


async def test_only_latest_code_counts(client, outbox):
    await client.post("/auth/otp/request", json={"email": "a@example.com"})
    first = outbox["a@example.com"]
    await client.post("/auth/otp/request", json={"email": "a@example.com"})
    latest = outbox["a@example.com"]
    if first != latest:
        r = await client.post("/auth/otp/verify", json={"email": "a@example.com", "code": first})
        assert r.status_code == 400
    r = await client.post("/auth/otp/verify", json={"email": "a@example.com", "code": latest})
    assert r.status_code == 200


async def test_request_rate_limit(client, outbox):
    for _ in range(5):
        assert (await client.post("/auth/otp/request", json={"email": "a@example.com"})).status_code == 202
    r = await client.post("/auth/otp/request", json={"email": "a@example.com"})
    assert r.status_code == 429
    # Other people aren't affected.
    assert (await client.post("/auth/otp/request", json={"email": "b@example.com"})).status_code == 202


async def test_bad_input_rejected(client):
    assert (await client.post("/auth/otp/request", json={"email": "not-an-email"})).status_code == 422
    assert (await client.post("/auth/otp/verify", json={"email": "a@example.com", "code": "12345"})).status_code == 422
    assert (await client.post("/auth/otp/verify", json={"email": "a@example.com", "code": "12a456"})).status_code == 422


async def test_admin_email_becomes_admin(login, client):
    h = await login("Admin@Example.com")
    assert (await client.get("/auth/me", headers=h)).json()["is_admin"] is True


async def test_me_requires_valid_token(client):
    assert (await client.get("/auth/me")).status_code == 401
    assert (await client.get("/auth/me", headers={"Authorization": "Bearer junk"})).status_code == 401
    # A well-signed token for a user that doesn't exist.
    assert (await client.get("/auth/me", headers={"Authorization": f"Bearer {create_token(999)}"})).status_code == 401


async def test_set_display_name(login, client):
    h = await login("charles@example.com")
    r = await client.patch("/auth/me", headers=h, json={"display_name": "  Charles   L  "})
    assert r.status_code == 200 and r.json()["display_name"] == "Charles L"
    assert (await client.patch("/auth/me", headers=h, json={"display_name": "x"})).status_code == 422


def test_token_round_trip():
    assert decode_token(create_token(42)) == 42
    assert decode_token("garbage") is None


async def test_health(client):
    assert (await client.get("/health")).json() == {"ok": True}
