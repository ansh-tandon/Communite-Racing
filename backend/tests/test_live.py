"""Live standings: provisional points between the lock and published results, from live OpenF1 values."""

from datetime import timedelta

from sqlalchemy import update

from app.core.db import SessionLocal
from app.models import Race
from app.question_sets import US_GP_2026_FP1
from tests.openf1_fake import SINGAPORE_FP1, SINGAPORE_START, FakeOpenF1
from tests.test_openf1 import fresh_sync_state, use_openf1  # noqa: F401  (fixtures)

LIVE_AT = SINGAPORE_START + timedelta(minutes=30)  # lap ~16: VER leads, one VSC so far

QS = [
    {"prompt": "Who wins?", "type": "single", "weight": 5, "options": ["VER", "LEC", "NOR"], "config": {"penalty": 1},
     "auto": {"rule": "winner"}},
    {"prompt": "Safety car or VSC?", "type": "yes_no", "weight": 5, "config": {"penalty": 1},
     "auto": {"rule": "safety_car", "include_vsc": True}},
    {"prompt": "How many cars finish?", "type": "number", "weight": 5, "config": {"penalty": 1, "tolerance": 1},
     "auto": {"rule": "classified_finishers"}},
]


async def lock_at(race_id: int, at=SINGAPORE_START) -> None:
    async with SessionLocal() as s:
        await s.execute(update(Race).where(Race.id == race_id).values(quiz_opens_at=at - timedelta(days=7), quiz_closes_at=at))
        await s.commit()


async def two_players(client, login, race) -> tuple[dict, dict]:
    q = [x["id"] for x in race["questions"]]
    a, b = await login("alice@example.com"), await login("bob@example.com")
    await client.put(f"/races/{race['id']}/answers", headers=a, json={"answers": {str(q[0]): "VER", str(q[1]): True, str(q[2]): 19}})
    await client.put(f"/races/{race['id']}/answers", headers=b, json={"answers": {str(q[0]): "NOR", str(q[1]): False}})
    return a, b


async def test_live_standings_follow_live_results_then_final(make_race, client, admin, login, use_openf1):
    race = await make_race(questions=QS)
    a, b = await two_players(client, login, race)
    assert (await client.get(f"/races/{race['id']}/live", headers=a)).status_code == 409  # still open
    await lock_at(race["id"])

    live = (await client.get(f"/races/{race['id']}/live", headers=a)).json()
    assert live["results_in"] == 0 and [r["points"] for r in live["rows"]] == [0, 0]  # nothing known: no penalties yet

    use_openf1(FakeOpenF1(cutoff=LIVE_AT))
    await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})
    live = (await client.get(f"/races/{race['id']}/live", headers=b)).json()
    assert (live["results_in"], live["live_results"]) == (2, 2)  # leader and VSC known; finishers wait for the flag
    assert [(r["name"], r["points"]) for r in live["rows"]] == [("Player 2", 10), ("Player 3", -2)]
    assert [(r["rank"], r["race_points"], r["prev_rank"]) for r in live["season_rows"]] == [(1, 10, None), (2, -2, None)]

    use_openf1(FakeOpenF1())
    await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})
    live = (await client.get(f"/races/{race['id']}/live", headers=a)).json()
    assert (live["results_in"], live["live_results"]) == (3, 0)
    assert [r["points"] for r in live["rows"]] == [15, -2]  # 19 finishers: Alice right, Bob left it blank

    assert (await client.post(f"/admin/races/{race['id']}/score", headers=admin)).status_code == 200
    assert (await client.get(f"/races/{race['id']}/live", headers=a)).status_code == 409  # published: real results now


async def test_season_rows_add_live_points_to_published_standings(make_race, client, admin, login, use_openf1):
    use_openf1(FakeOpenF1())
    first = await make_race(round=1, questions=QS)
    a, b = await two_players(client, login, first)
    await lock_at(first["id"])
    await client.post(f"/admin/races/{first['id']}/openf1/sync", headers=admin, json={})
    await client.post(f"/admin/races/{first['id']}/score", headers=admin)  # published: Alice 15, Bob -2

    second = await make_race(round=2, questions=QS)
    q = [x["id"] for x in second["questions"]]
    await client.put(f"/races/{second['id']}/answers", headers=b, json={"answers": {str(q[0]): "VER", str(q[1]): True, str(q[2]): 19}})
    await lock_at(second["id"], SINGAPORE_START + timedelta(hours=1))
    use_openf1(FakeOpenF1())
    await client.post(f"/admin/races/{second['id']}/openf1/link", headers=admin, json={"session_key": FakeOpenF1().race_key})
    await client.post(f"/admin/races/{second['id']}/openf1/sync", headers=admin, json={})

    rows = (await client.get(f"/races/{second['id']}/live", headers=a)).json()["season_rows"]
    assert [(r["rank"], r["points"], r["race_points"], r["prev_rank"]) for r in rows] == [
        (1, 15, None, 1),   # Alice: published 15, didn't enter this one
        (2, 13, 15, 2),     # Bob: -2 published + 15 live
    ]


async def test_a_practice_quiz_links_itself_to_the_practice_session(make_race, client, admin, use_openf1):
    fake = use_openf1(FakeOpenF1("singapore_2026_fp1", session="Practice 1"))
    race = await make_race(questions=US_GP_2026_FP1)
    fp1_start = SINGAPORE_START - timedelta(days=2, hours=3, minutes=30)  # 9 Oct 08:30 UTC
    await lock_at(race["id"], fp1_start + timedelta(minutes=30))
    rep = (await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})).json()
    assert rep["session_key"] == SINGAPORE_FP1 == fake.race_key and rep["phase"] == "final"


async def test_questions_answered_by_hand_dont_break_the_sync(make_race, client, admin, use_openf1):
    use_openf1(FakeOpenF1())
    hand = {"prompt": "Most laps?", "type": "single", "weight": 5, "options": ["VER", "LEC"], "config": {"penalty": 1}, "auto": None}
    race = await make_race(questions=[QS[0], hand])
    await lock_at(race["id"])
    r = await client.post(f"/admin/races/{race['id']}/openf1/sync", headers=admin, json={})
    assert r.status_code == 200, r.text
    assert [q["sequence"] for q in r.json()["questions"]] == [1]  # only the auto-answered question is read
