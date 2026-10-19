from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.deps import AdminUser, Session, admin_user
from app.models import Question, Race
from app.schemas import (
    AdminQuestionOut,
    AdminRace,
    AdminRaceDetail,
    AnswerKeyIn,
    CopyQuestionsIn,
    RaceIn,
    RescoreIn,
    ScoreSummary,
)
from app.services import races as svc
from app.services.results import answer_key, answer_key_sources, entry_count, publish_results, save_answer_key, score_race

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_user)])


@router.get("/races")
async def all_races(s: Session) -> list[AdminRace]:
    races = (await s.scalars(select(Race).order_by(Race.season.desc(), Race.round.desc()))).all()
    return [AdminRace.model_validate(r) for r in races]


@router.post("/races", status_code=status.HTTP_201_CREATED)
async def create_race(body: RaceIn, s: Session) -> AdminRaceDetail:
    race = Race(**body.model_dump(exclude={"questions"}))
    s.add(race)
    for i, q in enumerate(body.questions, start=1):
        race.questions.append(Question(**q.model_dump(exclude={"sequence"}), sequence=q.sequence or i))
    try:
        await s.commit()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Round {body.round} of {body.season} already exists, or two questions share a number.")
    return await race_admin_detail(race.id, s)


@router.get("/races/{race_id}")
async def race_admin_detail(race_id: int, s: Session) -> AdminRaceDetail:
    race = await s.get(Race, race_id)
    if race is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Race not found.")
    questions = await svc.questions_by_id(s, race_id)
    return AdminRaceDetail(
        **AdminRace.model_validate(race).model_dump(),
        entries=await entry_count(s, race_id),
        questions=[AdminQuestionOut.model_validate(q) for q in questions.values()],
        answer_key=await answer_key(s, race_id),
        answer_key_sources=await answer_key_sources(s, race_id),
    )


@router.post("/races/{race_id}/copy-questions")
async def copy_questions(race_id: int, body: CopyQuestionsIn, s: Session) -> dict:
    return {"copied": await svc.copy_questions(s, race_id, body.from_race_id)}


@router.post("/races/{race_id}/open")
async def open_quiz(race_id: int, s: Session) -> AdminRace:
    return AdminRace.model_validate(await svc.open_quiz(s, race_id))


@router.post("/races/{race_id}/close")
async def close_quiz(race_id: int, s: Session) -> AdminRace:
    return AdminRace.model_validate(await svc.close_quiz(s, race_id))


@router.put("/races/{race_id}/answer-key")
async def put_answer_key(race_id: int, body: AnswerKeyIn, admin: AdminUser, s: Session) -> dict:
    """Save results (any subset). With score=true, also scores the race: the 'Save & Score' button."""
    key = await save_answer_key(s, race_id, admin.id, body.answers) if body.answers else await answer_key(s, race_id)
    summary = await score_race(s, race_id, admin.id) if body.score else None
    return {"answer_key": key, "scored": summary}


@router.post("/races/{race_id}/score")
async def score(race_id: int, admin: AdminUser, s: Session) -> ScoreSummary:
    return await score_race(s, race_id, admin.id)


@router.post("/races/{race_id}/rescore")
async def rescore(race_id: int, body: RescoreIn, admin: AdminUser, s: Session) -> ScoreSummary:
    """After a post-race penalty: change any results and recompute everything in one go."""
    return await score_race(s, race_id, admin.id, body.answers, rescore=True)


@router.post("/races/{race_id}/publish")
async def publish(race_id: int, s: Session) -> AdminRace:
    return AdminRace.model_validate(await publish_results(s, race_id))
