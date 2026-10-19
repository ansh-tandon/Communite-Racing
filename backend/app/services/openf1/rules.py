"""Auto-answer rules: how a question's result is read from OpenF1.

A question opts in with `auto`, e.g. {"rule": "winner"} or {"rule": "top_after_lap", "lap": 10, "n": 10}.
Each rule reads one race session and returns a value already shaped for the question type:
an option string for Pick one, a list of options for Pick several / Put in order, a whole number,
or true/false. Drivers are matched to options by code ("VER"), surname or car number; teams by name.

During the race (live) values are provisional: the current leader, safety cars so far, and so on.
Rules marked final_only wait for the official classification.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from app.services.openf1.client import OpenF1Client
from app.services.questions import Invalid

Returns = Literal["driver", "drivers", "team", "number", "bool"]
TYPES_FOR: dict[str, set[str]] = {
    "driver": {"single"}, "drivers": {"multi", "ranked"}, "team": {"single"}, "number": {"number"}, "bool": {"yes_no"},
}


class NoValue(Exception):
    """No answer yet (or none that fits the question). The message is shown to the admin."""


def _t(s: str) -> datetime:
    return datetime.fromisoformat(s)


def classified(r: dict) -> bool:
    """A numeric finishing position. OpenF1 also uses text such as "RT" for retired cars."""
    return isinstance(r.get("position"), int) and not isinstance(r.get("position"), bool)


def _folded(s: Any) -> str:
    return " ".join(str(s).split()).casefold()


class RaceData:
    """One race session's OpenF1 data, fetched lazily and cached for a single sync."""

    def __init__(self, client: OpenF1Client, session: dict):
        self.client = client
        self.session = session
        self.key: int = session["session_key"]
        self.final = False
        self._cache: dict[tuple, Any] = {}

    async def fetch(self, endpoint: str, session_key: int | None = None) -> list[dict]:
        k = (endpoint, session_key or self.key)
        if k not in self._cache:
            self._cache[k] = await self.client.get(endpoint, session_key=k[1])
        return self._cache[k]

    async def prepare(self) -> bool:
        """Decide live vs final: final once the classification is out and the session has finished."""
        result = await self.fetch("session_result")
        status = [r["message"] for r in await self.fetch("race_control") if r["category"] == "SessionStatus"]
        self.final = bool(result) and (not status or status[-1] in ("SESSION FINISHED", "SESSION FINALISED"))
        return self.final

    # ---------- building blocks ----------

    async def drivers(self) -> dict[int, dict]:
        return {d["driver_number"]: d for d in await self.fetch("drivers")}

    async def result(self) -> list[dict]:
        return await self.fetch("session_result")

    async def order(self) -> list[int]:
        """Finishing order when final, the current running order while live."""
        if self.final:
            rows = [r for r in await self.result() if classified(r)]
            return [r["driver_number"] for r in sorted(rows, key=lambda r: r["position"])]
        return await self.order_at(None)

    async def order_at(self, when: datetime | None) -> list[int]:
        latest: dict[int, tuple[datetime, int]] = {}
        for p in await self.fetch("position"):
            t = _t(p["date"])
            if when is not None and t > when:
                continue
            if p["driver_number"] not in latest or t >= latest[p["driver_number"]][0]:
                latest[p["driver_number"]] = (t, p["position"])
        return [n for n, _ in sorted(latest.items(), key=lambda kv: kv[1][1])]

    async def grid(self) -> dict[int, int]:
        """Starting position: each driver's first position record of the race session."""
        first: dict[int, tuple[datetime, int]] = {}
        for p in await self.fetch("position"):
            t = _t(p["date"])
            if p["driver_number"] not in first or t < first[p["driver_number"]][0]:
                first[p["driver_number"]] = (t, p["position"])
        return {n: pos for n, (_, pos) in first.items()}

    async def lap_end(self, lap: int) -> datetime | None:
        """When the leader completed `lap` (the first car starting lap + 1); None if not yet."""
        starts = [_t(x["date_start"]) for x in await self.fetch("laps") if x["lap_number"] == lap + 1 and x.get("date_start")]
        if starts:
            return min(starts)
        if self.final:
            flag = [_t(r["date"]) for r in await self.fetch("race_control") if r.get("flag") == "CHEQUERED"]
            total = max((x["lap_number"] for x in await self.fetch("laps")), default=0)
            if flag and lap >= total:
                return flag[0]
        return None

    async def order_after_lap(self, lap: int) -> list[int]:
        end = await self.lap_end(lap)
        if end is None:
            raise NoValue(f"Lap {lap} isn't finished yet.")
        return await self.order_at(end)

    async def quali_order(self) -> list[int]:
        k = ("weekend", self.session["meeting_key"])
        if k not in self._cache:
            self._cache[k] = await self.client.sessions(meeting_key=self.session["meeting_key"])
        quali = next((s for s in self._cache[k] if s["session_name"] == "Qualifying"), None)
        if quali is None:
            raise NoValue("No qualifying session found for this weekend.")
        rows = [r for r in await self.fetch("session_result", quali["session_key"]) if classified(r)]
        if not rows:
            raise NoValue("Qualifying results aren't out yet.")
        return [r["driver_number"] for r in sorted(rows, key=lambda r: r["position"])]

    async def neutralisations(self, sc: bool = True, vsc: bool = True) -> list[tuple[datetime, datetime | None]]:
        """(start, end) of each safety car / VSC period. end is None while it's still out."""
        periods, open_sc, open_vsc = [], None, None
        for r in sorted(await self.fetch("race_control"), key=lambda r: r["date"]):
            m, t = r["message"].upper(), _t(r["date"])
            is_vsc = m.startswith("VSC") or "VIRTUAL SAFETY CAR" in m
            if "DEPLOYED" in m and is_vsc:
                open_vsc = open_vsc or t
            elif "DEPLOYED" in m and "SAFETY CAR" in m:
                open_sc = open_sc or t
            elif is_vsc and "ENDING" in m and open_vsc:
                periods.append(("vsc", open_vsc, t))
                open_vsc = None
            elif "SAFETY CAR IN THIS LAP" in m and open_sc:
                periods.append(("sc", open_sc, await self.lap_end(r["lap_number"]) if r.get("lap_number") else t))
                open_sc = None
            elif m in ("SESSION ABORTED", "CHEQUERED FLAG") or r.get("flag") == "CHEQUERED":
                for kind, start in (("sc", open_sc), ("vsc", open_vsc)):
                    if start:
                        periods.append((kind, start, t))
                open_sc = open_vsc = None
        periods += [("sc", open_sc, None)] if open_sc else []
        periods += [("vsc", open_vsc, None)] if open_vsc else []
        return [(s, e) for kind, s, e in periods if (kind == "sc" and sc) or (kind == "vsc" and vsc)]

    async def red_flags(self) -> int:
        times = sorted(
            _t(r["date"]) for r in await self.fetch("race_control")
            if r.get("flag") == "RED" or r["message"].upper() == "SESSION ABORTED" or r["message"].upper().startswith("RED FLAG")
        )
        # One stoppage shows up as several messages a second apart; count stoppages, not messages.
        events: list[datetime] = []
        for t in times:
            if not events or (t - events[-1]).total_seconds() > 120:
                events.append(t)
        return len(events)

    async def driver_number(self, name: Any) -> int:
        for n, d in (await self.drivers()).items():
            if driver_matches(name, n, d):
                return n
        raise NoValue(f"No driver '{name}' in this session.")

    async def team_drivers(self, team: str) -> list[int]:
        found = [n for n, d in (await self.drivers()).items() if team_matches(team, d.get("team_name", ""))]
        if not found:
            raise NoValue(f"No team '{team}' in this session.")
        return found

    def need_final(self) -> None:
        if not self.final:
            raise NoValue("Known after the official classification.")


def driver_matches(option: Any, number: int, d: dict) -> bool:
    o = _folded(option)
    names = {d.get("name_acronym"), d.get("last_name"), d.get("full_name"), d.get("broadcast_name"),
             f"{d.get('first_name', '')} {d.get('last_name', '')}", str(number)}
    return o in {_folded(x) for x in names if x}


def team_matches(option: Any, team: str) -> bool:
    o, t = _folded(option), _folded(team)
    return bool(o) and (o == t or o in t or t in o)


# ---------- the rules ----------


@dataclass(frozen=True)
class Param:
    kind: Literal["int", "driver", "team", "bool"]
    label: str
    default: Any = None  # None = required
    min: int = 1
    max: int = 100


@dataclass(frozen=True)
class Rule:
    name: str
    label: str
    returns: Returns
    fn: Callable[[RaceData, dict], Awaitable[Any]]
    params: dict[str, Param] = field(default_factory=dict)
    final_only: bool = False
    note: str = ""

    @property
    def types(self) -> set[str]:
        return TYPES_FOR[self.returns]


RULES: dict[str, Rule] = {}


def rule(name: str, label: str, returns: Returns, *, params: dict[str, Param] | None = None,
         final_only: bool = False, note: str = ""):
    def register(fn):
        RULES[name] = Rule(name, label, returns, fn, params or {}, final_only, note)
        return fn
    return register


def _nth(order: list[int], n: int) -> int:
    if len(order) < n:
        raise NoValue(f"No P{n} yet.")
    return order[n - 1]


LAP = Param("int", "Lap", max=100)
TOP = Param("int", "Top how many", max=22)
DRIVER = Param("driver", "Driver (code, e.g. LEC)")
TEAM = Param("team", "Team (e.g. Ferrari)")


# Pick one: a driver

@rule("winner", "Race winner", "driver")
async def _winner(d: RaceData, p: dict) -> int:
    return _nth(await d.order(), 1)


@rule("position", "Driver finishing in position N", "driver", params={"position": Param("int", "Position", max=22)})
async def _position(d: RaceData, p: dict) -> int:
    return _nth(await d.order(), p["position"])


@rule("pole", "Pole position (qualifying P1)", "driver")
async def _pole(d: RaceData, p: dict) -> int:
    return _nth(await d.quali_order(), 1)


@rule("leader_after_lap", "Leader after lap N", "driver", params={"lap": LAP})
async def _leader_after_lap(d: RaceData, p: dict) -> int:
    return _nth(await d.order_after_lap(p["lap"]), 1)


@rule("fastest_lap", "Fastest lap of the race", "driver")
async def _fastest_lap(d: RaceData, p: dict) -> int:
    timed = [x for x in await d.fetch("laps") if x.get("lap_duration")]
    if not timed:
        raise NoValue("No timed laps yet.")
    return min(timed, key=lambda x: x["lap_duration"])["driver_number"]


@rule("most_places_gained", "Most places gained (grid to finish)", "driver", final_only=True)
async def _most_places_gained(d: RaceData, p: dict) -> int:
    d.need_final()
    grid = await d.grid()
    gains = {r["driver_number"]: grid[r["driver_number"]] - r["position"]
             for r in await d.result() if classified(r) and r["driver_number"] in grid}
    if not gains:
        raise NoValue("No classified finishers.")
    best = max(gains.values())
    top = [n for n, g in gains.items() if g == best]
    if len(top) > 1:
        raise NoValue(f"Tie: {len(top)} drivers gained {best} places. Enter it by hand.")
    return top[0]


@rule("first_retirement", "First driver to retire", "driver", final_only=True)
async def _first_retirement(d: RaceData, p: dict) -> int:
    d.need_final()
    out = [r for r in await d.result() if r.get("dnf")]
    if not out:
        raise NoValue("Nobody retired.")
    fewest = min(r["number_of_laps"] or 0 for r in out)
    first = [r for r in out if (r["number_of_laps"] or 0) == fewest]
    if len(first) > 1:
        raise NoValue(f"Tie: {len(first)} drivers retired on lap {fewest}. Enter it by hand.")
    return first[0]["driver_number"]


@rule("fastest_pit_lane", "Fastest pit lane time", "driver",
      note="2026 data has pit-lane time only, not stationary time.")
async def _fastest_pit_lane(d: RaceData, p: dict) -> int:
    stops = [x for x in await d.fetch("pit") if (x.get("lane_duration") or x.get("pit_duration"))]
    if not stops:
        raise NoValue("No pit stops yet.")
    return min(stops, key=lambda x: x.get("lane_duration") or x["pit_duration"])["driver_number"]


# Pick one: a team

@rule("winning_team", "Winning team", "team")
async def _winning_team(d: RaceData, p: dict) -> str:
    return (await d.drivers())[_nth(await d.order(), 1)]["team_name"]


# Pick several / Put in order: drivers

@rule("top", "Top N finishers (Pick several) / finishing order (Put in order)", "drivers", params={"n": TOP})
async def _top(d: RaceData, p: dict) -> list[int]:
    order = await d.order()
    if not order:
        raise NoValue("No running order yet.")
    return order[: p["n"]]


@rule("top_after_lap", "Top N after lap L", "drivers", params={"lap": LAP, "n": TOP})
async def _top_after_lap(d: RaceData, p: dict) -> list[int]:
    return (await d.order_after_lap(p["lap"]))[: p["n"]]


@rule("qualifying_top", "Top N in qualifying", "drivers", params={"n": TOP})
async def _qualifying_top(d: RaceData, p: dict) -> list[int]:
    return (await d.quali_order())[: p["n"]]


@rule("retired_drivers", "Drivers who didn't finish (DNF, DNS)", "drivers", final_only=True)
async def _retired_drivers(d: RaceData, p: dict) -> list[int]:
    d.need_final()
    out = [r["driver_number"] for r in await d.result() if r.get("dnf") or r.get("dns")]
    if not out:
        raise NoValue("Every driver finished.")
    return out


# Number

@rule("safety_cars", "Safety car deployments", "number")
async def _safety_cars(d: RaceData, p: dict) -> int:
    return len(await d.neutralisations(sc=True, vsc=False))


@rule("virtual_safety_cars", "Virtual safety car deployments", "number")
async def _virtual_safety_cars(d: RaceData, p: dict) -> int:
    return len(await d.neutralisations(sc=False, vsc=True))


@rule("neutralisations", "Safety cars + virtual safety cars", "number")
async def _neutralisations(d: RaceData, p: dict) -> int:
    return len(await d.neutralisations())


@rule("red_flags", "Red flags", "number")
async def _red_flags(d: RaceData, p: dict) -> int:
    return await d.red_flags()


@rule("pit_stops", "Pit stops (all cars)", "number")
async def _pit_stops(d: RaceData, p: dict) -> int:
    return len(await d.fetch("pit"))


@rule("pit_stops_under_sc", "Pit stops under safety car", "number",
      params={"include_vsc": Param("bool", "Count VSC periods too", default=True)})
async def _pit_stops_under_sc(d: RaceData, p: dict) -> int:
    periods = await d.neutralisations(sc=True, vsc=p["include_vsc"])
    count = 0
    for x in await d.fetch("pit"):
        t = _t(x["date"])
        count += any(start <= t and (end is None or t <= end) for start, end in periods)
    return count


@rule("retirements", "Drivers who didn't finish", "number", final_only=True,
      params={"include_dns": Param("bool", "Count non-starters too", default=True)})
async def _retirements(d: RaceData, p: dict) -> int:
    d.need_final()
    return sum(1 for r in await d.result() if r.get("dnf") or (p["include_dns"] and r.get("dns")))


@rule("classified_finishers", "Classified finishers", "number", final_only=True)
async def _classified_finishers(d: RaceData, p: dict) -> int:
    d.need_final()
    return sum(1 for r in await d.result() if classified(r))


@rule("overtakes", "Overtakes", "number", note="OpenF1 says this data may be incomplete.")
async def _overtakes(d: RaceData, p: dict) -> int:
    return len(await d.fetch("overtakes"))


@rule("lead_changes", "Lead changes", "number")
async def _lead_changes(d: RaceData, p: dict) -> int:
    leaders = [x["driver_number"] for x in sorted(await d.fetch("position"), key=lambda x: x["date"]) if x["position"] == 1]
    return sum(1 for a, b in zip(leaders, leaders[1:]) if a != b)


@rule("finishing_position", "A driver's finishing position", "number", params={"driver": DRIVER})
async def _finishing_position(d: RaceData, p: dict) -> int:
    n = await d.driver_number(p["driver"])
    order = await d.order()
    if n not in order:
        raise NoValue(f"{p['driver']} isn't classified.")
    return order.index(n) + 1


@rule("winning_margin", "Winning margin in seconds (rounded)", "number", final_only=True)
async def _winning_margin(d: RaceData, p: dict) -> int:
    d.need_final()
    second = next((r for r in await d.result() if r.get("position") == 2), None)
    gap = second and second.get("gap_to_leader")
    if not isinstance(gap, (int, float)):
        raise NoValue("P2 was lapped or the gap isn't published.")
    return round(gap)


@rule("max_track_temp", "Highest track temperature (°C, rounded)", "number")
async def _max_track_temp(d: RaceData, p: dict) -> int:
    temps = [w["track_temperature"] for w in await d.fetch("weather") if w.get("track_temperature") is not None]
    if not temps:
        raise NoValue("No weather data yet.")
    return round(max(temps))


# Yes / no

@rule("safety_car", "Was there a safety car?", "bool",
      params={"include_vsc": Param("bool", "A VSC counts too", default=False)})
async def _safety_car(d: RaceData, p: dict) -> bool:
    return bool(await d.neutralisations(sc=True, vsc=p["include_vsc"]))


@rule("virtual_safety_car", "Was there a virtual safety car?", "bool")
async def _virtual_safety_car(d: RaceData, p: dict) -> bool:
    return bool(await d.neutralisations(sc=False, vsc=True))


@rule("red_flag", "Was there a red flag?", "bool")
async def _red_flag(d: RaceData, p: dict) -> bool:
    return await d.red_flags() > 0


@rule("rain", "Did it rain during the race?", "bool")
async def _rain(d: RaceData, p: dict) -> bool:
    return any(w.get("rainfall") for w in await d.fetch("weather"))


@rule("pole_converts", "Does the pole sitter win?", "bool")
async def _pole_converts(d: RaceData, p: dict) -> bool:
    return _nth(await d.quali_order(), 1) == _nth(await d.order(), 1)


@rule("driver_wins", "Does a driver win?", "bool", params={"driver": DRIVER})
async def _driver_wins(d: RaceData, p: dict) -> bool:
    return _nth(await d.order(), 1) == await d.driver_number(p["driver"])


@rule("driver_in_top", "Does a driver finish in the top N?", "bool", params={"driver": DRIVER, "n": TOP})
async def _driver_in_top(d: RaceData, p: dict) -> bool:
    return await d.driver_number(p["driver"]) in (await d.order())[: p["n"]]


@rule("driver_retires", "Does a driver retire?", "bool", final_only=True, params={"driver": DRIVER})
async def _driver_retires(d: RaceData, p: dict) -> bool:
    d.need_final()
    n = await d.driver_number(p["driver"])
    return any(r["driver_number"] == n and (r.get("dnf") or r.get("dns")) for r in await d.result())


@rule("team_wins", "Does a team win?", "bool", params={"team": TEAM})
async def _team_wins(d: RaceData, p: dict) -> bool:
    return _nth(await d.order(), 1) in await d.team_drivers(p["team"])


@rule("team_both_in_top", "Do both of a team's drivers finish in the top N?", "bool",
      params={"team": TEAM, "n": Param("int", "Top how many", default=3, max=22)})
async def _team_both_in_top(d: RaceData, p: dict) -> bool:
    top = set((await d.order())[: p["n"]])
    return all(n in top for n in await d.team_drivers(p["team"]))


@rule("everyone_finishes", "Does every driver finish?", "bool", final_only=True)
async def _everyone_finishes(d: RaceData, p: dict) -> bool:
    d.need_final()
    return not any(r.get("dnf") or r.get("dns") or r.get("dsq") for r in await d.result())


# ---------- validation and shaping ----------


def validate_auto(type_: str, auto: Any) -> dict | None:
    """Check a question's `auto` setting; returns it with defaults filled in. None/{} = answered by hand."""
    if auto in (None, {}):
        return None
    if not isinstance(auto, dict) or not isinstance(auto.get("rule"), str):
        raise Invalid('Auto-answer must look like {"rule": "winner"}.')
    r = RULES.get(auto["rule"])
    if r is None:
        raise Invalid(f"Unknown auto-answer rule '{auto['rule']}'.")
    if type_ not in r.types:
        raise Invalid(f"Rule '{r.name}' can't answer this question type.")
    out = {"rule": r.name}
    for name, prm in r.params.items():
        v = auto.get(name, prm.default)
        if v is None:
            raise Invalid(f"Rule '{r.name}' needs \"{name}\" ({prm.label}).")
        if prm.kind == "int":
            if not isinstance(v, int) or isinstance(v, bool) or not prm.min <= v <= prm.max:
                raise Invalid(f'"{name}" must be a whole number from {prm.min} to {prm.max}.')
        elif prm.kind == "bool":
            if not isinstance(v, bool):
                raise Invalid(f'"{name}" must be true or false.')
        elif not isinstance(v, str) or not v.strip():
            raise Invalid(f'"{name}" must be text, e.g. "LEC" or "Ferrari".')
        out[name] = v
    unknown = set(auto) - set(out)
    if unknown:
        raise Invalid(f"Rule '{r.name}' doesn't take {', '.join(sorted(unknown))}.")
    return out


async def resolve(d: RaceData, type_: str, options: list, config: dict, auto: dict) -> Any:
    """Run a question's rule and shape the value for its type. Raises NoValue when there isn't one."""
    r = RULES[auto["rule"]]
    if r.final_only and not d.final:
        raise NoValue("Known after the official classification.")
    params = {k: auto.get(k, prm.default) for k, prm in r.params.items()}
    raw = await r.fn(d, params)
    drivers = await d.drivers() if r.returns in ("driver", "drivers") else {}

    def option_for(n: int) -> str | None:
        return next((o for o in options if driver_matches(o, n, drivers.get(n, {}))), None)

    def code(n: int) -> str:
        return drivers.get(n, {}).get("name_acronym") or f"#{n}"

    if r.returns == "driver":
        opt = option_for(raw)
        if opt is None:
            raise NoValue(f"{code(raw)} isn't one of the options.")
        return opt
    if r.returns == "team":
        opt = next((o for o in options if _folded(o) == _folded(raw)), None) or next(
            (o for o in options if team_matches(o, raw)), None)
        if opt is None:
            raise NoValue(f"{raw} isn't one of the options.")
        return opt
    if r.returns == "drivers":
        if type_ == "ranked":
            raw = raw[: config["pick"]]
            if len(raw) < config["pick"]:
                raise NoValue(f"Only {len(raw)} of {config['pick']} places known.")
            missing = [code(n) for n in raw if option_for(n) is None]
            if missing:
                raise NoValue(f"{', '.join(missing)} not in the options.")
            return [option_for(n) for n in raw]
        picked = [o for o in (option_for(n) for n in raw) if o is not None]
        if not picked:
            raise NoValue("None of the drivers are in the options.")
        return picked
    if r.returns == "number":
        return int(round(raw))
    return bool(raw)


def catalogue() -> list[dict]:
    """Every rule, for the admin: what it answers, which question types, and its settings."""
    return [
        {"rule": r.name, "label": r.label, "types": sorted(r.types), "final_only": r.final_only, "note": r.note,
         "params": {k: {"kind": p.kind, "label": p.label, "default": p.default} for k, p in r.params.items()}}
        for r in RULES.values()
    ]
