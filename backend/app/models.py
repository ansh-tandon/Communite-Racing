"""Database schema. Integrity rules live here as constraints, not in application code."""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

RACE_STATUSES = ("draft", "open", "closed", "scoring", "scored")
QUESTION_TYPES = ("single", "multi", "number", "yes_no", "ranked")


def created_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(40))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = created_at()

    def __str__(self) -> str:
        return self.display_name or self.email


class OtpCode(Base):
    __tablename__ = "otp_codes"
    __table_args__ = (Index("ix_otp_codes_email_created", "email", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254))
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()


class Race(Base):
    __tablename__ = "races"
    __table_args__ = (
        UniqueConstraint("season", "round"),
        CheckConstraint(f"status IN {RACE_STATUSES}", name="race_status_valid"),
        CheckConstraint("quiz_closes_at > quiz_opens_at", name="race_window_valid"),
        Index("ix_races_quiz_closes_at", "quiz_closes_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    season: Mapped[int] = mapped_column(Integer)
    round: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(80))  # "Singapore Grand Prix"
    circuit: Mapped[str] = mapped_column(String(80))  # "Marina Bay Street Circuit"
    country: Mapped[str] = mapped_column(String(60), default="", server_default="")
    quiz_opens_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    quiz_closes_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), default="draft", server_default="draft")
    # True: results visible the moment scoring finishes. False: admin reviews, then publishes.
    reveal_immediately: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at()

    questions: Mapped[list["Question"]] = relationship(
        back_populates="race", order_by="Question.sequence", cascade="all, delete-orphan"
    )

    def __str__(self) -> str:
        return f"R{self.round} {self.name} {self.season}"


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        UniqueConstraint("race_id", "sequence"),
        CheckConstraint(f"type IN {QUESTION_TYPES}", name="question_type_valid"),
        CheckConstraint("weight > 0", name="question_weight_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(ForeignKey("races.id", ondelete="CASCADE"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    prompt: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(16))
    weight: Mapped[int] = mapped_column(Integer, default=10, server_default="10")
    # Choices for single/multi/ranked, e.g. ["VER", "NOR", ...]. Empty for number/yes_no.
    options: Mapped[list[Any]] = mapped_column(JSONB, default=list, server_default="[]")
    # Per-type rules, e.g. {"pick": 3} for multi, {"tolerance": 1} for number. Scoring reads this.
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")

    race: Mapped[Race] = relationship(back_populates="questions")

    def __str__(self) -> str:
        return f"Q{self.sequence}: {self.prompt[:50]}"


class Submission(Base):
    """One per user per race. Answers are saved into it as the user goes (autosave)."""

    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("user_id", "race_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    race_id: Mapped[int] = mapped_column(ForeignKey("races.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (UniqueConstraint("submission_id", "question_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    value: Mapped[Any] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AnswerKey(Base):
    """The real result per question. Kept apart from questions so re-scoring and
    automated ingestion (source='openf1') never touch the quiz itself."""

    __tablename__ = "answer_keys"
    __table_args__ = (UniqueConstraint("race_id", "question_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(ForeignKey("races.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    correct_value: Mapped[Any] = mapped_column(JSONB)
    source: Mapped[str] = mapped_column(String(16), default="manual", server_default="manual")
    entered_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Score(Base):
    __tablename__ = "scores"
    __table_args__ = (
        UniqueConstraint("race_id", "user_id"),
        Index("ix_scores_race_points", "race_id", "points"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(ForeignKey("races.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    points: Mapped[int] = mapped_column(Integer)
    correct_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    rank: Mapped[int] = mapped_column(Integer)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)  # "perfect_predictor"
    name: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(String(200))
    icon: Mapped[str] = mapped_column(String(60))  # static frontend asset name

    def __str__(self) -> str:
        return self.name


class UserBadge(Base):
    __tablename__ = "user_badges"
    # Re-scoring can't award the same badge twice for the same race.
    __table_args__ = (UniqueConstraint("user_id", "badge_id", "race_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"))
    race_id: Mapped[int] = mapped_column(ForeignKey("races.id", ondelete="CASCADE"))
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
