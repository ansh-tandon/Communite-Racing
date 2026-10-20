"""Fill the database with the rest of the 2026 season, optionally with sample players.

    python -m app.seed                     the rounds still to come: questions (answered by OpenF1), quizzes open
    python -m app.seed --sample-players 30 rounds 15-23 + 30 sample players (default 40, max 40) with
                                           answers; races already run are scored from the real OpenF1 results
    python -m app.seed --remove-sample-players

Each quiz opens a week before lights out and locks at lights out, so finished races show results,
the race this week is open, and the rest show as coming up. Safe to run twice: existing rounds and
players are left alone. Sample players use @example.com addresses, which can never receive email.
"""

import argparse
import asyncio
import random
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert

from app.core.db import SessionLocal, engine
from app.core.security import utcnow
from app.models import Answer, Question, Race, Submission, User
from app.services.openf1 import close_client, get_client
from app.services.openf1.client import OpenF1Error
from app.services.openf1.sync import sync_race
from app.services.questions import validate_value
from app.services.races import ActionError
from app.services.results import answer_key, save_answer_key, score_race

# (round, name, circuit, country, lights out UTC): the 2026 calendar as revised, official start times.
SEASON = 2026
CALENDAR = [
    (15, "Azerbaijan Grand Prix", "Baku City Circuit", "Azerbaijan", "2026-09-26T11:00:00+00:00"),
    (16, "Bahrain Grand Prix", "Sepang International Circuit", "Malaysia", "2026-10-04T07:00:00+00:00"),
    (17, "Singapore Grand Prix", "Marina Bay Street Circuit", "Singapore", "2026-10-11T12:00:00+00:00"),
    (18, "United States Grand Prix", "Circuit of the Americas", "United States", "2026-10-25T20:00:00+00:00"),
    (19, "Mexico City Grand Prix", "Autódromo Hermanos Rodríguez", "Mexico", "2026-11-01T20:00:00+00:00"),
    (20, "São Paulo Grand Prix", "Autódromo José Carlos Pace", "Brazil", "2026-11-08T17:00:00+00:00"),
    (21, "Las Vegas Grand Prix", "Las Vegas Strip Circuit", "United States", "2026-11-22T04:00:00+00:00"),
    (22, "Qatar Grand Prix", "Lusail International Circuit", "Qatar", "2026-11-29T16:00:00+00:00"),
    (23, "Abu Dhabi Grand Prix", "Yas Marina Circuit", "United Arab Emirates", "2026-12-06T13:00:00+00:00"),
]

GRID = ["NOR", "PIA", "VER", "HAD", "LEC", "HAM", "RUS", "ANT", "ALO", "STR", "SAI",
        "ALB", "GAS", "COL", "OCO", "BEA", "HUL", "BOR", "LAW", "LIN", "PER", "BOT"]
FRONT = ["NOR", "PIA", "VER", "LEC", "RUS", "HAM", "ANT", "ALO", "HAD", "SAI"]


def questions() -> list[dict]:
    return [
        {"prompt": "Who wins the race?", "type": "single", "weight": 10, "options": FRONT,
         "auto": {"rule": "winner"}},
        {"prompt": "Predict the podium", "type": "ranked", "weight": 15, "options": FRONT, "config": {"pick": 3},
         "auto": {"rule": "top", "n": 3}},
        {"prompt": "Pick 3 drivers in the top 10 after lap 10", "type": "multi", "weight": 9, "options": GRID,
         "config": {"pick": 3}, "auto": {"rule": "top_after_lap", "lap": 10, "n": 10}},
        {"prompt": "Will the Safety Car come out?", "type": "yes_no", "weight": 5,
         "auto": {"rule": "safety_car", "include_vsc": False}},
        {"prompt": "How many cars finish the race?", "type": "number", "weight": 6,
         "config": {"min": 10, "max": 22, "tolerance": 1}, "auto": {"rule": "classified_finishers"}},
        {"prompt": "Who sets the fastest lap?", "type": "single", "weight": 5, "options": FRONT,
         "auto": {"rule": "fastest_lap"}},
        {"prompt": "Will both Ferraris finish in the points?", "type": "yes_no", "weight": 5,
         "auto": {"rule": "team_both_in_top", "team": "Ferrari", "n": 10}},
    ]


SAMPLE_NAMES = [
    "Meera S.", "Jonas W.", "Diego R.", "Aiko T.", "Priya N.", "Tom B.", "Lucía F.", "Kwame A.", "Sofia L.", "Arjun M.",
    "Hannah K.", "Mateo G.", "Yuki H.", "Chloe D.", "Ravi P.", "Elena V.", "Omar F.", "Isla M.", "Noah C.", "Ana P.",
    "Felix O.", "Zara Q.", "Luca B.", "Grace Y.", "Ibrahim K.", "Nina J.", "Kenji S.", "Maya R.", "Ethan W.", "Leila H.",
    "Pablo M.", "Freya N.", "Dev A.", "Sara L.", "Marco T.", "Amara E.", "Hugo D.", "Inès C.", "Ollie G.", "Tara V.",
]
SAMPLE_EMAIL = "sample.player{}@example.com"
SAMPLE_LIKE = "sample.player%@example.com"


def sample_answer(rng: random.Random, q: Question):
    if q.type == "single":
        return rng.choice(q.options[:6])
    if q.type == "yes_no":
        return rng.random() > 0.45
    if q.type == "number":
        return rng.randint(14, 20)
    if q.type == "ranked":
        return rng.sample(q.options[:6], 3)
    return rng.sample(q.options[:12], 3)


async def add_races(include_finished: bool) -> list[int]:
    """Create the missing rounds and open their quizzes. Returns the new race ids.

    Races already run are only added with sample players: for real players they'd be empty quizzes."""
    created = []
    async with SessionLocal() as s:
        for rnd, name, circuit, country, start in CALENDAR:
            if not include_finished and datetime.fromisoformat(start) < utcnow():
                print(f"  R{rnd} {name}: already run, skipped")
                continue
            if await s.scalar(select(Race.id).where(Race.season == SEASON, Race.round == rnd)):
                print(f"  R{rnd} {name}: already there, left alone")
                continue
            closes = datetime.fromisoformat(start)
            race = Race(season=SEASON, round=rnd, name=name, circuit=circuit, country=country,
                        quiz_opens_at=closes - timedelta(days=7), quiz_closes_at=closes, status="open")
            for i, q in enumerate(questions(), start=1):
                race.questions.append(Question(sequence=i, prompt=q["prompt"], type=q["type"], weight=q["weight"],
                                               options=q.get("options", []), config=q.get("config", {}), auto=q["auto"]))
            s.add(race)
            await s.flush()
            created.append(race.id)
            print(f"  R{rnd} {name}: added, quiz {closes - timedelta(days=7):%d %b} to {closes:%d %b %H:%M} UTC")
        await s.commit()
    return created


async def add_sample_players(race_ids: list[int], count: int) -> None:
    rng = random.Random(7)
    now = utcnow()
    async with SessionLocal() as s:
        await s.execute(insert(User).values([
            {"email": SAMPLE_EMAIL.format(i), "display_name": n} for i, n in enumerate(SAMPLE_NAMES[:count], start=1)
        ]).on_conflict_do_nothing(index_elements=["email"]))
        players = (await s.scalars(select(User.id).where(User.email.like(SAMPLE_LIKE)).order_by(User.id))).all()
        await s.commit()

        races = (await s.scalars(select(Race).where(Race.id.in_(race_ids)).order_by(Race.round))).all()
        for race in races:
            if race.quiz_opens_at > now:
                continue  # not open yet: nobody has answered
            qs = (await s.scalars(select(Question).where(Question.race_id == race.id).order_by(Question.sequence))).all()
            for uid in players:
                if rng.random() < 0.12:
                    continue  # some players skip a race
                sub = await s.scalar(insert(Submission).values(user_id=uid, race_id=race.id).returning(Submission.id))
                await s.execute(insert(Answer), [
                    {"submission_id": sub, "question_id": q.id,
                     "value": validate_value(q.type, q.options, q.config, sample_answer(rng, q))} for q in qs])
        await s.commit()
    print(f"  {len(players)} sample players; answers added to every race that has opened")


async def score_finished(race_ids: list[int]) -> None:
    """Fill results from OpenF1 (real results), anything it can't answer at random, then score."""
    rng = random.Random(11)
    client = get_client()
    async with SessionLocal() as s:
        races = (await s.scalars(select(Race).where(Race.id.in_(race_ids), Race.quiz_closes_at < utcnow() - timedelta(hours=3))
                                 .order_by(Race.round))).all()
        for race in races:
            label = f"R{race.round} {race.name}"
            try:
                rep = await sync_race(s, client, race.id)
                got = sum(1 for q in rep.questions if q.status == "saved")
                print(f"  {label}: {got} results from OpenF1 ({rep.phase})")
            except (ActionError, OpenF1Error) as e:
                print(f"  {label}: OpenF1 unavailable ({e}); using sample results")
            key = await answer_key(s, race.id)
            qs = (await s.scalars(select(Question).where(Question.race_id == race.id))).all()
            missing = {q.id: sample_answer(rng, q) if q.type != "ranked" else rng.sample(q.options[:6], 3)
                       for q in qs if q.id not in key}
            if missing:
                await save_answer_key(s, race.id, None, missing)
                print(f"    {len(missing)} result(s) OpenF1 couldn't give were filled with sample values")
            summary = await score_race(s, race.id, None)
            print(f"    scored: {summary['entries']} entries, published")
    await close_client()


async def remove_sample_players() -> None:
    async with SessionLocal() as s:
        n = await s.scalar(select(func.count()).where(User.email.like(SAMPLE_LIKE)))
        await s.execute(delete(User).where(User.email.like(SAMPLE_LIKE)))
        await s.commit()
    print(f"Removed {n} sample players with their answers and scores.")


async def main() -> None:
    p = argparse.ArgumentParser(description="Fill the database with the 2026 season.")
    p.add_argument("--sample-players", type=int, nargs="?", const=40, default=0, metavar="N",
                   help="add N sample players (default 40, max 40) with answers and results")
    p.add_argument("--remove-sample-players", action="store_true", help="delete the sample players")
    args = p.parse_args()
    try:
        if args.remove_sample_players:
            await remove_sample_players()
            return
        print("Races:")
        created = await add_races(include_finished=args.sample_players > 0)
        if args.sample_players and created:
            print("Sample players:")
            await add_sample_players(created, min(args.sample_players, len(SAMPLE_NAMES)))
            print("Finished races:")
            await score_finished(created)
        elif args.sample_players:
            print("No new races, so no sample answers were added.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
