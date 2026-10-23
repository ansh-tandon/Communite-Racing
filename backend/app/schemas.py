from datetime import datetime
from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.services.openf1.rules import validate_auto
from app.services.questions import Invalid, validate_question

# ---------- auth ----------


class OtpRequest(BaseModel):
    email: EmailStr


class OtpVerify(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class GoogleSignIn(BaseModel):
    credential: str = Field(min_length=1, max_length=4096)  # the ID token from Google's button


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str | None
    is_admin: bool


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=2, max_length=24)

    @field_validator("display_name")
    @classmethod
    def tidy(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters.")
        return v


# ---------- races & answers ----------

QuestionType = Literal["single", "multi", "ranked", "number", "yes_no"]
Phase = Literal["upcoming", "open", "closed", "results"]


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sequence: int
    prompt: str
    type: QuestionType
    weight: int
    options: list[Any]
    config: dict[str, Any]


class RaceSummary(BaseModel):
    id: int
    season: int
    round: int
    name: str
    circuit: str
    country: str
    quiz_opens_at: datetime
    quiz_closes_at: datetime
    phase: Phase
    question_count: int
    answered_count: int
    my_points: int | None = None
    my_rank: int | None = None


class MyResults(BaseModel):
    answer_key: dict[int, Any]
    points_by_question: dict[int, int]
    points: int | None
    rank: int | None
    max_points: int


class RaceDetail(RaceSummary):
    server_time: datetime
    entries: int
    questions: list[QuestionOut]
    my_answers: dict[int, Any]
    results: MyResults | None = None


class AnswersIn(BaseModel):
    """{question_id: value}. A null value clears that answer."""

    answers: dict[int, Any] = Field(min_length=1, max_length=60)


class AnswersOut(BaseModel):
    answers: dict[int, Any]


class LeaderRow(BaseModel):
    rank: int
    user_id: int
    name: str
    points: int
    correct_count: int


class RaceLeaderboard(BaseModel):
    race_id: int
    published: bool
    rows: list[LeaderRow]


class LiveSeasonRow(BaseModel):
    rank: int
    user_id: int
    name: str
    points: int  # published season total + this quiz's provisional points
    race_points: int | None  # this quiz, provisional; None = didn't enter
    prev_rank: int | None  # place in the published standings; None = not in them yet


class LiveLeaderboard(BaseModel):
    race_id: int
    season: int
    questions: int
    results_in: int  # questions with a result so far
    live_results: int  # of those, provisional OpenF1 values that can still change
    updated_at: datetime | None
    rows: list[LeaderRow]
    season_rows: list[LiveSeasonRow]


class SeasonRow(BaseModel):
    rank: int
    user_id: int
    name: str
    points: int
    races: int
    wins: int
    podiums: int


class SeasonStandings(BaseModel):
    season: int
    rows: list[SeasonRow]


# ---------- admin ----------


class QuestionIn(BaseModel):
    prompt: str = Field(min_length=3, max_length=300)
    type: QuestionType
    weight: int = Field(default=10, ge=1, le=100)
    options: list[str] = []
    config: dict[str, Any] = {}
    sequence: int | None = Field(default=None, ge=1)
    # OpenF1 auto-answer, e.g. {"rule": "winner"}. See GET /admin/openf1/rules. None = entered by hand.
    auto: dict[str, Any] | None = None

    @model_validator(mode="after")
    def check_shape(self):
        try:
            validate_question(self.type, self.options, self.config)
            self.auto = validate_auto(self.type, self.auto)
        except Invalid as e:
            raise ValueError(str(e))
        return self


class RaceIn(BaseModel):
    season: int = Field(ge=2020, le=2100)
    round: int = Field(ge=1, le=40)
    name: str = Field(min_length=3, max_length=80)
    circuit: str = Field(min_length=3, max_length=80)
    country: str = Field(default="", max_length=60)
    quiz_opens_at: AwareDatetime
    quiz_closes_at: AwareDatetime
    reveal_immediately: bool = True
    questions: list[QuestionIn] = Field(default=[], max_length=60)

    @model_validator(mode="after")
    def check_window(self):
        if self.quiz_closes_at <= self.quiz_opens_at:
            raise ValueError("quiz_closes_at must be after quiz_opens_at.")
        return self


class AdminRace(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    season: int
    round: int
    name: str
    circuit: str
    country: str
    quiz_opens_at: datetime
    quiz_closes_at: datetime
    status: str
    reveal_immediately: bool
    published_at: datetime | None
    openf1_session_key: int | None = None


class AdminQuestionOut(QuestionOut):
    auto: dict[str, Any] | None = None


class AdminRaceDetail(AdminRace):
    entries: int
    questions: list[AdminQuestionOut]
    answer_key: dict[int, Any]
    # Where each result came from: manual | openf1 | openf1_live (provisional)
    answer_key_sources: dict[int, str] = {}


class CopyQuestionsIn(BaseModel):
    from_race_id: int | None = None


class AnswerKeyIn(BaseModel):
    """{question_id: correct value}. score=true saves and scores in one go (Save & Score)."""

    answers: dict[int, Any] = {}
    score: bool = False


class RescoreIn(BaseModel):
    answers: dict[int, Any] = {}


class ScoreSummary(BaseModel):
    race_id: int
    entries: int
    max_points: int
    published: bool
    rescored: bool
