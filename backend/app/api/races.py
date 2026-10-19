from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, Session
from app.models import Answer, Question, Race, Score, Submission
from app.schemas import (
    AnswersIn,
    AnswersOut,
    MyResults,
    QuestionOut,
    RaceDetail,
    RaceLeaderboard,
    RaceSummary,
    SeasonStandings,
)
from app.services.races import my_answers, questions_by_id, save_answers
from app.services.results import answer_key, entry_count, race_leaderboard, rules, season_standings
from app.services.scoring import max_points, score_answer

router = APIRouter(tags=["quiz"])


def phase(race: Race, now: datetime) -> str:
    if race.published_at is not None:
        return "results"
    if race.status in ("closed", "scoring", "scored") or now >= race.quiz_closes_at:
        return "closed"
    if now < race.quiz_opens_at:
        return "upcoming"
    return "open"


async def visible_race(s, race_id: int, user) -> Race:
    race = await s.get(Race, race_id)
    if race is None or (race.status == "draft" and not user.is_admin):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Race not found.")
    return race


@router.get("/races")
async def list_races(user: CurrentUser, s: Session, season: int | None = None) -> list[RaceSummary]:
    q = select(Race).where(Race.status != "draft").order_by(Race.season.desc(), Race.round.desc())
    if season:
        q = q.where(Race.season == season)
    races = (await s.scalars(q)).all()
    ids = [r.id for r in races]
    if not ids:
        return []

    qcount = dict((await s.execute(
        select(Question.race_id, func.count()).where(Question.race_id.in_(ids)).group_by(Question.race_id))).all())
    answered = dict((await s.execute(
        select(Submission.race_id, func.count(Answer.id))
        .join(Answer, Answer.submission_id == Submission.id)
        .where(Submission.user_id == user.id, Submission.race_id.in_(ids))
        .group_by(Submission.race_id))).all())
    mine = {r.race_id: r for r in await s.execute(
        select(Score.race_id, Score.points, Score.rank).where(Score.user_id == user.id, Score.race_id.in_(ids)))}
    now = await s.scalar(select(func.now()))

    out = []
    for r in races:
        sc = mine.get(r.id) if r.published_at else None
        out.append(RaceSummary(
            id=r.id, season=r.season, round=r.round, name=r.name, circuit=r.circuit, country=r.country,
            quiz_opens_at=r.quiz_opens_at, quiz_closes_at=r.quiz_closes_at, phase=phase(r, now),
            question_count=qcount.get(r.id, 0), answered_count=answered.get(r.id, 0),
            my_points=sc.points if sc else None, my_rank=sc.rank if sc else None,
        ))
    return out


@router.get("/races/{race_id}")
async def race_detail(race_id: int, user: CurrentUser, s: Session) -> RaceDetail:
    race = await visible_race(s, race_id, user)
    now = await s.scalar(select(func.now()))
    questions = await questions_by_id(s, race_id)
    mine = await my_answers(s, race_id, user.id)

    results = None
    if race.published_at is not None:
        key = await answer_key(s, race_id)
        qrules = rules(questions)
        per_q = {q.id: score_answer(q, mine.get(q.id), key.get(q.id)) for q in qrules}
        sc = (await s.execute(select(Score.points, Score.rank).where(Score.race_id == race_id, Score.user_id == user.id))).first()
        results = MyResults(answer_key=key, points_by_question=per_q, points=sc.points if sc else None,
                            rank=sc.rank if sc else None, max_points=max_points(qrules))

    return RaceDetail(
        id=race.id, season=race.season, round=race.round, name=race.name, circuit=race.circuit, country=race.country,
        quiz_opens_at=race.quiz_opens_at, quiz_closes_at=race.quiz_closes_at, phase=phase(race, now),
        question_count=len(questions), answered_count=len(mine),
        my_points=results.points if results else None, my_rank=results.rank if results else None,
        server_time=now, entries=await entry_count(s, race_id),
        questions=[QuestionOut.model_validate(q) for q in questions.values()],
        my_answers=mine, results=results,
    )


@router.put("/races/{race_id}/answers")
async def put_answers(race_id: int, body: AnswersIn, user: CurrentUser, s: Session) -> AnswersOut:
    """Autosave: send one answer as the player taps, or several at once. Locked at the deadline."""
    return AnswersOut(answers=await save_answers(s, race_id, user.id, body.answers))


@router.get("/races/{race_id}/leaderboard")
async def leaderboard(race_id: int, user: CurrentUser, s: Session) -> RaceLeaderboard:
    race = await visible_race(s, race_id, user)
    if race.published_at is None and not (user.is_admin and race.status == "scored"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Results aren't published yet.")
    return RaceLeaderboard(race_id=race_id, published=race.published_at is not None, rows=await race_leaderboard(s, race_id))


@router.get("/standings")
async def standings(user: CurrentUser, s: Session, season: int | None = None) -> SeasonStandings:
    """Season totals across published races. Not live: it moves only when a race is published."""
    if season is None:
        season = await s.scalar(select(func.max(Race.season)).where(Race.status != "draft")) or datetime.now().year
    return SeasonStandings(season=season, rows=await season_standings(s, season))
