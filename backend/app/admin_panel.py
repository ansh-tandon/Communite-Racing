"""SQLAdmin data editor at /admin: players, races and questions.

Login is the same email + code as the app; only admins get in. Times are typed and shown
in APP_TIMEZONE (IST) and stored as UTC. Status changes go through the action buttons
(Open quiz / Close quiz) so the lifecycle rules always apply.
"""

import html
import re
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from sqladmin import Admin, ModelView, action
from sqladmin.authentication import AuthenticationBackend
from sqladmin.fields import DateTimeField
from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse
from wtforms import SelectField

from app.core.config import get_settings
from app.core.db import SessionLocal, engine
from app.models import Question, Race, Score, User
from app.services import races as svc
from app.services.openf1 import get_client
from app.services.openf1.client import OpenF1Error
from app.services.openf1.rules import validate_auto
from app.services.openf1.sync import sync_race
from app.services.otp import OtpError, verify_code
from app.services.questions import TYPE_LABELS, Invalid, validate_question


def tz() -> ZoneInfo:
    return ZoneInfo(get_settings().app_timezone)


def local(dt) -> str:
    return dt.astimezone(tz()).strftime("%d %b %Y, %H:%M") if dt else ""


class LocalDateTimeField(DateTimeField):
    """Shows stored UTC times in local time, and reads typed times as local time."""

    def process_data(self, value):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(tz()).replace(tzinfo=None)
        super().process_data(value)

    def process_formdata(self, valuelist):
        super().process_formdata(valuelist)
        if self.data is not None and self.data.tzinfo is None:
            self.data = self.data.replace(tzinfo=tz())


class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        email, code = str(form.get("email", "")).strip(), str(form.get("code", "")).strip()
        if not re.fullmatch(r"\d{6}", code) or "@" not in email:
            return False
        async with SessionLocal() as s:
            try:
                user = await verify_code(s, email, code)
            except OtpError:
                return False
        if not user.is_admin:
            return False
        request.session["uid"] = user.id
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        uid = request.session.get("uid")
        if not uid:
            return False
        async with SessionLocal() as s:
            user = await s.get(User, uid)
        return bool(user and user.is_admin)


def _message(text: str, back: str) -> HTMLResponse:
    return HTMLResponse(
        f"<div style='font:16px system-ui;max-width:520px;margin:15vh auto;padding:0 16px'>"
        f"<p>{html.escape(text)}</p><p><a href='{html.escape(back)}'>Back</a></p></div>",
        status_code=409,
    )


class PlayerAdmin(ModelView, model=User):
    name, name_plural, icon = "Player", "Players", "fa-solid fa-user"
    column_list = [User.id, User.display_name, User.email, User.is_admin, User.created_at]
    column_searchable_list = [User.email, User.display_name]
    column_default_sort = [(User.id, True)]
    column_formatters = {User.created_at: lambda m, a: local(m.created_at)}
    column_details_exclude_list = []
    form_columns = [User.display_name, User.is_admin]
    can_create = False


class RaceAdmin(ModelView, model=Race):
    name, name_plural, icon = "Race", "Races", "fa-solid fa-flag-checkered"
    column_list = [Race.id, Race.season, Race.round, Race.name, Race.status, Race.quiz_opens_at, Race.quiz_closes_at, Race.published_at]
    column_labels = {Race.quiz_opens_at: "Quiz opens (IST)", Race.quiz_closes_at: "Quiz closes (IST)", Race.published_at: "Results published"}
    column_default_sort = [(Race.season, True), (Race.round, True)]
    column_formatters = {
        Race.quiz_opens_at: lambda m, a: local(m.quiz_opens_at),
        Race.quiz_closes_at: lambda m, a: local(m.quiz_closes_at),
        Race.published_at: lambda m, a: local(m.published_at),
    }
    column_formatters_detail = column_formatters
    form_columns = [Race.season, Race.round, Race.name, Race.circuit, Race.country,
                    Race.quiz_opens_at, Race.quiz_closes_at, Race.reveal_immediately, Race.openf1_session_key]
    form_overrides = {"quiz_opens_at": LocalDateTimeField, "quiz_closes_at": LocalDateTimeField}
    form_args = {
        "quiz_opens_at": {"label": "Quiz opens (IST)"},
        "quiz_closes_at": {"label": "Quiz closes (IST)", "description": "Answers lock at this exact time."},
        "reveal_immediately": {"label": "Show results as soon as scoring finishes",
                               "description": "Untick to review scores first, then publish."},
        "openf1_session_key": {"label": "OpenF1 session key",
                               "description": "Leave empty: found automatically from the season and quiz deadline."},
    }

    async def on_model_change(self, data, model, is_created, request):
        opens, closes = data.get("quiz_opens_at"), data.get("quiz_closes_at")
        if opens and closes and closes <= opens:
            raise ValueError("The quiz must close after it opens.")

    async def _run(self, request: Request, fn) -> HTMLResponse | RedirectResponse:
        pks = [int(p) for p in request.query_params.get("pks", "").split(",") if p]
        back = request.headers.get("referer") or str(request.url_for("admin:list", identity=self.identity))
        if len(pks) != 1:
            return _message("Select exactly one race.", back)
        async with SessionLocal() as s:
            try:
                await fn(s, pks[0])
            except (svc.ActionError, OpenF1Error) as e:
                return _message(str(e), back)
        return RedirectResponse(back, status_code=303)

    @action(name="copy_questions", label="Copy questions from previous race",
            confirmation_message="Copy every question from the previous race into this one?")
    async def copy_questions(self, request: Request):
        return await self._run(request, svc.copy_questions)

    @action(name="open_quiz", label="Open quiz to players",
            confirmation_message="Players will see this quiz and can answer from the opening time. Continue?")
    async def open_quiz(self, request: Request):
        return await self._run(request, svc.open_quiz)

    @action(name="close_quiz", label="Close quiz now",
            confirmation_message="Lock all answers now, before the deadline?")
    async def close_quiz(self, request: Request):
        return await self._run(request, svc.close_quiz)

    @action(name="openf1_sync", label="Fill results from OpenF1 now",
            confirmation_message="Read results from OpenF1 for every auto-answered question? Results you typed in stay.")
    async def openf1_sync(self, request: Request):
        return await self._run(request, lambda s, race_id: sync_race(s, get_client(), race_id))


class QuestionAdmin(ModelView, model=Question):
    name, name_plural, icon = "Question", "Questions", "fa-solid fa-circle-question"
    column_list = [Question.race, Question.sequence, Question.prompt, Question.type, Question.weight]
    column_labels = {Question.sequence: "No.", Question.weight: "Points"}
    column_default_sort = [(Question.race_id, True), (Question.sequence, False)]
    column_searchable_list = [Question.prompt]
    column_formatters = {Question.type: lambda m, a: TYPE_LABELS.get(m.type, m.type)}
    form_columns = [Question.race, Question.sequence, Question.prompt, Question.type, Question.weight,
                    Question.options, Question.config, Question.auto]
    form_overrides = {"type": SelectField}
    form_args = {
        "type": {"choices": list(TYPE_LABELS.items())},
        "sequence": {"label": "Question number"},
        "weight": {"label": "Points"},
        "options": {"description": 'Choices as a JSON list, e.g. ["VER", "NOR", "LEC"]. Use [] for Number and Yes / no.'},
        "config": {"description": 'Pick several / Put in order: {"pick": 3}. Number: {"min": 0, "max": 20, "tolerance": 1}. '
                                  'All-or-nothing scoring: add "scoring": "all". Negative marking: add "penalty": 5 '
                                  '(points off a wrong answer; blank scores 0), e.g. {"penalty": 3}. Otherwise {}.'},
        "auto": {"label": "Auto-answer from OpenF1",
                 "description": 'Optional. e.g. {"rule": "winner"}, {"rule": "top", "n": 3} (podium), '
                                '{"rule": "top_after_lap", "lap": 10, "n": 10}, {"rule": "safety_car"}, '
                                '{"rule": "pit_stops_under_sc"}. Every rule: GET /admin/openf1/rules. Empty = enter by hand.'},
    }

    async def on_model_change(self, data, model, is_created, request):
        if data.get("options") in (None, {}):
            data["options"] = []
        if data.get("config") is None:
            data["config"] = {}
        if data.get("auto") in ("", {}):
            data["auto"] = None
        try:
            validate_question(data["type"], data["options"], data["config"])
            data["auto"] = validate_auto(data["type"], data.get("auto"))
        except Invalid as e:
            raise ValueError(str(e))
        race_id = data["race"].id if hasattr(data.get("race"), "id") else (int(data["race"]) if data.get("race") else None)
        if is_created:
            await self._require_draft(race_id, "Questions can only be added while the race is a draft.")
        elif any(getattr(model, k) != data[k] for k in ("type", "options", "config")):
            await self._require_draft(model.race_id, "The quiz is open: you can fix wording or points, "
                                                     "but not the type, options or config.")

    async def on_model_delete(self, model, request):
        await self._require_draft(model.race_id, "Questions can only be deleted while the race is a draft.")

    @staticmethod
    async def _require_draft(race_id: int | None, message: str) -> None:
        async with SessionLocal() as s:
            status = await s.scalar(select(Race.status).where(Race.id == race_id))
        if status is not None and status != "draft":
            raise ValueError(message)


class ScoreAdmin(ModelView, model=Score):
    name, name_plural, icon = "Score", "Scores", "fa-solid fa-ranking-star"
    column_list = [Score.race_id, Score.rank, Score.user_id, Score.points, Score.correct_count]
    column_default_sort = [(Score.race_id, True), (Score.rank, False)]
    can_create = can_edit = can_delete = False


def mount_admin(app: FastAPI) -> Admin:
    admin = Admin(
        app,
        engine=engine,
        session_maker=SessionLocal,
        title="Communitie Racing · Admin",
        authentication_backend=AdminAuth(secret_key=get_settings().jwt_secret),
        templates_dir=str(Path(__file__).parent / "templates"),
    )
    for view in (RaceAdmin, QuestionAdmin, PlayerAdmin, ScoreAdmin):
        admin.add_view(view)
    return admin
