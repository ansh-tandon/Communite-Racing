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

# R18, Circuit of the Americas, 25 Oct 2026. Austin's own angles: the uphill run to the Turn 1 hairpin,
# Cadillac's first home race, the Texas heat, and a lap long enough that strategy decides things.
US_GP_2026: list[dict] = [
    {"prompt": "Who wins the United States Grand Prix?", "type": "single", "weight": 10, "options": FRONT,
     "auto": {"rule": "winner"}},
    {"prompt": "Predict the podium in Austin", "type": "ranked", "weight": 15, "options": FRONT, "config": {"pick": 3},
     "auto": {"rule": "top", "n": 3}},
    {"prompt": "It's uphill all the way into the Turn 1 hairpin. Who leads after lap 1?", "type": "single", "weight": 8,
     "options": FRONT, "auto": {"rule": "leader_after_lap", "lap": 1}},
    {"prompt": "Does the pole sitter win the race?", "type": "yes_no", "weight": 5,
     "auto": {"rule": "pole_converts"}},
    {"prompt": "Cadillac's first home race: does Sergio Pérez finish in the points?", "type": "yes_no", "weight": 6,
     "auto": {"rule": "driver_in_top", "driver": "PER", "n": 10}},
    {"prompt": "Who gains the most places from the grid to the flag?", "type": "single", "weight": 6, "options": GRID,
     "auto": {"rule": "most_places_gained"}},
    {"prompt": "How many pit stops in the race, all cars together?", "type": "number", "weight": 6,
     "config": {"min": 0, "max": 80, "tolerance": 3}, "auto": {"rule": "pit_stops"}},
    {"prompt": "How many times does the Safety Car or Virtual Safety Car come out?", "type": "number", "weight": 5,
     "config": {"min": 0, "max": 8, "tolerance": 0}, "auto": {"rule": "neutralisations"}},
    {"prompt": "Texas heat: what's the hottest the track gets during the race (°C)?", "type": "number", "weight": 4,
     "config": {"min": 15, "max": 65, "tolerance": 2}, "auto": {"rule": "max_track_temp"}},
]
