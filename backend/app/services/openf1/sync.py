"""Fills the answer key from OpenF1: live during the race, then final from the official classification.

Timeline for one race (times from OpenF1's session schedule):
  before lights out        nothing (pole-based questions fill in once the race starts)
  during the race          with a paid account: every OPENF1_LIVE_INTERVAL_SECONDS, saved as
                           'openf1_live' (provisional; the race can't be scored from these)
  after the flag           every OPENF1_FINAL_INTERVAL_SECONDS until the classification is out,
                           saved as 'openf1'; then re-checked every 10 minutes for
                           OPENF1_FOLLOWUP_HOURS to pick up post-race penalties
Without an account, OpenF1 refuses requests during the session, so filling starts after the flag.

The admin still presses Score. Results typed in by hand are never overwritten.
"""

import asyncio
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import utcnow
from app.models import Question, Race
from app.services.openf1 import get_client
from app.services.openf1.client import OpenF1Client, OpenF1Error, OpenF1Unavailable
from app.services.openf1.rules import NoValue, RaceData, resolve
from app.services.races import ActionError
from app.services.results import LIVE_SOURCE, check_auto_allowed, save_auto_key

log = logging.getLogger(__name__)

FINAL_SOURCE = "openf1"


@dataclass
class QuestionReport:
    question_id: int
    sequence: int
    rule: str
    value: Any = None
    status: str = ""  # saved | unchanged | kept manual | not saved: ... | no value
    note: str = ""


@dataclass
class SyncReport:
    race_id: int
    session_key: int | None
    session_name: str = ""
    phase: str = "waiting"  # live | final | waiting
    saved: bool = False
    checked_at: datetime = field(default_factory=utcnow)
    questions: list[QuestionReport] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


def _t(s: str) -> datetime:
    return datetime.fromisoformat(s)


async def find_session(client: OpenF1Client, race: Race) -> dict | None:
    """The OpenF1 race session closest to this quiz's deadline (lights out), within 4 days."""
    sessions = [x for x in await client.sessions(year=race.season, session_name="Race") if not x.get("is_cancelled")]
    if not sessions:
        return None
    best = min(sessions, key=lambda x: abs(_t(x["date_start"]) - race.quiz_closes_at))
    return best if abs(_t(best["date_start"]) - race.quiz_closes_at) <= timedelta(days=4) else None


async def link_session(s: AsyncSession, client: OpenF1Client, race_id: int, session_key: int | None = None) -> dict:
    race = await s.get(Race, race_id)
    if race is None:
        raise ActionError("Race not found.", 404)
    if session_key is None:
        session = await find_session(client, race)
        if session is None:
            raise ActionError(f"OpenF1 has no {race.season} race near this quiz's deadline. "
                              "Set the session key by hand.", 404)
    else:
        found = await client.sessions(session_key=session_key)
        if not found:
            raise ActionError(f"OpenF1 has no session {session_key}.", 404)
        session = found[0]
    race.openf1_session_key = session["session_key"]
    await s.commit()
    return session


async def race_session(s: AsyncSession, client: OpenF1Client, race: Race) -> dict:
    if race.openf1_session_key is None:
        return await link_session(s, client, race.id)
    found = await client.sessions(session_key=race.openf1_session_key)
    if not found:
        raise ActionError(f"OpenF1 has no session {race.openf1_session_key}.", 404)
    return found[0]


async def sync_race(
    s: AsyncSession, client: OpenF1Client, race_id: int, *, save: bool = True, overwrite_manual: bool = False
) -> SyncReport:
    """Read every auto-answered question of one race from OpenF1, and save the values (unless save=False)."""
    race = await s.get(Race, race_id)
    if race is None:
        raise ActionError("Race not found.", 404)
    if save:
        check_auto_allowed(race)
    questions = (await s.scalars(
        select(Question).where(Question.race_id == race_id, Question.auto.is_not(None)).order_by(Question.sequence)
    )).all()
    if not questions:
        raise ActionError("No question in this race has an auto-answer rule.")

    session = await race_session(s, client, race)
    data = RaceData(client, session)
    try:
        await data.prepare()
    except OpenF1Unavailable as e:
        raise ActionError(str(e), 503)

    report = SyncReport(race_id, session["session_key"], f"{session.get('location', '')} {session['session_name']}".strip(),
                        phase="final" if data.final else "live")
    values = {}
    for q in questions:
        item = QuestionReport(q.id, q.sequence, q.auto["rule"])
        try:
            item.value = values[q.id] = await resolve(data, q.type, q.options, q.config, q.auto)
        except NoValue as e:
            item.status, item.note = "no value", str(e)
        except OpenF1Unavailable as e:
            raise ActionError(str(e), 503)
        report.questions.append(item)

    if save and values:
        status = await save_auto_key(s, race_id, values, FINAL_SOURCE if data.final else LIVE_SOURCE,
                                     overwrite_manual=overwrite_manual)
        for item in report.questions:
            item.status = status.get(item.question_id, item.status)
        report.saved = True
    _last_reports[race_id] = report
    return report


# ---------- background loop ----------

_next_check: dict[int, datetime] = {}
_last_reports: dict[int, SyncReport] = {}


def last_report(race_id: int) -> SyncReport | None:
    return _last_reports.get(race_id)


async def due_races(s: AsyncSession, now: datetime) -> list[Race]:
    """Locked, unscored races with auto-answered questions whose deadline is within a few days of now."""
    return list((await s.scalars(
        select(Race).where(
            Race.status.in_(("open", "closed")),
            Race.quiz_closes_at <= now + timedelta(days=1),
            Race.quiz_closes_at >= now - timedelta(days=3),
            exists().where(Question.race_id == Race.id, Question.auto.is_not(None)),
        )
    )).all())


async def sweep(client: OpenF1Client, now: datetime | None = None) -> list[SyncReport]:
    now = now or utcnow()
    cfg = get_settings()
    reports = []
    async with SessionLocal() as s:
        for race in await due_races(s, now):
            if now < _next_check.get(race.id, now):
                continue
            try:
                session = await race_session(s, client, race)
                start, end = _t(session["date_start"]), _t(session["date_end"])
                if now < start or race.quiz_closes_at > now:
                    _next_check[race.id] = max(start, race.quiz_closes_at)
                    continue
                if now < end and not client.authenticated:
                    _next_check[race.id] = end  # free data only after the session
                    continue
                report = await sync_race(s, client, race.id)
                reports.append(report)
                if report.phase == "final":
                    if now > end + timedelta(hours=cfg.openf1_followup_hours):
                        _next_check[race.id] = datetime.max.replace(tzinfo=now.tzinfo)
                    else:
                        _next_check[race.id] = now + timedelta(minutes=10)
                elif client.authenticated and now < end + timedelta(minutes=30):
                    _next_check[race.id] = now + timedelta(seconds=cfg.openf1_live_interval_seconds)
                else:
                    _next_check[race.id] = now + timedelta(seconds=cfg.openf1_final_interval_seconds)
            except (ActionError, OpenF1Error) as e:
                log.warning("OpenF1 sync for race %s: %s", race.id, e)
                await s.rollback()
                _next_check[race.id] = now + timedelta(seconds=cfg.openf1_final_interval_seconds)
    return reports


async def run_openf1_sync() -> None:
    cfg = get_settings()
    client = get_client()
    tick = max(5, min(cfg.openf1_live_interval_seconds, 30))
    while True:
        try:
            for r in await sweep(client):
                saved = sum(1 for q in r.questions if q.status == "saved")
                if saved:
                    log.info("OpenF1 %s results for race %s: %d saved", r.phase, r.race_id, saved)
        except Exception:
            log.exception("OpenF1 sync sweep failed; retrying next tick")
        await asyncio.sleep(tick)
