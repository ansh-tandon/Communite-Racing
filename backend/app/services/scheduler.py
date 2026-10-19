"""In-process timer: marks quizzes closed once their deadline passes.

Correctness doesn't depend on it. Answers are refused after quiz_closes_at by the save
itself, so a late or missed sweep can't let anyone answer after the deadline.
"""

import asyncio
import logging

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.services.races import close_due_races

log = logging.getLogger(__name__)


async def run_scheduler() -> None:
    interval = get_settings().scheduler_interval_seconds
    while True:
        try:
            async with SessionLocal() as s:
                closed = await close_due_races(s)
            if closed:
                log.info("Closed quizzes at deadline: races %s", closed)
        except Exception:
            log.exception("Scheduler sweep failed; retrying next tick")
        await asyncio.sleep(interval)
