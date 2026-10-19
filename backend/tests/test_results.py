"""Answer key, exactly-once scoring, re-score, publishing and standings."""

import asyncio

from tests.conftest import deadline_passed, qids

# Real result for the standard QUESTIONS: winner, podium, top-10 after lap 10, safety car, SC pit stops.
# The top-10 question only offers 6 drivers in the test data; all 6 made the top 10.
RESULT = ["VER", ["VER", "NOR", "LEC"], ["VER", "NOR", "PIA", "LEC", "HAM", "ALO"], True, 4]


def key_for(race: dict, values=RESULT) -> dict:
    return {str(qid): v for qid, v in zip(qids(race), values)}


async def played_race(make_race, login, client, round: int = 1, **extra):
    """A race with three players' answers, past its deadline. Returns (race, {name: headers})."""
    race = await make_race(round=round, **extra)
    q = qids(race)
    players = {n: await login(f"{n}@example.com") for n in ("lando", "max", "oscar")}
    answers = {
        "lando": {q[0]: "VER", q[1]: ["VER", "NOR", "LEC"], q[2]: ["VER", "NOR", "PIA"], q[3]: True, q[4]: 4},  # 45
        "max":   {q[0]: "VER", q[1]: ["VER", "LEC", "NOR"], q[3]: True},                                      # 20
        "oscar": {q[0]: "NOR", q[2]: ["VER", "NOR", "HAM"], q[3]: False, q[4]: 3},                            # 9 + 6 = 15
    }
    for n, a in answers.items():
        r = await client.put(f"/races/{race['id']}/answers", headers=players[n], json={"answers": a})
        assert r.status_code == 200, r.text
    await deadline_passed(race["id"])
    return race, players


async def test_save_and_score_in_one_click(make_race, login, client, admin):
    race, p = await played_race(make_race, login, client)
    r = await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": key_for(race), "score": True})
    assert r.status_code == 200, r.text
    assert r.json()["scored"] == {"race_id": race["id"], "entries": 3, "max_points": 45, "published": True, "rescored": False}

    board = (await client.get(f"/races/{race['id']}/leaderboard", headers=p["max"])).json()
    assert [(row["rank"], row["points"]) for row in board["rows"]] == [(1, 45), (2, 20), (3, 15)]

    mine = (await client.get(f"/races/{race['id']}", headers=p["max"])).json()
    assert mine["phase"] == "results"
    assert mine["results"]["points"] == 20 and mine["results"]["rank"] == 2 and mine["results"]["max_points"] == 45
    assert list(mine["results"]["points_by_question"].values()) == [10, 5, 0, 5, 0]
    assert mine["results"]["answer_key"][str(qids(race)[0])] == "VER"

    listed = (await client.get("/races", headers=p["max"])).json()[0]
    assert (listed["my_points"], listed["my_rank"]) == (20, 2)


async def test_result_entered_in_steps_then_scored(make_race, login, client, admin):
    """Fill results during the race (e.g. safety car), finish after the flag."""
    race, _ = await played_race(make_race, login, client)
    url = f"/admin/races/{race['id']}/answer-key"
    k = key_for(race)
    first = {kk: k[kk] for kk in list(k)[3:]}
    assert len((await client.put(url, headers=admin, json={"answers": first})).json()["answer_key"]) == 2

    r = await client.post(f"/admin/races/{race['id']}/score", headers=admin)
    assert r.status_code == 409 and "Missing: Q1, Q2, Q3" in r.json()["detail"]
    # The failed attempt changed nothing: the partial key is still saved and the race is still scoreable.
    rest = {kk: k[kk] for kk in list(k)[:3]}
    r = await client.put(url, headers=admin, json={"answers": rest, "score": True})
    assert r.status_code == 200 and r.json()["scored"]["entries"] == 3


async def test_invalid_result_rejected(make_race, login, client, admin):
    race, _ = await played_race(make_race, login, client)
    bad = key_for(race, ["VER", ["VER", "NOR"], ["VER"], "yes", 4])  # podium incomplete, "yes" not a bool
    r = await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": bad, "score": True})
    assert r.status_code == 422 and set(r.json()["errors"]) == {str(qids(race)[1]), str(qids(race)[3])}


async def test_cant_score_while_quiz_open(make_race, client, admin):
    race = await make_race()
    r = await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": key_for(race), "score": True})
    assert r.status_code == 409 and "still open" in r.json()["detail"]


async def test_concurrent_scoring_runs_exactly_once(make_race, login, client, admin):
    race, _ = await played_race(make_race, login, client)
    await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": key_for(race)})

    results = await asyncio.gather(*[client.post(f"/admin/races/{race['id']}/score", headers=admin) for _ in range(8)])
    codes = sorted(r.status_code for r in results)
    assert codes == [200] + [409] * 7, [r.text for r in results]
    board = (await client.get(f"/races/{race['id']}/leaderboard", headers=admin)).json()["rows"]
    assert len(board) == 3  # no duplicate score rows


async def test_scoring_waits_for_answers_in_flight(make_race, login, client, admin):
    """Admin closes and scores while players are still hammering save: every save either lands
    before scoring and counts, or is refused. Nothing is saved after scores are computed."""
    race = await make_race()
    q = qids(race)
    players = [await login(f"p{i}@example.com") for i in range(10)]

    async def save(h):
        return await client.put(f"/races/{race['id']}/answers", headers=h, json={"answers": {q[0]: "VER"}})

    async def close_and_score():
        await client.post(f"/admin/races/{race['id']}/close", headers=admin)
        return await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin,
                                json={"answers": key_for(race), "score": True})

    *saves, scored = await asyncio.gather(*[save(h) for h in players], close_and_score())
    assert scored.status_code == 200, scored.text
    accepted = sum(r.status_code == 200 for r in saves)
    assert all(r.status_code in (200, 409) for r in saves)
    board = (await client.get(f"/races/{race['id']}/leaderboard", headers=admin)).json()["rows"]
    assert len(board) == accepted and all(row["points"] == 10 for row in board)


async def test_rescore_after_penalty(make_race, login, client, admin):
    race, p = await played_race(make_race, login, client)
    await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": key_for(race), "score": True})

    # Not via the normal key endpoint once scored.
    r = await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": {str(qids(race)[0]): "NOR"}})
    assert r.status_code == 409 and "re-score" in r.json()["detail"]

    # Penalty: VER loses the win, NOR inherits it.
    penalty = {str(qids(race)[0]): "NOR", str(qids(race)[1]): ["NOR", "LEC", "VER"]}
    r = await client.post(f"/admin/races/{race['id']}/rescore", headers=admin, json={"answers": penalty})
    assert r.status_code == 200 and r.json()["rescored"] is True

    board = {row["name"]: (row["rank"], row["points"]) for row in
             (await client.get(f"/races/{race['id']}/leaderboard", headers=admin)).json()["rows"]}
    # oscar: 10 + 0 + 9 + 0 + 6 = 25 · lando: 0 + 0 + 9 + 5 + 6 = 20 · max: 0 + 5 (LEC still P2) + 0 + 5 + 0 = 10
    assert sorted(board.values()) == [(1, 25), (2, 20), (3, 10)]

    # Re-scoring twice is harmless.
    assert (await client.post(f"/admin/races/{race['id']}/rescore", headers=admin, json={})).status_code == 200
    rows = (await client.get(f"/races/{race['id']}/leaderboard", headers=admin)).json()["rows"]
    assert len(rows) == 3


async def test_rescore_needs_a_scored_race(make_race, login, client, admin):
    race, _ = await played_race(make_race, login, client)
    r = await client.post(f"/admin/races/{race['id']}/rescore", headers=admin, json={})
    assert r.status_code == 409


async def test_held_reveal_until_publish(make_race, login, client, admin):
    race, p = await played_race(make_race, login, client, reveal_immediately=False)
    r = await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": key_for(race), "score": True})
    assert r.json()["scored"]["published"] is False

    # Players see nothing yet; the admin can review.
    assert (await client.get(f"/races/{race['id']}/leaderboard", headers=p["max"])).status_code == 403
    mine = (await client.get(f"/races/{race['id']}", headers=p["max"])).json()
    assert mine["results"] is None and mine["phase"] == "closed"
    assert (await client.get("/standings", headers=p["max"])).json()["rows"] == []
    assert len((await client.get(f"/races/{race['id']}/leaderboard", headers=admin)).json()["rows"]) == 3

    assert (await client.post(f"/admin/races/{race['id']}/publish", headers=admin)).json()["published_at"]
    assert len((await client.get(f"/races/{race['id']}/leaderboard", headers=p["max"])).json()["rows"]) == 3


async def test_season_standings_add_up(make_race, login, client, admin):
    r1, p = await played_race(make_race, login, client, round=1)
    await client.put(f"/admin/races/{r1['id']}/answer-key", headers=admin, json={"answers": key_for(r1), "score": True})

    r2 = await make_race(round=2)
    q = qids(r2)
    await client.put(f"/races/{r2['id']}/answers", headers=p["oscar"], json={"answers": {q[0]: "VER", q[3]: True, q[4]: 4}})
    await client.put(f"/races/{r2['id']}/answers", headers=p["max"], json={"answers": {q[0]: "LEC"}})
    await deadline_passed(r2["id"])
    await client.put(f"/admin/races/{r2['id']}/answer-key", headers=admin, json={"answers": key_for(r2), "score": True})

    s = (await client.get("/standings", headers=p["max"])).json()
    assert s["season"] == 2026
    # user ids: 1 admin, 2 lando, 3 max, 4 oscar
    # lando 45 (one race) · oscar 15 + 21 = 36 · max 20 + 0 = 20
    assert [(row["user_id"], row["points"], row["rank"]) for row in s["rows"]] == [(2, 45, 1), (4, 36, 2), (3, 20, 3)]
    oscar = s["rows"][1]
    assert oscar["name"] == "Player 4" and oscar["races"] == 2 and oscar["wins"] == 1


async def test_names_show_in_leaderboard(make_race, login, client, admin):
    race, p = await played_race(make_race, login, client)
    await client.patch("/auth/me", headers=p["lando"], json={"display_name": "Lando N"})
    await client.put(f"/admin/races/{race['id']}/answer-key", headers=admin, json={"answers": key_for(race), "score": True})
    rows = (await client.get(f"/races/{race['id']}/leaderboard", headers=p["max"])).json()["rows"]
    assert rows[0]["name"] == "Lando N"
    assert "email" not in rows[0]
