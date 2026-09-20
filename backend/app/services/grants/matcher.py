"""Grant eligibility matcher — catalog rules vs district/program facts."""

from __future__ import annotations

from typing import Any


OPS = {
    "eq": lambda a, b: a == b,
    "neq": lambda a, b: a != b,
    "gte": lambda a, b: a is not None and b is not None and a >= b,
    "lte": lambda a, b: a is not None and b is not None and a <= b,
    "gt": lambda a, b: a is not None and b is not None and a > b,
    "lt": lambda a, b: a is not None and b is not None and a < b,
}


def _coerce(fact_val: Any, rule_val: Any) -> tuple[Any, Any]:
    if isinstance(rule_val, bool):
        if isinstance(fact_val, bool):
            return fact_val, rule_val
        if fact_val in (1, "1", "true", "True", "yes"):
            return True, rule_val
        if fact_val in (0, "0", "false", "False", "no"):
            return False, rule_val
        return fact_val, rule_val
    if isinstance(rule_val, (int, float)) and fact_val is not None:
        try:
            return type(rule_val)(fact_val), rule_val
        except (TypeError, ValueError):
            return fact_val, rule_val
    return fact_val, rule_val


def evaluate_program(program: dict[str, Any], facts: dict[str, Any]) -> dict[str, Any]:
    rules = program.get("eligibility_rules") or []
    if not rules:
        return {
            "program_id": program.get("id"),
            "fit_score": 50,
            "max_score": 100,
            "fit_pct": 50,
            "matched": [],
            "failed": [],
            "missing_facts": [],
            "status_hint": program.get("status"),
        }

    matched: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    missing: list[str] = []
    earned = 0
    total = 0

    for rule in rules:
        fact_key = rule.get("fact")
        op = rule.get("op", "eq")
        expected = rule.get("value")
        weight = int(rule.get("weight") or 1)
        reason = rule.get("reason") or fact_key
        total += weight

        if fact_key not in facts or facts.get(fact_key) is None:
            missing.append(fact_key)
            failed.append({"fact": fact_key, "reason": reason, "weight": weight, "missing": True})
            continue

        actual, expected_c = _coerce(facts.get(fact_key), expected)
        fn = OPS.get(op)
        ok = bool(fn(actual, expected_c)) if fn else False
        entry = {
            "fact": fact_key,
            "op": op,
            "expected": expected,
            "actual": actual,
            "reason": reason,
            "weight": weight,
        }
        if ok:
            earned += weight
            matched.append(entry)
        else:
            failed.append(entry)

    fit_pct = int(round(100.0 * earned / total)) if total else 0
    return {
        "program_id": program.get("id"),
        "name": program.get("name"),
        "fit_score": earned,
        "max_score": total,
        "fit_pct": fit_pct,
        "matched": matched,
        "failed": failed,
        "missing_facts": missing,
        "status_hint": program.get("status"),
        "deadline": program.get("deadline"),
    }


def rank_programs(programs: list[dict[str, Any]], facts: dict[str, Any]) -> list[dict[str, Any]]:
    ranked = [evaluate_program(p, facts) for p in programs]
    ranked.sort(key=lambda r: (-r["fit_pct"], r.get("deadline") or "9999"))
    return ranked
