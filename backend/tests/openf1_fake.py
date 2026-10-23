"""A stand-in OpenF1 that serves real recorded data (tests/fixtures/openf1), through the real client.

cutoff:  only data up to that moment, and no classification yet: the race as seen live.
locked:  refuse data like OpenF1 does during a live session without a paid account.
"""

import json
from datetime import datetime
from pathlib import Path

import httpx

from app.services.openf1.client import OpenF1Client

FIXTURES = Path(__file__).parent / "fixtures" / "openf1"
SINGAPORE_RACE = 11388  # 2026 Singapore GP, 11 Oct: VER wins from pole, two VSCs, four DNFs
SINGAPORE_START = datetime.fromisoformat("2026-10-11T12:00:00+00:00")
SINGAPORE_FP1 = 11378  # 2026 Singapore FP1, 9 Oct: RUS fastest from LEC, no red flag


class FakeOpenF1:
    def __init__(self, folder: str = "singapore_2026", cutoff: datetime | None = None, locked: bool = False,
                 session: str = "Race"):
        self.dir = FIXTURES / folder
        self.cutoff, self.locked = cutoff, locked
        self.urls: list[str] = []
        self.sessions = self._load("sessions")
        # the session the quiz is about (a race, or e.g. "Practice 1"), and the weekend's qualifying if recorded
        self.race_key = next(x["session_key"] for x in self.sessions if x["session_name"] == session)
        self.quali_key = next((x["session_key"] for x in self.sessions if x["session_name"] == "Qualifying"), None)

    def _load(self, name: str) -> list[dict]:
        f = self.dir / f"{name}.json"
        return json.loads(f.read_text()) if f.exists() else []

    def _so_far(self, rows: list[dict]) -> list[dict]:
        if self.cutoff is None:
            return rows
        stamp = lambda r: r.get("date") or r.get("date_start")  # noqa: E731
        return [r for r in rows if stamp(r) is None or datetime.fromisoformat(stamp(r)) <= self.cutoff]

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.urls.append(str(request.url))
        if request.url.path == "/token":
            return httpx.Response(200, json={"access_token": "t0k3n", "expires_in": "3600", "token_type": "bearer"})
        endpoint = request.url.path.rsplit("/", 1)[-1]
        q = dict(request.url.params)
        if endpoint == "sessions":
            rows = [x for x in self.sessions if all(str(x.get(k)) == v for k, v in q.items() if k in x)]
        elif self.locked:
            return httpx.Response(401, json={"detail": "Unauthorized"})
        elif q.get("session_key") == str(self.quali_key) and endpoint == "session_result":
            rows = self._load("quali_result")
        elif q.get("session_key") == str(self.race_key):
            rows = [] if self.cutoff and endpoint == "session_result" else self._so_far(self._load(endpoint))
        else:
            rows = []
        if not rows:
            return httpx.Response(404, json={"detail": "No results found."})
        return httpx.Response(200, json=rows)

    def client(self, **kw) -> OpenF1Client:
        return OpenF1Client("https://api.openf1.test/v1", "https://api.openf1.test/token",
                            http=httpx.AsyncClient(transport=httpx.MockTransport(self.handler)), **kw)
