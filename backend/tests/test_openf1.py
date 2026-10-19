"""OpenF1: the client, the auto-answer rules on real race data, and filling the answer key live and final."""

from datetime import datetime, timedelta

import httpx
import pytest
from sqlalchemy import update

from app.core.db import SessionLocal
from app.main import app
from app.models import Race
from app.services.openf1 import get_client
from app.services.openf1 import sync as sync_mod
from app.services.openf1.client import OpenF1Client, OpenF1Unavailable, encode_filters
from app.services.openf1.rules import NoValue, RaceData, resolve, validate_auto
from app.services.questions import Invalid
from tests.openf1_fake import SINGAPORE_RACE, SINGAPORE_START, FakeOpenF1

CODES = ["VER", "LEC", "ANT", "NOR", "PIA", "HAM", "LAW", "HUL", "RUS", "HAD", "GAS",
         "BEA", "OCO", "SAI", "LIN", "ALO", "PER", "ALB", "BOT", "STR", "COL", "BOR"]
LIVE_AT = SINGAPORE_START + timedelta(minutes=30)  # lap ~16: one VSC so far, no pit stops yet


@pytest.fixture(autouse=True)
def fresh_sync_state():
    sync_mod._next_check.clear()
    sync_mod._last_reports.clear()
    yield
    app.dependency_overrides.pop(get_client, None)


async def race_data(fake: FakeOpenF1) -> RaceData:
    c = fake.client()
    d = RaceData(c, (await c.sessions(session_key=fake.race_key))[0])
    await d.prepare()
    return d


async def answer(d: RaceData, type_: str, auto: dict, options=CODES, config=None):
    return await resolve(d, type_, options, config or {}, validate_auto(type_, auto))


# ---------- client ----------


def test_filters_encode_like_openf1_expects():
    assert encode_filters({"session_key": 11388, "lap_number__gte": 50, "driver_number": None}) == \
        "session_key=11388&lap_number>=50"
    assert encode_filters({"date__lt": datetime.fromisoformat("2026-10-11T12:00:00+00:00"), "dnf": True}) == \
        "date<2026-10-11T12%3A00%3A00%2B00%3A00&dnf=true"


async def test_empty_result_is_an_empty_list():
    assert await FakeOpenF1().client().laps(session_key=1) == []


async def test_token_sent_and_renewed_once_on_401():
    seen = []

    def handler(r: httpx.Request) -> httpx.Response:
        if r.url.path == "/token":
            seen.append("login")
            return httpx.Response(200, json={"access_token": f"tok{len(seen)}", "expires_in": "3600"})
        seen.append(r.headers.get("authorization"))
        return httpx.Response(401) if len(seen) == 2 else httpx.Response(200, json=[{"ok": 1}])

    c = OpenF1Client("https://x.test/v1", "https://x.test/token", "me", "pw", http=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    assert c.authenticated
    assert await c.weather(session_key="latest") == [{"ok": 1}]
    assert seen == ["login", "Bearer tok1", "login", "Bearer tok3"]


async def test_busy_api_is_retried():
    calls, waits = [], []

    def handler(r: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(429) if len(calls) < 3 else httpx.Response(200, json=[{"lap_number": 1}])

    async def wait(seconds: float) -> None:
        waits.append(seconds)

    c = OpenF1Client(http=httpx.AsyncClient(transport=httpx.MockTransport(handler)), sleep=wait)
    assert await c.laps(session_key=1) == [{"lap_number": 1}] and waits == [2, 4]


async def test_live_session_without_account_is_unavailable():
    with pytest.raises(OpenF1Unavailable, match="paid account"):
        await FakeOpenF1(locked=True).client().position(session_key=SINGAPORE_RACE)


# ---------- rules on the real 2026 Singapore GP ----------


async def test_final_results_from_the_classification():
    d = await race_data(FakeOpenF1())
    assert d.final
    assert await answer(d, "single", {"rule": "winner"}) == "VER"
    assert await answer(d, "single", {"rule": "position", "position": 2}) == "LEC"
    assert await answer(d, "single", {"rule": "pole"}) == "VER"
    assert await answer(d, "single", {"rule": "first_retirement"}) == "BOR"
    assert await answer(d, "ranked", {"rule": "top", "n": 3}, config={"pick": 3}) == ["VER", "LEC", "ANT"]
    assert await answer(d, "multi", {"rule": "top", "n": 10}, config={"pick": 3}) == \
        ["VER", "LEC", "ANT", "NOR", "PIA", "HAM", "LAW", "HUL", "RUS", "HAD"]
    assert sorted(await answer(d, "multi", {"rule": "retired_drivers"}, config={"pick": 3})) == ["ALB", "BOR", "COL", "STR"]
    assert await answer(d, "number", {"rule": "retirements"}) == 4
    assert await answer(d, "number", {"rule": "classified_finishers"}) == 19
    assert await answer(d, "number", {"rule": "winning_margin"}) == 7
    assert await answer(d, "number", {"rule": "finishing_position", "driver": "Hamilton"}) == 6
    assert await answer(d, "yes_no", {"rule": "pole_converts"}) is True
    assert await answer(d, "yes_no", {"rule": "driver_retires", "driver": "STR"}) is True
    assert await answer(d, "yes_no", {"rule": "everyone_finishes"}) is False


async def test_race_events_from_race_control_pit_and_weather():
    d = await race_data(FakeOpenF1())
    assert await answer(d, "number", {"rule": "safety_cars"}) == 0
    assert await answer(d, "number", {"rule": "virtual_safety_cars"}) == 2
    assert await answer(d, "yes_no", {"rule": "safety_car"}) is False
    assert await answer(d, "yes_no", {"rule": "safety_car", "include_vsc": True}) is True
    assert await answer(d, "number", {"rule": "pit_stops"}) == 25
    assert await answer(d, "number", {"rule": "pit_stops_under_sc"}) == 2
    assert await answer(d, "number", {"rule": "pit_stops_under_sc", "include_vsc": False}) == 0
    assert await answer(d, "yes_no", {"rule": "red_flag"}) is False
    assert await answer(d, "yes_no", {"rule": "rain"}) is False


async def test_red_flag_counted_once_per_stoppage():
    d = await race_data(FakeOpenF1("monaco_2026"))
    assert await answer(d, "number", {"rule": "red_flags"}) == 1
    assert await answer(d, "number", {"rule": "safety_cars"}) == 2


async def test_teams_match_loosely():
    d = await race_data(FakeOpenF1())
    assert await answer(d, "single", {"rule": "winning_team"}, options=["Ferrari", "Red Bull", "McLaren"]) == "Red Bull"
    assert await answer(d, "yes_no", {"rule": "team_both_in_top", "team": "Ferrari"}) is False  # HAM was 6th
    assert await answer(d, "yes_no", {"rule": "team_both_in_top", "team": "Ferrari", "n": 6}) is True


async def test_values_must_fit_the_options():
    d = await race_data(FakeOpenF1())
    with pytest.raises(NoValue, match="VER isn't one of the options"):
        await answer(d, "single", {"rule": "winner"}, options=["NOR", "PIA"])
    with pytest.raises(NoValue, match="not in the options"):
        await answer(d, "ranked", {"rule": "top", "n": 3}, options=["VER", "LEC", "NOR"], config={"pick": 3})
    # Pick several keeps the drivers that are options: "which of these finish in the top 10?"
    assert await answer(d, "multi", {"rule": "top", "n": 10}, options=["VER", "NOR", "ALO"], config={"pick": 2}) == ["VER", "NOR"]


async def test_live_values_are_the_race_so_far():
    d = await race_data(FakeOpenF1(cutoff=LIVE_AT))
    assert not d.final
    assert await answer(d, "single", {"rule": "winner"}) == "VER"  # leading at the time
    assert await answer(d, "number", {"rule": "virtual_safety_cars"}) == 1
    assert await answer(d, "number", {"rule": "pit_stops"}) == 0
    with pytest.raises(NoValue, match="official classification"):
        await answer(d, "number", {"rule": "retirements"})


def test_auto_rules_are_validated():
    assert validate_auto("yes_no", {"rule": "safety_car"}) == {"rule": "safety_car", "include_vsc": False}
    assert validate_auto("single", None) is None
    for type_, auto, msg in [
        ("yes_no", {"rule": "winner"}, "can't answer"),
        ("single", {"rule": "nope"}, "Unknown"),
        ("multi", {"rule": "top"}, 'needs "n"'),
        ("multi", {"rule": "top", "n": 0}, "from 1"),
        ("single", {"rule": "winner", "lap": 3}, "doesn't take lap"),
    ]:
        with pytest.raises(Invalid, match=msg):
            validate_auto(type_, auto)


# ---------- filling the answer key ----------

AUTO_QUESTIONS = [
    {"prompt": "Who wins the race?", "type": "single", "weight": 10, "options": ["VER", "NOR", "LEC", "HAM"],
     "auto": {"rule": "winner"}},
    {"prompt": "Predict the podium", "type": "ranked", "weight": 15, "options": CODES, "config": {"pick": 3},
     "auto": {"rule": "top", "n": 3}},
    {"prompt": "Pick 3 drivers in the top 10 after lap 10", "type": "multi", "weight": 9, "options": CODES,
     "config": {"pick": 3}, "auto": {"rule": "top_after_lap", "lap": 10, "n": 10}},
    {"prompt": "Safety car or VSC?", "type": "yes_no", "weight": 5, "auto": {"rule": "safety_car", "include_vsc": True}},
    {"prompt": "How many retirements?", "type": "number", "weight": 6, "config": {"min": 0, "max": 22},
     "auto": {"rule": "retirements"}},
]


@pytest.fixture
def use_openf1():
    def _use(fake: FakeOpenF1) -> FakeOpenF1:
        app.dependency_overrides[get_client] = lambda: fake.client()
        return fake
    return _use


async def singapore_race(make_race, **kw) -> dict:
    """A quiz for the 2026 Singapore GP that locked at lights out."""
    race = await make_race(questions=AUTO_QUESTIONS, **kw)
    async with SessionLocal() as s:
        await s.execute(update(Race).where(Race.id == race["id"]).values(
            quiz_opens_at=SINGAPORE_START - timedelta(days=7), quiz_closes_at=SINGAPORE_START))
        await s.commit()
    return race


async def test_question_auto_rules_checked_on_create(make_race, client, admin):
    bad = [{**AUTO_QUESTIONS[3], "auto": {"rule": "winner"}}]
    r = await client.post("/admin/races", headers=admin, json={
        "season": 2026, "round": 9, "name": "Bad GP", "circuit": "Track",
        "quiz_opens_at": "2026-10-01T00:00:00Z", "quiz_closes_at": "2026-10-02T00:00:00Z", "questions": bad})
    assert r.status_code == 422 and "can't answer" in r.text
    race = await make_race(questions=AUTO_QUESTIONS)
    assert race["questions"][3]["auto"] == {"rule": "safety_car", "include_vsc": True}


async def test_final_results_filled_then_scored(make_race, client, admin, use_openf1):
    use_openf1(FakeOpenF1())
    race = await singapore_race(make_race)
    r = await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})
    assert r.status_code == 200, r.text
    rep = r.json()
    assert rep["session_key"] == SINGAPORE_RACE and rep["phase"] == "final"
    assert [q["status"] for q in rep["questions"]] == ["saved"] * 5

    detail = (await client.get(f"/admin/races/{race['id']}", headers=admin)).json()
    assert detail["openf1_session_key"] == SINGAPORE_RACE
    assert list(detail["answer_key"].values()) == [
        # Top 10 after lap 10 = the order cars crossed the line to start lap 11.
        "VER", ["VER", "LEC", "ANT"], ["VER", "LEC", "HAM", "ANT", "NOR", "PIA", "LAW", "HUL", "GAS", "BEA"], True, 4]
    assert set(detail["answer_key_sources"].values()) == {"openf1"}

    again = (await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})).json()
    assert {q["status"] for q in again["questions"]} == {"unchanged"}
    assert (await client.post(f"/admin/races/{race['id']}/score", headers=admin)).status_code == 200


async def test_typed_in_results_are_never_overwritten(make_race, client, admin, use_openf1):
    use_openf1(FakeOpenF1())
    race = await singapore_race(make_race)
    winner_q = str(race["questions"][0]["id"])
    await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": {winner_q: "LEC"}})

    rep = (await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})).json()
    assert rep["questions"][0]["status"] == "kept manual"
    detail = (await client.get(f"/admin/races/{race['id']}", headers=admin)).json()
    assert detail["answer_key"][winner_q] == "LEC" and detail["answer_key_sources"][winner_q] == "manual"

    await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={"overwrite_manual": True})
    detail = (await client.get(f"/admin/races/{race['id']}", headers=admin)).json()
    assert detail["answer_key"][winner_q] == "VER"


async def test_live_results_are_provisional_until_the_flag(make_race, client, admin, use_openf1):
    use_openf1(FakeOpenF1(cutoff=LIVE_AT))
    race = await singapore_race(make_race)
    rep = (await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})).json()
    assert rep["phase"] == "live"
    assert [q["status"] for q in rep["questions"]] == ["saved", "saved", "saved", "saved", "no value"]
    detail = (await client.get(f"/admin/races/{race['id']}", headers=admin)).json()
    assert set(detail["answer_key_sources"].values()) == {"openf1_live"}

    # Fill the one rule that waits for the classification by hand: the live ones still block scoring.
    retire_q = str(race["questions"][4]["id"])
    await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": {retire_q: 4}})
    r = await client.post(f"/admin/races/{race['id']}/score", headers=admin)
    assert r.status_code == 409 and "provisional" in r.json()["detail"]

    use_openf1(FakeOpenF1())  # chequered flag, classification published
    rep = (await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})).json()
    assert rep["phase"] == "final"
    detail = (await client.get(f"/admin/races/{race['id']}", headers=admin)).json()
    assert detail["answer_key_sources"][retire_q] == "manual"
    assert (await client.post(f"/admin/races/{race['id']}/score", headers=admin)).status_code == 200


async def test_preview_saves_nothing(make_race, client, admin, use_openf1):
    use_openf1(FakeOpenF1())
    race = await singapore_race(make_race)
    rep = (await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={"save": False})).json()
    assert rep["questions"][0]["value"] == "VER" and not rep["saved"]
    assert (await client.get(f"/admin/races/{race['id']}", headers=admin)).json()["answer_key"] == {}


async def test_nothing_saved_while_players_can_still_answer(make_race, client, admin, use_openf1):
    use_openf1(FakeOpenF1())
    race = await singapore_race(make_race)
    async with SessionLocal() as s:  # deadline moved into the future
        await s.execute(update(Race).where(Race.id == race["id"]).values(quiz_closes_at=datetime.now().astimezone() + timedelta(hours=1)))
        await s.commit()
    r = await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})
    assert r.status_code == 409 and "aren't locked" in r.json()["detail"]


async def test_live_session_without_account_explained(make_race, client, admin, use_openf1):
    use_openf1(FakeOpenF1(locked=True))
    race = await singapore_race(make_race)
    r = await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})
    assert r.status_code == 503 and "paid account" in r.json()["detail"]


async def test_link_session_by_hand(make_race, client, admin, use_openf1):
    use_openf1(FakeOpenF1())
    race = await make_race(questions=AUTO_QUESTIONS)
    r = await client.post(f"/admin/races/{race['id']}/openf1/link", headers=admin, json={"session_key": SINGAPORE_RACE})
    assert r.status_code == 200 and r.json()["location"] == "Marina Bay"
    r = await client.post(f"/admin/races/{race['id']}/openf1/link", headers=admin, json={"session_key": 999})
    assert r.status_code == 404


async def test_every_openf1_api_reachable_by_admins(client, admin, login, use_openf1):
    fake = use_openf1(FakeOpenF1())
    r = await client.get(f"/admin/openf1/data/laps?session_key={SINGAPORE_RACE}&lap_number>=62", headers=admin)
    assert r.status_code == 200 and r.json()
    assert "lap_number%3E=62" in fake.urls[-1] or "lap_number>=62" in fake.urls[-1]
    assert (await client.get("/admin/openf1/data/nope", headers=admin)).status_code == 404

    status = (await client.get("/admin/openf1", headers=admin)).json()
    assert len(status["endpoints"]) == 18 and status["live"] is False
    assert {r["rule"] for r in status["rules"]} >= {"winner", "top", "safety_car", "pit_stops_under_sc"}

    player = await login("fan@example.com")
    assert (await client.get("/admin/openf1/data/laps", headers=player)).status_code == 403


async def test_background_sweep_follows_the_race(make_race):
    race = await singapore_race(make_race)
    end = SINGAPORE_START + timedelta(hours=2)

    # During the race without an account: wait for the session to end.
    assert await sync_mod.sweep(FakeOpenF1(locked=True).client(), now=SINGAPORE_START + timedelta(minutes=30)) == []
    assert sync_mod._next_check[race["id"]] == end

    # With an account: live values every few seconds.
    sync_mod._next_check.clear()
    paid = FakeOpenF1(cutoff=LIVE_AT).client(username="me", password="pw")
    [rep] = await sync_mod.sweep(paid, now=LIVE_AT)
    assert rep.phase == "live" and rep.race_id == race["id"]

    # After the flag: final values, then a re-check 10 minutes later for penalties.
    later = end + timedelta(minutes=20)
    [rep] = await sync_mod.sweep(FakeOpenF1().client(), now=later)
    assert rep.phase == "final"
    assert sync_mod._next_check[race["id"]] == later + timedelta(minutes=10)
