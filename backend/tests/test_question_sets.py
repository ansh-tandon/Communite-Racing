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


def test_us_gp_questions_are_all_auto_answered():
    assert len(US_GP_2026) == 9
    assert sum(q["weight"] for q in US_GP_2026) == 65
    for q in US_GP_2026:
        assert q["auto"]["rule"] in RULES, q["prompt"]
        assert validate_auto(q["type"], q["auto"]), q["prompt"]


async def test_us_gp_questions_accepted_by_the_admin_api(make_race):
    race = await make_race(questions=US_GP_2026)
    assert [q["prompt"] for q in race["questions"]] == [q["prompt"] for q in US_GP_2026]
    assert race["questions"][4]["auto"] == {"rule": "driver_in_top", "driver": "PER", "n": 10}


async def test_us_gp_questions_answered_after_the_flag():
    vals = await answers(await race_data(FakeOpenF1()), US_GP_2026)
    assert vals == [
        "VER",                    # winner
        ["VER", "LEC", "ANT"],    # podium
        "VER",                    # leader after lap 1
        True,                     # pole sitter won
        False,                    # Pérez not in the top 10
        vals[5],                  # most places gained: checked below
        25,                       # pit stops
        2,                        # SC + VSC: two VSCs
        vals[8],                  # hottest track temperature: checked below
    ]
    assert vals[5] in US_GP_2026[5]["options"]
    assert 15 <= vals[8] <= 65


async def test_us_gp_questions_during_the_race():
    vals = await answers(await race_data(FakeOpenF1(cutoff=LIVE_AT)), US_GP_2026)
    assert vals[0] == "VER" and vals[2] == "VER"         # leading at the time, and after lap 1
    assert vals[6] == 0 and vals[7] == 1                 # no stops yet, one VSC so far
    assert isinstance(vals[5], NoValue)                  # places gained waits for the classification


async def test_us_gp_scored_end_to_end(make_race, client, admin, login, use_openf1):
    use_openf1(FakeOpenF1())
    race = await make_race(questions=US_GP_2026)
    qs = race["questions"]
    player = await login("fan@example.com")
    picks = {qs[0]["id"]: "VER", qs[1]["id"]: ["VER", "NOR", "ANT"], qs[2]["id"]: "LEC", qs[3]["id"]: True,
             qs[4]["id"]: True, qs[6]["id"]: 23, qs[7]["id"]: 2}
    r = await client.put(f"/races/{race['id']}/answers", headers=player, json={"answers": {str(k): v for k, v in picks.items()}})
    assert r.status_code == 200, r.text

    async with SessionLocal() as s:  # the quiz locks at lights out of the recorded race
        await s.execute(update(Race).where(Race.id == race["id"]).values(
            quiz_opens_at=SINGAPORE_START - timedelta(days=7), quiz_closes_at=SINGAPORE_START))
        await s.commit()

    rep = (await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})).json()
    assert rep["phase"] == "final"
    assert [q["status"] for q in rep["questions"]] == ["saved"] * 9

    assert (await client.post(f"/admin/races/{race['id']}/score", headers=admin)).status_code == 200
    rows = (await client.get(f"/races/{race['id']}/leaderboard", headers=admin)).json()["rows"]
    # winner 10 + podium P1 and P3 right (15 * 2 // 3 = 10) + pole converts 5 + pit stops 23 within 3 of 25 (6)
    # + two neutralisations 5; lap-1 leader and Pérez wrong
    assert rows[0]["points"] == 10 + 10 + 5 + 6 + 5


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
