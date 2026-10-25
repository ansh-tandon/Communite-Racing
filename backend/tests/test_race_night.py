"""Race night, end to end, on tonight's US GP quiz: players sign up and predict, the quiz locks, the background
OpenF1 job (not an admin) fills live results every 20 s and the live standings move with them, the classification
makes them final, a tie is settled by hand, and Score publishes. The race is the recorded 2026 Singapore GP, replayed
as it stood at each moment."""

from datetime import timedelta

from sqlalchemy import update

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Race
from app.question_sets import US_GP_2026
from app.services.openf1 import sync as sync_mod
from tests.openf1_fake import SINGAPORE_START, FakeOpenF1
from tests.test_openf1 import fresh_sync_state  # noqa: F401  (fixture)

END = SINGAPORE_START + timedelta(hours=2)


def paid(cutoff=None):
    """OpenF1 as the server sees it with an account: the race up to `cutoff`, or the final data."""
    return FakeOpenF1(cutoff=cutoff).client(username="me", password="pw")


async def player(client, login, email: str, name: str) -> dict:
    h = await login(email)  # first login creates the account: signing up
    assert (await client.patch("/auth/me", headers=h, json={"display_name": name})).status_code == 200
    return h


async def live(client, race_id: int, h: dict) -> dict:
    r = await client.get(f"/races/{race_id}/live", headers=h)
    assert r.status_code == 200, r.text
    return r.json()


async def test_race_night(make_race, client, admin, login):
    race = await make_race(round=18, questions=US_GP_2026)
    rid, q = race["id"], [x["id"] for x in race["questions"]]

    # Players sign up and predict while the quiz is open.
    alice = await player(client, login, "alice@example.com", "Alice")
    bob = await player(client, login, "bob@example.com", "Bob")
    await player(client, login, "carol@example.com", "Carol")  # signs up, never predicts
    picks = {
        "Alice": (alice, {q[0]: "VER", q[1]: "BOR", q[2]: "LEC", q[3]: "Ferrari", q[4]: 19, q[5]: "HAD",
                          q[6]: False, q[7]: False, q[8]: ["RUS"], q[9]: 1}),
        "Bob": (bob, {q[0]: "LEC", q[2]: "VER", q[6]: True, q[7]: True, q[8]: ["BEA"], q[9]: 0}),
    }
    for h, answers in picks.values():
        r = await client.put(f"/races/{rid}/answers", headers=h, json={"answers": {str(k): v for k, v in answers.items()}})
        assert r.status_code == 200, r.text
    assert (await client.get(f"/races/{rid}/live", headers=alice)).status_code == 409  # no live standings while open

    # Lights out: the quiz locks. Linked by hand to the race session, as R18 is on the live site.
    async with SessionLocal() as s:
        await s.execute(update(Race).where(Race.id == rid).values(
            quiz_opens_at=SINGAPORE_START - timedelta(days=1), quiz_closes_at=SINGAPORE_START))
        await s.commit()
    assert (await client.post(f"/admin/races/{rid}/openf1/link", headers=admin,
                              json={"session_key": FakeOpenF1().race_key})).status_code == 200
    dave = await player(client, login, "dave@example.com", "Dave")  # signs up after the lock
    r = await client.put(f"/races/{rid}/answers", headers=dave, json={"answers": {str(q[0]): "VER"}})
    assert r.status_code != 200 and "locked" in r.text

    standings = await live(client, rid, alice)
    assert standings["results_in"] == 0 and {r["name"]: r["points"] for r in standings["rows"]} == {"Alice": 0, "Bob": 0}

    # Lap ~5: the background job reads OpenF1 by itself and saves live results; next read in 20 s.
    t1 = SINGAPORE_START + timedelta(minutes=10)
    [rep] = await sync_mod.sweep(paid(cutoff=t1), now=t1)
    assert rep.phase == "live" and rep.race_id == rid
    assert sync_mod._next_check[rid] == t1 + timedelta(seconds=get_settings().openf1_live_interval_seconds) == t1 + timedelta(seconds=20)
    early = await live(client, rid, bob)
    assert early["results_in"] > 0 and early["live_results"] == early["results_in"]

    # Lap ~16: a later read moves the standings without anyone touching the admin page.
    t2 = SINGAPORE_START + timedelta(minutes=30)
    [rep] = await sync_mod.sweep(paid(cutoff=t2), now=t2)
    mid = await live(client, rid, bob)
    # VER leads, VER has the fastest lap so far, no red flag or SC, BEA is the only climber into the top 10,
    # nobody on the podium from outside the top 3. Unknown answers score 0 for now.
    # Live too: BOR stopped first, Ferrari lead on points by the running order, 21 cars running; places gained tied.
    assert {r["name"]: r["points"] for r in mid["rows"]} == {
        "Alice": 15 + 10 - 3 + 10 - 5 + 0 + 5 + 5 - 3 - 5,   # 29
        "Bob": -5 + 10 - 2 - 2 + 10 + 15,                     # 26: fastest lap, BEA, 0 from outside right
    }
    assert [r["name"] for r in mid["rows"]] == ["Alice", "Bob"]
    # players can see what each question is scoring against right now
    now = {r["sequence"]: (r["value"], r["live"]) for r in mid["results"]}
    assert now[1] == ("VER", True) and now[2] == ("BOR", True) and now[6] == (None, False)
    assert {r["name"] for r in mid["season_rows"]} == {"Alice", "Bob"}  # entrants only: Carol and Dave never predicted
    assert mid["updated_at"] >= early["updated_at"]

    # After the flag: the classification makes everything final, except the constructors' tie.
    after = END + timedelta(minutes=20)
    [rep] = await sync_mod.sweep(paid(), now=after)
    assert rep.phase == "final"
    final = await live(client, rid, alice)
    # the constructors' tie: its last live value (Ferrari) is cleared, so it shows as missing, not provisional
    assert (final["questions"], final["results_in"], final["live_results"]) == (10, 9, 0)
    assert next(x for x in rep.questions if x.sequence == 4).note.endswith("enter it by hand.")
    # A tied question scores 0 for everyone until it's settled.
    assert {r["name"]: r["points"] for r in final["rows"]} == {"Alice": 100 - 10, "Bob": -5 - 3 - 2 - 2 - 3 - 5}

    # Settle the tie by hand, score, and it's published.
    r = await client.put(f"/admin/races/{rid}/answer-key", headers=admin, json={"answers": {str(q[3]): "Ferrari"}})
    assert r.status_code == 200, r.text
    assert (await client.post(f"/admin/races/{rid}/score", headers=admin)).status_code == 200
    board = (await client.get(f"/races/{rid}/leaderboard", headers=bob)).json()
    assert board["published"] and [(r["name"], r["points"], r["rank"]) for r in board["rows"]] == [("Alice", 100, 1), ("Bob", -20, 2)]
    season = (await client.get("/standings", headers=bob)).json()["rows"]
    assert [(r["name"], r["points"]) for r in season] == [("Alice", 100), ("Bob", -20)]
    assert (await client.get(f"/races/{rid}/live", headers=alice)).status_code == 409  # live view hands over to results
