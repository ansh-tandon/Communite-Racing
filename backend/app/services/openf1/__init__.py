"""OpenF1 integration: API client (client.py), auto-answer rules (rules.py), answer-key sync (sync.py)."""

from app.core.config import get_settings
from app.services.openf1.client import OpenF1Client

_client: OpenF1Client | None = None


def get_client() -> OpenF1Client:
    """One shared client (and token) for the app. Also a FastAPI dependency, so tests can swap it."""
    global _client
    if _client is None:
        s = get_settings()
        _client = OpenF1Client(s.openf1_base_url, s.openf1_token_url, s.openf1_username, s.openf1_password)
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
