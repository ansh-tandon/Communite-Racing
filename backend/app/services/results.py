"""Answer key, scoring and leaderboards.

Scoring runs exactly once per trigger: the first request flips the race row to 'scoring'
with a conditional UPDATE (compare-and-swap) and holds that row lock until it commits.
A second, simultaneous request matches zero rows and is refused. Everything happens in
one transaction, so a failure leaves the race exactly as it was.
"""

from typing import Any

from sqlalchemy import and_, case, delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import utcnow
from app.models import Answer, AnswerKey, Question, Race, Score, Submission, User
from app.services.questions import Invalid, validate_value
from app.services.races import ActionError, check_values, questions_by_id
from app.services.scoring import QuestionRule, ScoreResult, compute_scores, max_points

LIVE_SOURCE = "openf1_live"  # provisional, read during the race: never scored

def display_name():
    return func.coalesce(User.display_name, func.concat("Player ", User.id)).label("name")


def rules(questions: dict[int, Question]) -> list[QuestionRule]:
    return [QuestionRule(q.id, q.type, q.weight, q.config) for q in questions.values()]


async def answer_key(s: AsyncSession, race_id: int) -> dict[int, Any]:
    rows = await s.execute(select(AnswerKey.question_id, AnswerKey.correct_value).where(AnswerKey.race_id == race_id))
    return {qid: v for qid, v in rows}


async def answer_key_sources(s: AsyncSession, race_id: int) -> dict[int, str]:
    rows = await s.execute(select(AnswerKey.question_id, AnswerKey.source).where(AnswerKey.race_id == race_id))
    return {qid: src for qid, src in rows}


async def _upsert_key(s: AsyncSession, race_id: int, admin_id: int | None, values: dict[int, Any], source: str) -> None:
    cleaned = check_values(await questions_by_id(s, race_id), values, is_key=True)
    to_clear = [qid for qid, v in cleaned.items() if v is None]
    rows = [
        {"race_id": race_id, "question_id": qid, "correct_value": v, "source": source, "entered_by": admin_id}
        for qid, v in cleaned.items() if v is not None
    ]
    if to_clear:
        await s.execute(delete(AnswerKey).where(AnswerKey.race_id == race_id, AnswerKey.question_id.in_(to_clear)))
    if rows:
        stmt = insert(AnswerKey).values(rows)
        await s.execute(
            stmt.on_conflict_do_update(
                index_elements=["race_id", "question_id"],
                set_={"correct_value": stmt.excluded.correct_value, "source": stmt.excluded.source,
                      "entered_by": stmt.excluded.entered_by, "entered_at": func.now()},
            )
        )


async def save_answer_key(
    s: AsyncSession, race_id: int, admin_id: int | None, values: dict[int, Any], source: str = "manual"
) -> dict[int, Any]:
    """Save some or all results without scoring (e.g. filled in during the race)."""
    race = await s.get(Race, race_id, with_for_update=True)
    if race is None:
        raise ActionError("Race not found.", 404)
    if race.status == "draft":
        raise ActionError("Open the quiz before entering results.")
    if race.status in ("scoring", "scored"):
        raise ActionError("This race is already scored. Use re-score to change results.")
    await _upsert_key(s, race_id, admin_id, values, source)
    await s.commit()
    return await answer_key(s, race_id)


def check_auto_allowed(race: Race | None) -> None:
    """Automatic results are written only after answers lock, and never into a scored race."""
    if race is None:
        raise ActionError("Race not found.", 404)
    if race.status in ("scoring", "scored"):
        raise ActionError("This race is already scored. Use re-score to change results.")
    if race.status == "draft" or (race.status == "open" and race.quiz_closes_at > utcnow()):
        raise ActionError("Answers aren't locked yet. Results are filled in once the quiz closes.")


async def save_auto_key(
    s: AsyncSession, race_id: int, values: dict[int, Any], source: str, *, overwrite_manual: bool = False
) -> dict[int, str]:
    """Save results read from OpenF1. Returns {question_id: what happened}.

    Only after answers lock, and never over a result the admin typed in (unless overwrite_manual):
    a hand-entered correction always wins over the feed.
    """
    check_auto_allowed(await s.get(Race, race_id, with_for_update=True))
    questions = await questions_by_id(s, race_id)
    current = {qid: (v, src) for qid, v, src in await s.execute(
        select(AnswerKey.question_id, AnswerKey.correct_value, AnswerKey.source).where(AnswerKey.race_id == race_id))}
    status, rows = {}, {}
    for qid, value in values.items():
        q = questions.get(qid)
        if q is None:
            continue
        if current.get(qid, (None, None))[1] == "manual" and not overwrite_manual:
            status[qid] = "kept manual"
            continue
        try:
            value = validate_value(q.type, q.options, q.config, value, is_key=True)
        except Invalid as e:
            status[qid] = f"not saved: {e}"
            continue
        if current.get(qid) == (value, source):
            status[qid] = "unchanged"
            continue
        rows[qid] = value
        status[qid] = "saved"
    if rows:
        await _upsert_key(s, race_id, None, rows, source)
    await s.commit()
    return status


async def _why_not(s: AsyncSession, race_id: int, rescore: bool) -> ActionError:
    race = await s.get(Race, race_id)
    if race is None:
        return ActionError("Race not found.", 404)
    if rescore:
        return ActionError("Score the race before re-scoring it.")
    return {
        "draft": ActionError("This quiz was never opened."),
        "open": ActionError("The quiz is still open. Close it or wait for the deadline."),
        "scoring": ActionError("Scoring is already running."),
        "scored": ActionError("This race is already scored. Use re-score to change results."),
    }.get(race.status, ActionError(f"Can't score a race that is {race.status}."))


async def score_race(
    s: AsyncSession,
    race_id: int,
    admin_id: int | None,
    values: dict[int, Any] | None = None,
    *,
    rescore: bool = False,
    source: str = "manual",
) -> dict:
    if rescore:
        claim = Race.status == "scored"
    else:
        claim = or_(Race.status == "closed", and_(Race.status == "open", Race.quiz_closes_at <= func.now()))
    claimed = await s.scalar(update(Race).where(Race.id == race_id, claim).values(status="scoring").returning(Race.id))
    if claimed is None:
        await s.rollback()
        raise await _why_not(s, race_id, rescore)

    try:
        if values:
            await _upsert_key(s, race_id, admin_id, values, source)
        questions = await questions_by_id(s, race_id)
        key = await answer_key(s, race_id)
        missing = [f"Q{q.sequence}" for q in questions.values() if q.id not in key]
        if missing:
            raise ActionError(f"Enter results for every question first. Missing: {', '.join(missing)}.")
        sources = await answer_key_sources(s, race_id)
        live = [f"Q{q.sequence}" for q in questions.values() if sources.get(q.id) == LIVE_SOURCE]
        if live:
            raise ActionError(f"{', '.join(live)} still show live (provisional) OpenF1 results. "
                              "Wait for the official classification or enter them by hand.")

        entries: dict[int, dict[int, Any]] = {
            uid: {} for uid in (await s.scalars(select(Submission.user_id).where(Submission.race_id == race_id))).all()
        }
        rows = await s.execute(
            select(Submission.user_id, Answer.question_id, Answer.value)
            .join(Answer, Answer.submission_id == Submission.id)
            .where(Submission.race_id == race_id)
        )
        for uid, qid, v in rows:
            entries[uid][qid] = v

        qrules = rules(questions)
        results = compute_scores(qrules, key, entries)
        await _store(s, race_id, results)

        race = await s.get(Race, race_id)
        race.status = "scored"
        if race.reveal_immediately and race.published_at is None:
            race.published_at = await s.scalar(select(func.now()))
        await s.commit()
    except BaseException:
        await s.rollback()
        raise

    return {
        "race_id": race_id,
        "entries": len(results),
        "max_points": max_points(qrules),
        "published": race.published_at is not None,
        "rescored": rescore,
    }


async def _store(s: AsyncSession, race_id: int, results: list[ScoreResult]) -> None:
    # Replace, don't merge: a re-score after a penalty can move people up or down.
    await s.execute(delete(Score).where(Score.race_id == race_id))
    if results:
        await s.execute(
            insert(Score),
            [{"race_id": race_id, "user_id": r.user_id, "points": r.points, "correct_count": r.correct_count, "rank": r.rank}
             for r in results],
        )


async def publish_results(s: AsyncSession, race_id: int) -> Race:
    race = await s.get(Race, race_id, with_for_update=True)
    if race is None:
        raise ActionError("Race not found.", 404)
    if race.status != "scored":
        raise ActionError("Score the race before publishing results.")
    if race.published_at is None:
        race.published_at = await s.scalar(select(func.now()))
    await s.commit()
    return race


async def race_leaderboard(s: AsyncSession, race_id: int, limit: int | None = None) -> list[dict]:
    q = (
        select(Score.rank, Score.user_id, display_name(), Score.points, Score.correct_count)
        .join(User, User.id == Score.user_id)
        .where(Score.race_id == race_id)
        .order_by(Score.rank, Score.user_id)
    )
    if limit:
        q = q.limit(limit)
    return [dict(r._mapping) for r in await s.execute(q)]


async def season_standings(s: AsyncSession, season: int) -> list[dict]:
    total = func.sum(Score.points)
    wins = func.sum(case((Score.rank == 1, 1), else_=0))
    q = (
        select(
            func.rank().over(order_by=total.desc()).label("rank"),
            Score.user_id,
            display_name(),
            total.label("points"),
            func.count().label("races"),
            wins.label("wins"),
            func.sum(case((Score.rank <= 3, 1), else_=0)).label("podiums"),
        )
        .join(User, User.id == Score.user_id)
        .join(Race, Race.id == Score.race_id)
        .where(Race.season == season, Race.published_at.is_not(None))
        .group_by(Score.user_id, User.id)
        .order_by(total.desc(), wins.desc(), Score.user_id)
    )
    return [dict(r._mapping) for r in await s.execute(q)]


async def entry_count(s: AsyncSession, race_id: int) -> int:
    return await s.scalar(select(func.count()).where(Submission.race_id == race_id))
