"""Pure scoring: no database, no HTTP. Takes questions, the answer key and everyone's answers,
returns points and ranks. Final league rules (weights, tiebreaks) slot in here without schema changes.

Rules today:
  single / yes_no   full weight if exactly right
  number            full weight if within config.tolerance (default 0)
  multi             per_item: weight x correct picks / min(pick, size of result); all: full weight or 0
                    ("pick 3 in the top 10": all 3 inside the top 10 is full marks)
  ranked            per_item: weight x (right driver in the right slot / slots); all: full weight or 0
Partial points round down. Equal points share a rank (1, 2, 2, 4).
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class QuestionRule:
    id: int
    type: str
    weight: int
    config: Mapping[str, Any] = field(default_factory=dict)


@dataclass
class ScoreResult:
    user_id: int
    points: int
    correct_count: int  # questions answered for full marks
    rank: int = 0
    per_question: dict[int, int] = field(default_factory=dict)


def score_answer(q: QuestionRule, given: Any, key: Any) -> int:
    if given is None or key is None:
        return 0
    w, cfg = q.weight, q.config

    if q.type in ("single", "yes_no"):
        return w if given == key else 0

    if q.type == "number":
        return w if abs(given - key) <= cfg.get("tolerance", 0) else 0

    all_or_nothing = cfg.get("scoring", "per_item") == "all"

    if q.type == "multi":
        out_of = min(cfg.get("pick", len(key)), len(key))
        hits = min(len(set(given) & set(key)), out_of)
        if all_or_nothing:
            return w if hits == out_of else 0
        return w * hits // out_of

    if q.type == "ranked":
        if all_or_nothing:
            return w if list(given) == list(key) else 0
        exact = sum(1 for g, k in zip(given, key) if g == k)
        return w * exact // len(key)

    raise ValueError(f"no scoring rule for type {q.type!r}")


def rank_results(results: list[ScoreResult]) -> list[ScoreResult]:
    """Sort best first and assign competition ranks: equal points share a place."""
    results.sort(key=lambda r: (-r.points, r.user_id))
    prev_points, prev_rank = None, 0
    for i, r in enumerate(results, start=1):
        r.rank = prev_rank if r.points == prev_points else i
        prev_points, prev_rank = r.points, r.rank
    return results


def compute_scores(
    questions: Iterable[QuestionRule],
    answer_key: Mapping[int, Any],
    entries: Mapping[int, Mapping[int, Any]],
) -> list[ScoreResult]:
    """entries: {user_id: {question_id: value}}. Everyone in entries gets a result, even with 0 points."""
    questions = list(questions)
    results = []
    for user_id, answers in entries.items():
        per_q = {q.id: score_answer(q, answers.get(q.id), answer_key.get(q.id)) for q in questions}
        results.append(
            ScoreResult(
                user_id=user_id,
                points=sum(per_q.values()),
                correct_count=sum(1 for q in questions if per_q[q.id] == q.weight),
                per_question=per_q,
            )
        )
    return rank_results(results)


def max_points(questions: Iterable[QuestionRule]) -> int:
    return sum(q.weight for q in questions)
