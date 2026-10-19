"""compute_scores() is pure: these run without a database."""

import pytest

from app.services.questions import Invalid, validate_question, validate_value
from app.services.scoring import QuestionRule, compute_scores, rank_results, ScoreResult, score_answer

WIN = QuestionRule(1, "single", 10)
PODIUM = QuestionRule(2, "ranked", 15, {"pick": 3})
TOP10 = QuestionRule(3, "multi", 9, {"pick": 3})
SC = QuestionRule(4, "yes_no", 5)
PITS = QuestionRule(5, "number", 6, {"tolerance": 1})
ALL = [WIN, PODIUM, TOP10, SC, PITS]
KEY = {1: "VER", 2: ["VER", "NOR", "LEC"], 3: ["VER", "NOR", "PIA"], 4: True, 5: 4}


def test_single_and_yes_no_are_exact():
    assert score_answer(WIN, "VER", "VER") == 10
    assert score_answer(WIN, "NOR", "VER") == 0
    assert score_answer(SC, True, True) == 5
    assert score_answer(SC, False, True) == 0


def test_number_tolerance():
    assert [score_answer(PITS, g, 4) for g in (2, 3, 4, 5, 6)] == [0, 6, 6, 6, 0]
    assert score_answer(QuestionRule(9, "number", 6), 5, 4) == 0  # default tolerance 0


def test_ranked_scores_each_right_slot():
    assert score_answer(PODIUM, ["VER", "NOR", "LEC"], KEY[2]) == 15
    assert score_answer(PODIUM, ["VER", "LEC", "NOR"], KEY[2]) == 5  # only P1 right
    assert score_answer(PODIUM, ["NOR", "VER", "LEC"], KEY[2]) == 5  # only P3 right
    assert score_answer(PODIUM, ["HAM", "PIA", "ALO"], KEY[2]) == 0
    assert score_answer(PODIUM, ["VER"], KEY[2]) == 5  # partial answer still counts
    strict = QuestionRule(2, "ranked", 15, {"pick": 3, "scoring": "all"})
    assert score_answer(strict, ["VER", "NOR", "HAM"], KEY[2]) == 0
    assert score_answer(strict, ["VER", "NOR", "LEC"], KEY[2]) == 15


def test_multi_scores_each_hit_order_free():
    assert score_answer(TOP10, ["PIA", "NOR", "VER"], KEY[3]) == 9
    assert score_answer(TOP10, ["VER", "HAM", "ALO"], KEY[3]) == 3
    assert score_answer(TOP10, ["VER", "NOR", "ALO"], KEY[3]) == 6
    # "Pick 3 drivers in the top 10": the result has 10 names, all 3 picks inside it is full marks.
    big_key = ["VER", "NOR", "LEC", "HAM", "PIA", "ALO", "RUS", "SAI", "GAS", "OCO"]
    assert score_answer(TOP10, ["VER", "HAM", "OCO"], big_key) == 9
    assert score_answer(TOP10, ["VER", "HAM", "BOT"], big_key) == 6
    strict = QuestionRule(3, "multi", 9, {"pick": 3, "scoring": "all"})
    assert score_answer(strict, ["VER", "HAM", "OCO"], big_key) == 9
    assert score_answer(strict, ["VER", "HAM", "BOT"], big_key) == 0
    pick_all = QuestionRule(3, "multi", 10, {"pick": 10})
    assert score_answer(pick_all, big_key, big_key) == 10
    assert score_answer(pick_all, big_key[:7], big_key) == 7


def test_unanswered_scores_zero():
    assert score_answer(WIN, None, "VER") == 0


def test_compute_scores_weights_and_ranks():
    entries = {
        11: {1: "VER", 2: ["VER", "NOR", "LEC"], 3: ["VER", "NOR", "PIA"], 4: True, 5: 4},  # perfect 45
        12: {1: "VER", 2: ["VER", "LEC", "NOR"], 4: True},  # 10 + 5 + 5 = 20
        13: {1: "NOR", 3: ["VER", "NOR", "ALO"], 4: True, 5: 5},  # 6 + 5 + 6 = 17
        14: {},  # joined, answered nothing
    }
    res = {r.user_id: r for r in compute_scores(ALL, KEY, entries)}
    assert res[11].points == 45 and res[11].correct_count == 5 and res[11].rank == 1
    assert res[12].points == 20 and res[12].correct_count == 2 and res[12].rank == 2
    assert res[13].points == 17 and res[13].correct_count == 2 and res[13].rank == 3
    assert res[14].points == 0 and res[14].rank == 4
    assert res[12].per_question == {1: 10, 2: 5, 3: 0, 4: 5, 5: 0}


def test_ties_share_rank():
    out = rank_results([ScoreResult(1, 30, 0), ScoreResult(2, 40, 0), ScoreResult(3, 30, 0), ScoreResult(4, 10, 0)])
    assert [(r.user_id, r.rank) for r in out] == [(2, 1), (1, 2), (3, 2), (4, 4)]


def test_weights_change_outcome():
    a = {1: "VER"}           # right on the 10-pointer
    b = {4: True, 5: 4}      # right on 5 + 6 = 11
    res = {r.user_id: r for r in compute_scores(ALL, KEY, {1: a, 2: b})}
    assert res[2].rank == 1 and res[1].rank == 2
    heavier = [QuestionRule(1, "single", 25), SC, PITS]
    res = {r.user_id: r for r in compute_scores(heavier, KEY, {1: a, 2: b})}
    assert res[1].rank == 1


# ---------- question & answer shapes ----------

@pytest.mark.parametrize("type_,options,config", [
    ("single", ["A"], {}),                      # needs 2+ options
    ("single", ["A", "A"], {}),                 # duplicates
    ("multi", ["A", "B"], {}),                  # missing pick
    ("ranked", ["A", "B"], {"pick": 3}),        # pick > options
    ("number", ["A", "B"], {}),                 # numbers take no options
    ("number", [], {"min": 5, "max": 1}),
    ("yes_no", ["A", "B"], {}),                 # yes/no takes no options
    ("bogus", [], {}),
])
def test_bad_questions_rejected(type_, options, config):
    with pytest.raises(Invalid):
        validate_question(type_, options, config)


def test_answer_shapes():
    opts, cfg = ["A", "B", "C", "D"], {"pick": 2}
    assert validate_value("multi", opts, cfg, ["A"]) == ["A"]  # partial pick while autosaving
    for bad in (["A", "B", "C"], ["A", "A"], ["Z"], [], "A"):
        with pytest.raises(Invalid):
            validate_value("multi", opts, cfg, bad)
    # The result for "pick 2 in the top 10" may list more names than players pick.
    assert validate_value("multi", opts, cfg, ["A", "B", "C"], is_key=True)
    with pytest.raises(Invalid):
        validate_value("ranked", opts, cfg, ["A"], is_key=True)  # result must be complete
    for bad in (1.5, True, "3"):
        with pytest.raises(Invalid):
            validate_value("number", [], {}, bad)
    with pytest.raises(Invalid):
        validate_value("number", [], {"min": 0, "max": 20}, 21)
    with pytest.raises(Invalid):
        validate_value("yes_no", [], {}, "yes")
