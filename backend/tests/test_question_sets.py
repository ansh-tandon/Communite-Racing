"""Race-specific question sets: accepted by the admin API, and every question answered by OpenF1 on real data.

The US GP hasn't run yet, so its questions are replayed on the recorded 2026 Singapore GP (VER from pole,
two VSCs, four DNFs), live and final, then scored end to end for a player.
"""

import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import update

from app.core.db import SessionLocal
from app.main import app
from app.models import Race
from app.question_sets import US_GP_2026, US_GP_2026_FP1
from app.services.openf1 import get_client
from app.services.openf1 import sync as sync_mod
from app.services.openf1.rules import RULES, NoValue, RaceData, resolve, validate_auto
from app.services.questions import validate_value
from tests.openf1_fake import FIXTURES, SINGAPORE_FP1, SINGAPORE_START, FakeOpenF1
from tests.test_openf1 import use_openf1  # noqa: F401  (fixture)

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


async def answers(d: RaceData, questions: list[dict]) -> list:
    """Each question's value from OpenF1, checked as an answer key; a NoValue is returned as itself."""
    out = []
    for q in questions:
        try:
            v = await resolve(d, q["type"], q.get("options", []), q.get("config", {}), validate_auto(q["type"], q["auto"]))
            out.append(validate_value(q["type"], q.get("options", []), q.get("config", {}), v, is_key=True))
        except NoValue as e:
            out.append(e)
    return out


def test_us_gp_questions_follow_the_league_marking():
    assert [(q["weight"], q["config"]["penalty"]) for q in US_GP_2026] == [
        (15, 5), (10, 3), (10, 3), (10, 3), (10, 5), (10, 3), (5, 2), (5, 2), (10, 3), (15, 5)]
    for q in US_GP_2026:
        assert q["auto"]["rule"] in RULES, q["prompt"]
        assert validate_auto(q["type"], q["auto"]), q["prompt"]


async def test_us_gp_questions_accepted_by_the_admin_api(make_race):
    race = await make_race(questions=US_GP_2026)
    assert [q["prompt"] for q in race["questions"]] == [q["prompt"] for q in US_GP_2026]
    assert race["questions"][8]["auto"] == {"rule": "climbers_into_top", "n": 10}


async def test_us_gp_questions_answered_after_the_flag():
    result = json.loads((FIXTURES / "singapore_2026" / "session_result.json").read_text())
    teams = {d["driver_number"]: d["team_name"] for d in json.loads((FIXTURES / "singapore_2026" / "drivers.json").read_text())}
    points: dict[str, float] = {}
    for r in result:
        points[teams[r["driver_number"]]] = points.get(teams[r["driver_number"]], 0) + r["points"]
    assert points["Ferrari"] == points["Red Bull Racing"] == max(points.values())  # a real tie in the data

    vals = await answers(await race_data(FakeOpenF1()), US_GP_2026)
    assert vals[:3] == ["VER", "BOR", "LEC"]          # winner, first retirement (lap 7), fastest lap
    assert isinstance(vals[3], NoValue) and "Tie" in str(vals[3])   # constructors tied: entered by hand
    assert vals[4:] == [19, "VER", False, False,        # finishers, leader after lap 1, no red flag, no SC (VSCs only)
                        ["RUS", "HAD"],                 # both started outside the top 10 and finished inside it
                        1]                              # ANT: P3 from P4


async def test_us_gp_questions_during_the_race():
    vals = await answers(await race_data(FakeOpenF1(cutoff=LIVE_AT)), US_GP_2026)
    # lap ~16: VER leads and has the fastest lap so far, BOR has stopped (21 still running), Ferrari lead on
    # points by the running order, BEA is the only climber into the top 10, nobody on the podium from outside
    assert vals[:5] == ["VER", "BOR", "VER", "Ferrari", 21]
    assert vals[5] == "VER"                                            # led after lap 1
    assert vals[6:] == [False, False, ["BEA"], 0]


async def test_grid_questions_wait_when_the_grid_is_unknown():
    vals = await answers(await race_data(FakeOpenF1("monaco_2026")), US_GP_2026)  # recording has no position data
    assert vals[3] == "Mercedes"
    assert all(isinstance(vals[i], NoValue) for i in (5, 8, 9))


async def test_us_gp_scored_end_to_end(make_race, client, admin, login, use_openf1):
    use_openf1(FakeOpenF1())
    race = await make_race(questions=US_GP_2026)
    q = [x["id"] for x in race["questions"]]
    player = await login("fan@example.com")
    picks = {q[0]: "VER", q[1]: "STR", q[2]: "LEC", q[3]: "Ferrari", q[4]: 18, q[6]: False, q[7]: True,
             q[8]: ["RUS"], q[9]: 1}   # Q6 left blank
    r = await client.put(f"/races/{race['id']}/answers", headers=player, json={"answers": {str(k): v for k, v in picks.items()}})
    assert r.status_code == 200, r.text

    async with SessionLocal() as s:  # the quiz locks at lights out of the recorded race
        await s.execute(update(Race).where(Race.id == race["id"]).values(
            quiz_opens_at=SINGAPORE_START - timedelta(days=7), quiz_closes_at=SINGAPORE_START))
        await s.commit()

    rep = (await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})).json()
    assert rep["phase"] == "final"
    assert [x["status"] for x in rep["questions"]] == ["saved"] * 3 + ["no value"] + ["saved"] * 6
    # the constructors tie, settled by hand: both teams can't be right in a Pick one question, so pick one
    await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": {str(q[3]): "Ferrari"}})

    assert (await client.post(f"/admin/races/{race['id']}/score", headers=admin)).status_code == 200
    rows = (await client.get(f"/races/{race['id']}/leaderboard", headers=admin)).json()["rows"]
    # +15 winner, -3 retirement (STR, not BOR), +10 fastest lap, +10 Ferrari, -5 finishers (18 not 19),
    # 0 blank, +5 no red flag, -2 SC (there wasn't one), +10 RUS climbed into the top 10, +15 one podium from outside
    assert rows[0]["points"] == 15 - 3 + 10 + 10 - 5 + 0 + 5 - 2 + 10 + 15


# ---------- FP1: replayed on the recorded 2026 Singapore FP1 ----------

FP1_DIR = FIXTURES / "singapore_2026_fp1"
FP1_START = datetime.fromisoformat("2026-10-09T08:30:00+00:00")


def fp1() -> FakeOpenF1:
    return FakeOpenF1("singapore_2026_fp1", session="Practice 1")


async def test_fp1_questions_answered_on_a_real_practice_session():
    result = json.loads((FP1_DIR / "session_result.json").read_text())
    by_number = {d["driver_number"]: d["name_acronym"] for d in json.loads((FP1_DIR / "drivers.json").read_text())}
    most = max(result, key=lambda r: r["number_of_laps"])

    vals = await answers(await race_data(fp1()), US_GP_2026_FP1)
    assert vals[:3] == ["RUS", ["RUS", "LEC", "NOR"], "Mercedes"]
    assert vals[3] == by_number[most["driver_number"]]                 # most laps, from the classification
    assert vals[4] == sum(r["number_of_laps"] for r in result) == 568  # every car's laps together
    assert isinstance(vals[5], NoValue) and "HER" in str(vals[5])      # Herta didn't drive in Singapore
    assert vals[6] is False                                            # no red flag
    assert 15 <= vals[7] <= 65


async def test_fp1_lap_counts_wait_for_the_classification():
    vals = await answers(await race_data(FakeOpenF1("singapore_2026_fp1", session="Practice 1",
                                                    cutoff=FP1_START + timedelta(minutes=30))), US_GP_2026_FP1)
    assert all(isinstance(v, NoValue) for v in vals[3:5])


async def test_fp1_quiz_linked_by_hand_and_filled(make_race, client, admin, use_openf1):
    use_openf1(fp1())
    race = await make_race(questions=US_GP_2026_FP1)
    async with SessionLocal() as s:
        await s.execute(update(Race).where(Race.id == race["id"]).values(
            quiz_opens_at=FP1_START - timedelta(days=2), quiz_closes_at=FP1_START))
        await s.commit()
    r = await client.post(f"/admin/races/{race['id']}/openf1/link", headers=admin, json={"session_key": SINGAPORE_FP1})
    assert r.status_code == 200, r.text
    rep = (await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})).json()
    assert rep["phase"] == "final" and rep["session_key"] == SINGAPORE_FP1
    assert [q["status"] for q in rep["questions"]] == ["saved"] * 5 + ["no value"] + ["saved"] * 2
