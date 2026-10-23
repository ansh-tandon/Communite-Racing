"""Shape rules for questions, players' answers and the answer key. One place, used everywhere.

Question types:
  single   pick one option                     answer "LEC"
  multi    pick up to config.pick options       answer ["LEC", "HAM"]       e.g. "Who's in the top 10 after lap 10?"
  ranked   order up to config.pick options      answer ["VER", "NOR", "LEC"] e.g. "Predict the podium"
  number   a whole number                       answer 3                     e.g. "How many cars pit under the safety car?"
  yes_no   true / false                         answer true                  e.g. "Will both Ferraris finish on the podium?"

config keys: pick (multi, ranked), min / max / tolerance (number), scoring "per_item" | "all" (multi, ranked),
penalty (any type: points taken off for a wrong answer).
"""

from typing import Any

from app.models import QUESTION_TYPES

CHOICE_TYPES = {"single", "multi", "ranked"}
LIST_TYPES = {"multi", "ranked"}

TYPE_LABELS = {
    "single": "Pick one",
    "multi": "Pick several",
    "ranked": "Put in order",
    "number": "Number",
    "yes_no": "Yes / no",
}


class Invalid(ValueError):
    pass


def _is_int(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def validate_question(type_: str, options: Any, config: Any) -> None:
    if type_ not in QUESTION_TYPES:
        raise Invalid(f"Unknown question type '{type_}'.")
    if not isinstance(options, list):
        raise Invalid('Options must be a JSON list, e.g. ["VER", "NOR"].')
    if not isinstance(config, dict):
        raise Invalid('Config must be a JSON object, e.g. {"pick": 3}.')

    if type_ in CHOICE_TYPES:
        if len(options) < 2 or not all(isinstance(o, str) and o.strip() for o in options):
            raise Invalid("This question type needs at least 2 text options.")
        if len(set(options)) != len(options):
            raise Invalid("Options must be unique.")
    elif options:
        raise Invalid(f"'{TYPE_LABELS[type_]}' questions don't take options. Use [].")

    if type_ in LIST_TYPES:
        pick = config.get("pick")
        if not _is_int(pick) or not 1 <= pick <= len(options):
            raise Invalid(f'Config needs "pick": how many to choose, between 1 and {len(options)}.')
        if config.get("scoring", "per_item") not in ("per_item", "all"):
            raise Invalid('Config "scoring" must be "per_item" or "all".')

    if "penalty" in config and (not _is_int(config["penalty"]) or config["penalty"] < 0):
        raise Invalid('Config "penalty" must be a whole number, 0 or more.')

    if type_ == "number":
        for k in ("min", "max", "tolerance"):
            if k in config and not _is_int(config[k]):
                raise Invalid(f'Config "{k}" must be a whole number.')
        if config.get("tolerance", 0) < 0:
            raise Invalid('Config "tolerance" can\'t be negative.')
        if "min" in config and "max" in config and config["min"] > config["max"]:
            raise Invalid('Config "min" is bigger than "max".')


def validate_value(type_: str, options: list, config: dict, value: Any, *, is_key: bool = False) -> Any:
    """Check one answer (or answer-key entry) against its question. Returns the cleaned value."""
    if type_ == "single":
        if value not in options:
            raise Invalid("Pick one of the options.")
        return value

    if type_ == "yes_no":
        if not isinstance(value, bool):
            raise Invalid("Answer yes or no.")
        return value

    if type_ == "number":
        if not _is_int(value):
            raise Invalid("Enter a whole number.")
        if "min" in config and value < config["min"] or "max" in config and value > config["max"]:
            raise Invalid(f"Enter a number from {config.get('min', '…')} to {config.get('max', '…')}.")
        return value

    # multi / ranked
    if not isinstance(value, list) or not value:
        raise Invalid("Pick at least one option.")
    if any(v not in options for v in value):
        raise Invalid("That isn't one of the options.")
    if len(set(value)) != len(value):
        raise Invalid("Each option can only be picked once.")
    pick = config["pick"]
    if type_ == "ranked" and is_key and len(value) != pick:
        raise Invalid(f"The result needs exactly {pick} in order.")
    if len(value) > pick and not (is_key and type_ == "multi"):
        raise Invalid(f"Pick at most {pick}.")
    return value
