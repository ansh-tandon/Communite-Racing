"""Race setup, the quiz window, and answer autosave (the integrity-critical path)."""

import asyncio
from datetime import timedelta

from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.models import Answer, Submission
from app.services.races import close_due_races
from tests.conftest import QUESTIONS, deadline_passed, qids, set_window


# ---------- admin setup ----------

async def test_players_cant_use_admin(login, client):
    h = await login("player@example.com")
    assert (await client.get("/admin/races", headers=h)).status_code == 403
    assert (await client.get("/admin/races")).status_code == 401


async def test_create_race_with_questions(make_race):
    race = await make_race(open=False)
    assert race["status"] == "draft"
    assert [q["sequence"] for q in race["questions"]] == [1, 2, 3, 4, 5]
    assert race["questions"][1]["config"] == {"pick": 3}


async def test_invalid_question_rejected(client, admin):
    body = {"season": 2026, "round": 1, "name": "Bad GP", "circuit": "Nowhere",
            "quiz_opens_at": "2026-10-01T10:00:00+05:30", "quiz_closes_at": "2026-10-01T09:00:00+05:30",
            "questions": [{"prompt": "Podium?", "type": "ranked", "options": ["A", "B"], "config": {}}]}
    r = await client.post("/admin/races", json=body, headers=admin)
    assert r.status_code == 422 and '\\"pick\\"' in r.text

    body["questions"] = []
    r = await client.post("/admin/races", json=body, headers=admin)
    assert r.status_code == 422 and "quiz_closes_at must be after" in r.text


async def test_duplicate_round_rejected(make_race):
    await make_race(round=3, open=False)
    try:
        await make_race(round=3, open=False)
    except AssertionError as e:
        assert "409" in str(e) or "already exists" in str(e)
    else:
        raise AssertionError("second round 3 was accepted")


async def test_draft_hidden_until_opened(make_race, login, client, admin):
    race = await make_race(open=False)
    h = await login("player@example.com")
    assert (await client.get("/races", headers=h)).json() == []
    assert (await client.get(f"/races/{race['id']}", headers=h)).status_code == 404
    r = await client.put(f"/races/{race['id']}/answers", headers=h, json={"answers": {qids(race)[0]: "VER"}})
    assert r.status_code == 404

    assert (await client.post(f"/admin/races/{race['id']}/open", headers=admin)).json()["status"] == "open"
    races = (await client.get("/races", headers=h)).json()
    assert [(r["id"], r["phase"], r["question_count"]) for r in races] == [(race["id"], "open", 5)]


async def test_cant_open_without_questions(make_race, client, admin):
    race = await make_race(questions=[], open=False)
    r = await client.post(f"/admin/races/{race['id']}/open", headers=admin)
    assert r.status_code == 409 and "question" in r.json()["detail"]


async def test_copy_questions_from_previous_race(make_race, client, admin):
    await make_race(round=1)
    r2 = await make_race(round=2, questions=[], open=False)
    r = await client.post(f"/admin/races/{r2['id']}/copy-questions", headers=admin, json={})
    assert r.json() == {"copied": len(QUESTIONS)}
    copied = (await client.get(f"/admin/races/{r2['id']}", headers=admin)).json()["questions"]
    assert [q["prompt"] for q in copied] == [q["prompt"] for q in QUESTIONS]
    # Second copy refused: the race already has questions.
    assert (await client.post(f"/admin/races/{r2['id']}/copy-questions", headers=admin, json={})).status_code == 409


async def test_copy_needs_an_earlier_race(make_race, client, admin):
    r1 = await make_race(round=1, questions=[], open=False)
    r = await client.post(f"/admin/races/{r1['id']}/copy-questions", headers=admin, json={})
    assert r.status_code == 404


# ---------- answering ----------

async def test_autosave_one_at_a_time(make_race, login, client):
    race = await make_race()
    q = qids(race)
    h = await login("player@example.com")
    url = f"/races/{race['id']}/answers"

    assert (await client.put(url, headers=h, json={"answers": {q[0]: "VER"}})).json()["answers"] == {str(q[0]): "VER"}
    await client.put(url, headers=h, json={"answers": {q[1]: ["VER", "NOR"]}})  # podium half-done
    await client.put(url, headers=h, json={"answers": {q[0]: "NOR"}})  # changed mind
    r = await client.put(url, headers=h, json={"answers": {q[3]: False, q[4]: 0}})
    assert r.json()["answers"] == {str(q[0]): "NOR", str(q[1]): ["VER", "NOR"], str(q[3]): False, str(q[4]): 0}

    detail = (await client.get(f"/races/{race['id']}", headers=h)).json()
    assert detail["answered_count"] == 4 and detail["entries"] == 1 and detail["results"] is None
    assert detail["my_answers"][str(q[0])] == "NOR"

    # null clears an answer
    r = await client.put(url, headers=h, json={"answers": {q[0]: None}})
    assert str(q[0]) not in r.json()["answers"]


async def test_bad_answer_saves_nothing(make_race, login, client):
    race = await make_race()
    q = qids(race)
    h = await login("player@example.com")
    r = await client.put(f"/races/{race['id']}/answers", headers=h,
                         json={"answers": {q[0]: "VER", q[1]: ["VER", "VER"], q[4]: 99, 999999: "x"}})
    assert r.status_code == 422
    errors = r.json()["errors"]
    assert set(errors) == {str(q[1]), str(q[4]), "999999"}
    # All-or-nothing: the valid answer in the same request wasn't saved either.
    assert (await client.get(f"/races/{race['id']}", headers=h)).json()["my_answers"] == {}


async def test_answers_from_another_race_rejected(make_race, login, client):
    r1, r2 = await make_race(round=1), await make_race(round=2)
    h = await login("player@example.com")
    r = await client.put(f"/races/{r1['id']}/answers", headers=h, json={"answers": {qids(r2)[0]: "VER"}})
    assert r.status_code == 422


async def test_not_open_yet(make_race, login, client):
    race = await make_race()
    await set_window(race["id"], timedelta(hours=1), timedelta(hours=2))
    h = await login("player@example.com")
    assert (await client.get("/races", headers=h)).json()[0]["phase"] == "upcoming"
    r = await client.put(f"/races/{race['id']}/answers", headers=h, json={"answers": {qids(race)[0]: "VER"}})
    assert r.status_code == 409 and "isn't open" in r.json()["detail"]


async def test_deadline_locks_answers_even_before_scheduler_runs(make_race, login, client):
    race = await make_race()
    h = await login("player@example.com")
    url = f"/races/{race['id']}/answers"
    assert (await client.put(url, headers=h, json={"answers": {qids(race)[0]: "VER"}})).status_code == 200
    await deadline_passed(race["id"])
    # Status is still "open" in the database; the save itself checks the clock.
    r = await client.put(url, headers=h, json={"answers": {qids(race)[0]: "NOR"}})
    assert r.status_code == 409 and "locked" in r.json()["detail"]
    assert (await client.get(f"/races/{race['id']}", headers=h)).json()["my_answers"] == {str(qids(race)[0]): "VER"}


async def test_scheduler_sweep_closes_due_races(make_race, client, admin):
    due, running = await make_race(round=1), await make_race(round=2)
    await deadline_passed(due["id"])
    async with SessionLocal() as s:
        assert await close_due_races(s) == [due["id"]]
    statuses = {r["id"]: r["status"] for r in (await client.get("/admin/races", headers=admin)).json()}
    assert statuses == {due["id"]: "closed", running["id"]: "open"}


async def test_admin_can_close_early(make_race, login, client, admin):
    race = await make_race()
    h = await login("player@example.com")
    assert (await client.post(f"/admin/races/{race['id']}/close", headers=admin)).json()["status"] == "closed"
    r = await client.put(f"/races/{race['id']}/answers", headers=h, json={"answers": {qids(race)[0]: "VER"}})
    assert r.status_code == 409


async def test_concurrent_saves_make_one_entry(make_race, login, client):
    """The gate test: a burst of simultaneous saves from one player never creates two entries
    or loses an answer, and every request succeeds."""
    race = await make_race()
    q = qids(race)
    h = await login("player@example.com")
    url = f"/races/{race['id']}/answers"
    picks = ["VER", "NOR", "LEC", "HAM"] * 5

    results = await asyncio.gather(*[
        client.put(url, headers=h, json={"answers": {q[0]: p, q[3]: i % 2 == 0}}) for i, p in enumerate(picks)
    ])
    assert [r.status_code for r in results] == [200] * len(picks)

    async with SessionLocal() as s:
        assert await s.scalar(select(func.count()).select_from(Submission)) == 1
        assert await s.scalar(select(func.count()).select_from(Answer)) == 2
    final = (await client.get(f"/races/{race['id']}", headers=h)).json()["my_answers"]
    assert final[str(q[0])] in picks


async def test_many_players_at_once(make_race, login, client):
    race = await make_race()
    q = qids(race)
    players = [await login(f"p{i}@example.com") for i in range(15)]
    results = await asyncio.gather(*[
        client.put(f"/races/{race['id']}/answers", headers=h, json={"answers": {q[0]: "VER", q[4]: i}})
        for i, h in enumerate(players)
    ])
    assert all(r.status_code == 200 for r in results)
    async with SessionLocal() as s:
        assert await s.scalar(select(func.count()).select_from(Submission)) == 15
