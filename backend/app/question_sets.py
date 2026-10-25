"""Race-specific question sets, in the same shape as POST /admin/races takes them. Every question is answered
by OpenF1 (see app/services/openf1/rules.py), so the race can be scored without typing in results.

Use one by pasting it into a new race, or by creating the race with it, before the quiz opens; once players
have answered, change a quiz's questions only if you're happy to void what they picked.
"""

from app.seed import FRONT, GRID

TEAMS = ["McLaren", "Mercedes", "Red Bull", "Ferrari", "Williams", "Racing Bulls", "Aston Martin", "Haas",
         "Audi", "Alpine", "Cadillac"]

# R18 FP1, Austin, Fri 23 Oct 2026, 17:30 UTC (11 pm IST). The quiz locks when the session starts; link it to
# OpenF1 session 11389 by hand (POST /admin/races/{id}/openf1/link), since automatic linking looks for races.
# "Fastest" is P1 of the session classification (best lap). Colton Herta (HER, #25) drives Pérez's Cadillac in this
# session, per OpenF1's entry list on the day, so he replaces PER in the options.
FP1_GRID = ["HER" if c == "PER" else c for c in GRID]
US_GP_2026_FP1: list[dict] = [
    {"prompt": "Who's fastest in FP1 in Austin?", "type": "single", "weight": 10, "options": FRONT,
     "auto": {"rule": "winner"}},
    {"prompt": "Top 3 in FP1, in order", "type": "ranked", "weight": 15, "options": FRONT, "config": {"pick": 3},
     "auto": {"rule": "top", "n": 3}},
    {"prompt": "Which team tops FP1?", "type": "single", "weight": 6, "options": TEAMS,
     "auto": {"rule": "winning_team"}},
    {"prompt": "Who does the most laps in FP1?", "type": "single", "weight": 6, "options": FP1_GRID,
     "auto": {"rule": "most_laps"}},
    {"prompt": "How many laps does the whole field complete in FP1?", "type": "number", "weight": 5,
     "config": {"min": 200, "max": 900, "tolerance": 15}, "auto": {"rule": "total_laps"}},
    {"prompt": "American Colton Herta drives for Cadillac at home in FP1. Does he make the top 10?", "type": "yes_no",
     "weight": 5, "auto": {"rule": "driver_in_top", "driver": "HER", "n": 10}},
    {"prompt": "Will FP1 be red-flagged?", "type": "yes_no", "weight": 5, "auto": {"rule": "red_flag"}},
    {"prompt": "Hottest track temperature in FP1 (°C)?", "type": "number", "weight": 4,
     "config": {"min": 15, "max": 65, "tolerance": 2}, "auto": {"rule": "max_track_temp"}},
]

# R18, Circuit of the Americas, lights out 25 Oct 2026 20:00 UTC (1:30 am IST, 26 Oct). The league's own question
# list and marking: each question's points for a right answer, config.penalty off for a wrong one, 0 if blank.
# Every question is answered by OpenF1; the few cases with no single answer (a tie, nobody retiring, nobody
# climbing into the top 10) come back as "no value" and are entered by hand, using the extra options below.
NO_RETIREMENT, NOBODY = "No retirements", "Nobody"
US_GP_2026: list[dict] = [
    {"prompt": "🏆 Who will win the United States Grand Prix?", "type": "single", "weight": 15, "options": GRID,
     "config": {"penalty": 5}, "auto": {"rule": "winner"}},
    {"prompt": "🏎️ Who will be the first driver to retire?", "type": "single", "weight": 10,
     "options": GRID + [NO_RETIREMENT], "config": {"penalty": 3}, "auto": {"rule": "first_retirement"}},
    {"prompt": "⏱️ Who will set the fastest lap?", "type": "single", "weight": 10, "options": GRID,
     "config": {"penalty": 3}, "auto": {"rule": "fastest_lap"}},
    {"prompt": "🏗️ Which constructor will score the most points?", "type": "single", "weight": 10, "options": TEAMS,
     "config": {"penalty": 3}, "auto": {"rule": "top_scoring_team"}},
    {"prompt": "🚘 How many cars will finish the race?", "type": "number", "weight": 10,
     "config": {"penalty": 5, "min": 0, "max": 22, "tolerance": 0}, "auto": {"rule": "classified_finishers"}},
    {"prompt": "📈 Who will gain the most positions from their starting grid slot?", "type": "single", "weight": 10,
     "options": GRID, "config": {"penalty": 3}, "auto": {"rule": "most_places_gained"}},
    {"prompt": "🚩 Will there be a red flag during the race?", "type": "yes_no", "weight": 5,
     "config": {"penalty": 2}, "auto": {"rule": "red_flag"}},
    {"prompt": "🚨 Will there be a Safety Car deployment during the race? (a Virtual Safety Car doesn't count)",
     "type": "yes_no", "weight": 5, "config": {"penalty": 2}, "auto": {"rule": "safety_car", "include_vsc": False}},
    {"prompt": "🎯 Which driver starting outside the top 10 will finish in the top 10?", "type": "multi", "weight": 10,
     "options": GRID + [NOBODY], "config": {"penalty": 3, "pick": 1}, "auto": {"rule": "climbers_into_top", "n": 10}},
    {"prompt": "🥉 How many podium finishers will start outside the top 3?", "type": "number", "weight": 15,
     "config": {"penalty": 5, "min": 0, "max": 3, "tolerance": 0}, "auto": {"rule": "top_from_outside", "n": 3}},
]
