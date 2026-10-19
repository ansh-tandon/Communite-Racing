"""Admin-only OpenF1 endpoints: every OpenF1 API through one passthrough, the auto-answer rules,
linking a race to its OpenF1 session, and filling results now."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.deps import Session, admin_user
from app.models import Race
from app.services.openf1 import get_client
from app.services.openf1.client import ENDPOINTS, OpenF1Client
from app.services.openf1.rules import catalogue
from app.services.openf1.sync import last_report, link_session, sync_race
from app.services.results import answer_key_sources

router = APIRouter(prefix="/admin", tags=["openf1"], dependencies=[Depends(admin_user)])
OpenF1 = Annotated[OpenF1Client, Depends(get_client)]


class LinkIn(BaseModel):
    session_key: int | None = None  # None = find it from the season and quiz deadline


class SyncIn(BaseModel):
    save: bool = True  # false = preview only
    overwrite_manual: bool = False


@router.get("/openf1")
async def openf1_status(client: OpenF1) -> dict:
    s = get_settings()
    return {
        "enabled": s.openf1_enabled,
        "live": client.authenticated,  # paid account configured: results fill in during the race
        "live_interval_seconds": s.openf1_live_interval_seconds,
        "endpoints": ENDPOINTS,
        "rules": catalogue(),
    }


@router.get("/openf1/rules")
async def openf1_rules() -> list[dict]:
    return catalogue()


@router.get("/openf1/data/{endpoint}")
async def openf1_data(endpoint: str, request: Request, client: OpenF1) -> list[dict]:
    """Any OpenF1 endpoint, filters passed through as-is, e.g.
    /admin/openf1/data/laps?session_key=latest&driver_number=1&lap_number>=50"""
    if endpoint not in ENDPOINTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"OpenF1 has no '{endpoint}' endpoint. Known: {', '.join(ENDPOINTS)}.")
    return await client.get_raw(endpoint, request.url.query)


@router.get("/races/{race_id}/openf1")
async def race_openf1(race_id: int, s: Session) -> dict:
    race = await s.get(Race, race_id)
    if race is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Race not found.")
    report = last_report(race_id)
    return {
        "session_key": race.openf1_session_key,
        "sources": await answer_key_sources(s, race_id),
        "last_check": report.as_dict() if report else None,
    }


@router.post("/races/{race_id}/openf1/link")
async def link_race(race_id: int, body: LinkIn, s: Session, client: OpenF1) -> dict:
    return await link_session(s, client, race_id, body.session_key)


@router.post("/races/{race_id}/openf1/sync")
async def sync_now(race_id: int, body: SyncIn, s: Session, client: OpenF1) -> dict:
    """Read results from OpenF1 now. save=false previews without saving (works on any race)."""
    return (await sync_race(s, client, race_id, save=body.save, overwrite_manual=body.overwrite_manual)).as_dict()
