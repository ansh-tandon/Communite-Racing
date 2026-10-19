"""Continue with Google: real RS256 tokens signed with a throwaway key standing in for Google's."""

from datetime import timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import get_settings
from app.core.security import utcnow

CLIENT_ID = "test-client.apps.googleusercontent.com"
_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def google_keys(monkeypatch):
    monkeypatch.setattr("app.services.google_auth._signing_key", lambda token: _key.public_key())


def google_token(key=_key, **claims) -> str:
    now = utcnow()
    payload = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "1001",
        "email": "lando@gmail.com",
        "email_verified": True,
        "iat": now,
        "exp": now + timedelta(hours=1),
        **claims,
    }
    return jwt.encode({k: v for k, v in payload.items() if v is not None}, key, algorithm="RS256")


async def sign_in(client, token: str):
    return await client.post("/auth/google", json={"credential": token})


async def test_first_sign_in_creates_player(client):
    r = await sign_in(client, google_token(email="Lando@Gmail.com"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == "lando@gmail.com" and body["user"]["display_name"] is None
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["id"] == body["user"]["id"]


async def test_same_google_account_same_player(client):
    a = (await sign_in(client, google_token())).json()["user"]
    # Still the same player after the Google account's address changes.
    b = (await sign_in(client, google_token(email="lando.norris@gmail.com"))).json()["user"]
    assert a["id"] == b["id"] and b["email"] == "lando@gmail.com"


async def test_links_to_existing_email_code_player(login, client):
    h = await login("oscar@gmail.com")
    await client.patch("/auth/me", headers=h, json={"display_name": "Oscar"})
    r = await sign_in(client, google_token(sub="2002", email="oscar@gmail.com"))
    assert r.status_code == 200 and r.json()["user"]["display_name"] == "Oscar"
    # And email codes keep working for the same player afterwards.
    again = await client.get("/auth/me", headers=await login("oscar@gmail.com"))
    assert again.json()["id"] == r.json()["user"]["id"]


async def test_workspace_address_links(login, client):
    await login("max@redbull.com")
    r = await sign_in(client, google_token(sub="3003", email="max@redbull.com", hd="redbull.com"))
    assert r.status_code == 200


async def test_other_address_does_not_take_over_existing_player(login, client):
    # A Google account made with a non-Google address only proves it once held that address.
    await login("george@example.com")
    r = await sign_in(client, google_token(sub="4004", email="george@example.com"))
    assert r.status_code == 409 and "email code" in r.json()["detail"]


async def test_other_address_new_player_is_fine(client):
    r = await sign_in(client, google_token(sub="5005", email="kimi@example.com"))
    assert r.status_code == 200 and r.json()["user"]["email"] == "kimi@example.com"


async def test_admin_email_becomes_admin(client):
    r = await sign_in(client, google_token(email="admin@example.com"))
    assert r.json()["user"]["is_admin"] is True


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(lambda: google_token(aud="someone-elses-app.apps.googleusercontent.com"), id="wrong-audience"),
        pytest.param(lambda: google_token(iss="https://evil.example.com"), id="wrong-issuer"),
        pytest.param(lambda: google_token(exp=utcnow() - timedelta(minutes=5)), id="expired"),
        pytest.param(lambda: google_token(email_verified=False), id="unverified-email"),
        pytest.param(lambda: google_token(email=None), id="no-email"),
        pytest.param(lambda: google_token(key=rsa.generate_private_key(public_exponent=65537, key_size=2048)), id="forged"),
        pytest.param(lambda: "not-a-token", id="garbage"),
    ],
)
async def test_bad_tokens_rejected(client, token):
    r = await sign_in(client, token())
    assert r.status_code == 401, r.text


async def test_switched_off_without_client_id(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "google_client_id", "")
    assert (await sign_in(client, google_token())).status_code == 404


async def test_google_unreachable(client, monkeypatch):
    def down(token):
        raise jwt.PyJWKClientConnectionError("down")

    monkeypatch.setattr("app.services.google_auth._signing_key", down)
    assert (await sign_in(client, google_token())).status_code == 503
