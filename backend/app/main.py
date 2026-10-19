import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.admin_panel import mount_admin
from app.api import admin, auth, openf1, races
from app.core.config import get_settings
from app.core.db import engine
from app.services.openf1 import close_client
from app.services.openf1.client import OpenF1Error, OpenF1Unavailable
from app.services.openf1.sync import run_openf1_sync
from app.services.races import ActionError
from app.services.scheduler import run_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    s = get_settings()
    tasks = []
    if s.scheduler_enabled:
        tasks.append(asyncio.create_task(run_scheduler()))
        if s.openf1_enabled:
            tasks.append(asyncio.create_task(run_openf1_sync()))
    yield
    for task in tasks:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
    await close_client()
    await engine.dispose()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Communitie Racing Quiz League", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.frontend_origin_list,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(ActionError)
    async def action_error(_: Request, e: ActionError) -> JSONResponse:
        body = {"detail": str(e)}
        if e.errors:
            body["errors"] = e.errors
        return JSONResponse(body, status_code=e.status)

    @app.exception_handler(OpenF1Error)
    async def openf1_error(_: Request, e: OpenF1Error) -> JSONResponse:
        return JSONResponse({"detail": str(e)}, status_code=503 if isinstance(e, OpenF1Unavailable) else 502)

    app.include_router(auth.router)
    app.include_router(races.router)
    app.include_router(admin.router)
    app.include_router(openf1.router)
    mount_admin(app)

    @app.get("/health", tags=["ops"])
    async def health() -> dict:
        # No DB query: uptime pings shouldn't keep the database busy.
        return {"ok": True}

    return app


app = create_app()
