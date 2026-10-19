"""OpenF1 API client (https://openf1.org): every endpoint, one async HTTP client.

Historical data is free and needs no login. Live data during a session needs a paid account:
set OPENF1_USERNAME / OPENF1_PASSWORD and requests carry a bearer token (1 hour, renewed here).

Filters are keyword arguments. Comparisons use a suffix, the way Django does it:
    await client.laps(session_key=11388, lap_number__gte=50, driver_number=1)
    ->  GET /v1/laps?session_key=11388&lap_number>=50&driver_number=1

OpenF1 answers an empty result with 404 "No results found."; that comes back here as [].
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx

log = logging.getLogger(__name__)

# Every endpoint OpenF1 serves, with what it holds. The admin passthrough only allows these.
ENDPOINTS: dict[str, str] = {
    "car_data": "Telemetry per car: speed, RPM, gear, throttle, brake, DRS (~3.7 Hz)",
    "championship_drivers": "Drivers' championship before and after a race (beta, races only)",
    "championship_teams": "Teams' championship before and after a race (beta, races only)",
    "drivers": "Drivers in a session: number, acronym, name, team, colour, headshot",
    "intervals": "Gap to the leader and to the car ahead (races, ~every 4 s)",
    "laps": "Lap and sector times, speed traps, pit-out laps",
    "location": "Approximate x/y/z position of each car (~3.7 Hz)",
    "meetings": "Grand Prix and testing weekends",
    "overtakes": "Position exchanges between drivers (races only; may be incomplete)",
    "pit": "Pit lane visits: lane time and stationary time",
    "position": "Position changes through a session",
    "race_control": "Flags, safety car, session status, incidents, penalties",
    "sessions": "Practice, qualifying, sprint and race sessions with start/end times",
    "session_result": "Final classification of a session",
    "starting_grid": "Starting grid with qualifying lap times",
    "stints": "Tyre stints: compound, laps, tyre age",
    "team_radio": "Team radio recordings (a selection)",
    "weather": "Air and track temperature, humidity, wind, rain (every minute)",
}

_OPS = {"gte": ">=", "gt": ">", "lte": "<=", "lt": "<"}


class OpenF1Error(Exception):
    pass


class OpenF1Unavailable(OpenF1Error):
    """The data can't be read right now: a live session without a paid token, or OpenF1 is down."""


def encode_filters(filters: dict[str, Any]) -> str:
    """{"lap_number__gte": 50, "session_key": 1} -> "lap_number>=50&session_key=1"."""
    parts = []
    for key, value in filters.items():
        if value is None:
            continue
        name, op = key, "="
        field, _, suffix = key.rpartition("__")
        if field and suffix in _OPS:
            name, op = field, _OPS[suffix]
        if isinstance(value, bool):
            value = str(value).lower()
        elif isinstance(value, datetime):
            value = value.isoformat()
        parts.append(f"{quote(name, safe='')}{op}{quote(str(value), safe='')}")
    return "&".join(parts)


class OpenF1Client:
    def __init__(
        self,
        base_url: str = "https://api.openf1.org/v1",
        token_url: str = "https://api.openf1.org/token",
        username: str = "",
        password: str = "",
        http: httpx.AsyncClient | None = None,
        max_attempts: int = 6,
        sleep=asyncio.sleep,
    ):
        self.base_url = base_url.rstrip("/")
        self.token_url = token_url
        self.username, self.password = username, password
        self.http = http or httpx.AsyncClient(timeout=30)
        self.max_attempts = max_attempts
        self._sleep = sleep
        self._token: str | None = None
        self._token_expires = 0.0
        self._token_lock = asyncio.Lock()

    @property
    def authenticated(self) -> bool:
        """True when a paid account is configured, so live sessions can be read."""
        return bool(self.username and self.password)

    async def aclose(self) -> None:
        await self.http.aclose()

    async def token(self, refresh: bool = False) -> str | None:
        if not self.authenticated:
            return None
        async with self._token_lock:
            if refresh or not self._token or time.monotonic() >= self._token_expires:
                r = await self.http.post(self.token_url, data={"username": self.username, "password": self.password})
                if r.status_code != 200:
                    raise OpenF1Error(f"OpenF1 login failed ({r.status_code}). Check OPENF1_USERNAME / OPENF1_PASSWORD.")
                body = r.json()
                self._token = body["access_token"]
                # Renew 2 minutes early so a request never goes out with a token about to lapse.
                self._token_expires = time.monotonic() + int(body.get("expires_in", 3600)) - 120
            return self._token

    async def get(self, endpoint: str, **filters: Any) -> list[dict]:
        return await self.get_raw(endpoint, encode_filters(filters))

    async def get_raw(self, endpoint: str, query: str = "") -> list[dict]:
        """GET /v1/<endpoint>?<query> with the query string passed through untouched."""
        if endpoint not in ENDPOINTS:
            raise OpenF1Error(f"Unknown OpenF1 endpoint '{endpoint}'.")
        url = f"{self.base_url}/{endpoint}" + (f"?{query}" if query else "")
        refreshed = False
        for attempt in range(1, self.max_attempts + 1):
            headers = {}
            if token := await self.token():
                headers["Authorization"] = f"Bearer {token}"
            try:
                r = await self.http.get(url, headers=headers)
            except httpx.TransportError as e:
                if attempt == self.max_attempts:
                    raise OpenF1Unavailable(f"OpenF1 didn't answer: {e}") from e
                await self._sleep(min(2**attempt, 20))
                continue

            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return []  # "No results found."
            if r.status_code in (401, 403):
                if self.authenticated and not refreshed:
                    await self.token(refresh=True)
                    refreshed = True
                    continue
                raise OpenF1Unavailable(
                    "OpenF1 refused the request. Live sessions need a paid account (OPENF1_USERNAME / OPENF1_PASSWORD)."
                    if not self.authenticated else f"OpenF1 refused the token ({r.status_code}).")
            if r.status_code == 429 or r.status_code >= 500:
                if attempt == self.max_attempts:
                    raise OpenF1Unavailable(f"OpenF1 is busy ({r.status_code}). Try again shortly.")
                wait = r.headers.get("retry-after")
                await self._sleep(min(float(wait), 30) if wait and wait.replace(".", "", 1).isdigit() else min(2**attempt, 20))
                continue
            raise OpenF1Error(f"OpenF1 returned {r.status_code}: {r.text[:200]}")
        raise OpenF1Unavailable("OpenF1 couldn't be reached.")

    # One method per endpoint, so callers (and editors) can see everything that exists.

    async def car_data(self, **filters: Any) -> list[dict]:
        return await self.get("car_data", **filters)

    async def championship_drivers(self, **filters: Any) -> list[dict]:
        return await self.get("championship_drivers", **filters)

    async def championship_teams(self, **filters: Any) -> list[dict]:
        return await self.get("championship_teams", **filters)

    async def drivers(self, **filters: Any) -> list[dict]:
        return await self.get("drivers", **filters)

    async def intervals(self, **filters: Any) -> list[dict]:
        return await self.get("intervals", **filters)

    async def laps(self, **filters: Any) -> list[dict]:
        return await self.get("laps", **filters)

    async def location(self, **filters: Any) -> list[dict]:
        return await self.get("location", **filters)

    async def meetings(self, **filters: Any) -> list[dict]:
        return await self.get("meetings", **filters)

    async def overtakes(self, **filters: Any) -> list[dict]:
        return await self.get("overtakes", **filters)

    async def pit(self, **filters: Any) -> list[dict]:
        return await self.get("pit", **filters)

    async def position(self, **filters: Any) -> list[dict]:
        return await self.get("position", **filters)

    async def race_control(self, **filters: Any) -> list[dict]:
        return await self.get("race_control", **filters)

    async def sessions(self, **filters: Any) -> list[dict]:
        return await self.get("sessions", **filters)

    async def session_result(self, **filters: Any) -> list[dict]:
        return await self.get("session_result", **filters)

    async def starting_grid(self, **filters: Any) -> list[dict]:
        return await self.get("starting_grid", **filters)

    async def stints(self, **filters: Any) -> list[dict]:
        return await self.get("stints", **filters)

    async def team_radio(self, **filters: Any) -> list[dict]:
        return await self.get("team_radio", **filters)

    async def weather(self, **filters: Any) -> list[dict]:
        return await self.get("weather", **filters)
