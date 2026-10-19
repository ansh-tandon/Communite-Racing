"""Race lifecycle and players' answers.

draft  -> admin is writing questions; players can't see it
open   -> visible; answers accepted from quiz_opens_at until quiz_closes_at (server clock)
closed -> deadline passed (scheduler) or admin closed it early; answers locked
scoring/scored -> see services/results.py
"""

from typing import Any

from sqlalchemy import delete, exists, func, select, tuple_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Answer, Question, Race, Submission
from app.services.questions import Invalid, validate_value


class ActionError(Exception):
    def __init__(self, message: str, status: int = 409, errors: dict | None = None):
        super().__init__(message)
        self.status = status
        self.errors = errors


async def _race_for_update(s: AsyncSession, race_id: int) -> Race:
    race = await s.get(Race, race_id, with_for_update=True)
    if race is None:
        raise ActionError("Race not found.", 404)
    return race


async def question_count(s: AsyncSession, race_id: int) -> int:
    return await s.scalar(select(func.count()).where(Question.race_id == race_id))


async def open_quiz(s: AsyncSession, race_id: int) -> Race:
    race = await _race_for_update(s, race_id)
    if race.status != "draft":
        raise ActionError(f"This quiz is already {race.status}.")
    if not await question_count(s, race_id):
        raise ActionError("Add at least one question before opening the quiz.")
    race.status = "open"
    await s.commit()
    return race


async def close_quiz(s: AsyncSession, race_id: int) -> Race:
    race = await _race_for_update(s, race_id)
    if race.status != "open":
        raise ActionError(f"Only an open quiz can be closed. This one is {race.status}.")
    race.status = "closed"
    await s.commit()
    return race


async def close_due_races(s: AsyncSession) -> list[int]:
    """Scheduler sweep. Answers are already refused after the deadline; this just records it."""
    ids = (
        await s.scalars(
            update(Race)
            .where(Race.status == "open", Race.quiz_closes_at <= func.now())
            .values(status="closed")
            .returning(Race.id)
        )
    ).all()
    await s.commit()
    return list(ids)


async def copy_questions(s: AsyncSession, target_id: int, source_id: int | None = None) -> int:
    """Copy every question from source (default: the latest earlier race that has questions)."""
    target = await _race_for_update(s, target_id)
    if target.status != "draft":
        raise ActionError("Questions can only be copied into a draft race.")
    if await question_count(s, target_id):
        raise ActionError("This race already has questions. Delete them first to copy again.")
    if source_id is None:
        source_id = await s.scalar(
            select(Race.id)
            .where(
                tuple_(Race.season, Race.round) < tuple_(target.season, target.round),
                exists().where(Question.race_id == Race.id),
            )
            .order_by(Race.season.desc(), Race.round.desc())
            .limit(1)
        )
        if source_id is None:
            raise ActionError("No earlier race with questions to copy from.", 404)

    source = (await s.scalars(select(Question).where(Question.race_id == source_id).order_by(Question.sequence))).all()
    if not source:
        raise ActionError("That race has no questions.", 404)
    for q in source:
        s.add(Question(race_id=target_id, sequence=q.sequence, prompt=q.prompt, type=q.type,
                       weight=q.weight, options=list(q.options), config=dict(q.config)))
    await s.commit()
    return len(source)


async def questions_by_id(s: AsyncSession, race_id: int) -> dict[int, Question]:
    qs = (await s.scalars(select(Question).where(Question.race_id == race_id).order_by(Question.sequence))).all()
    return {q.id: q for q in qs}


def check_values(questions: dict[int, Question], values: dict[int, Any], *, is_key: bool) -> dict[int, Any]:
    """Validate {question_id: value}; None means 'clear'. Raises one 422 listing every problem."""
    cleaned, errors = {}, {}
    for qid, v in values.items():
        q = questions.get(qid)
        if q is None:
            errors[qid] = "Not a question in this race."
        elif v is None:
            cleaned[qid] = None
        else:
            try:
                cleaned[qid] = validate_value(q.type, q.options, q.config, v, is_key=is_key)
            except Invalid as e:
                errors[qid] = str(e)
    if errors:
        raise ActionError("Some answers aren't valid.", 422, errors)
    return cleaned


async def my_answers(s: AsyncSession, race_id: int, user_id: int) -> dict[int, Any]:
    rows = await s.execute(
        select(Answer.question_id, Answer.value)
        .join(Submission, Submission.id == Answer.submission_id)
        .where(Submission.race_id == race_id, Submission.user_id == user_id)
    )
    return {qid: v for qid, v in rows}


async def save_answers(s: AsyncSession, race_id: int, user_id: int, values: dict[int, Any]) -> dict[int, Any]:
    """Autosave one or more answers, all-or-nothing.

    FOR SHARE on the race row: many players can save at once, but closing or scoring the
    race waits for in-flight saves to finish, and saves after that see the new status.
    """
    row = (
        await s.execute(
            select(Race.status, Race.quiz_opens_at, Race.quiz_closes_at, func.now())
            .where(Race.id == race_id)
            .with_for_update(read=True)
        )
    ).one_or_none()
    if row is None or row.status == "draft":
        raise ActionError("Race not found.", 404)
    status, opens, closes, now = row
    if status != "open" or now >= closes:
        raise ActionError("The quiz is closed. Answers are locked.")
    if now < opens:
        raise ActionError("The quiz isn't open yet.")

    cleaned = check_values(await questions_by_id(s, race_id), values, is_key=False)

    sub_id = await s.scalar(
        insert(Submission)
        .values(user_id=user_id, race_id=race_id)
        .on_conflict_do_update(index_elements=["user_id", "race_id"], set_={"updated_at": func.now()})
        .returning(Submission.id)
    )
    to_clear = [qid for qid, v in cleaned.items() if v is None]
    to_save = [{"submission_id": sub_id, "question_id": qid, "value": v} for qid, v in cleaned.items() if v is not None]
    if to_clear:
        await s.execute(delete(Answer).where(Answer.submission_id == sub_id, Answer.question_id.in_(to_clear)))
    if to_save:
        stmt = insert(Answer).values(to_save)
        await s.execute(
            stmt.on_conflict_do_update(
                index_elements=["submission_id", "question_id"],
                set_={"value": stmt.excluded.value, "updated_at": func.now()},
            )
        )
    await s.commit()
    return await my_answers(s, race_id, user_id)
