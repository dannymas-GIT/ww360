"""Unit tests for grants matcher and catalog loader."""

from __future__ import annotations

from app.services.grants.catalog import catalog_meta, get_program, list_programs, load_catalog
from app.services.grants.matcher import evaluate_program, rank_programs


def test_catalog_loads():
    data = load_catalog()
    assert data.get("programs")
    meta = catalog_meta()
    assert meta["program_count"] >= 1
    assert meta["version"]


def test_list_and_get_program():
    programs = list_programs()
    assert len(programs) >= 1
    pid = programs[0]["id"]
    found = get_program(pid)
    assert found is not None
    assert found["id"] == pid
    assert get_program("does-not-exist") is None


def test_evaluate_program_all_match():
    program = {
        "id": "test-prog",
        "name": "Test",
        "status": "open",
        "deadline": "2026-12-01",
        "eligibility_rules": [
            {"fact": "applicant_nonprofit_or_edu", "op": "eq", "value": True, "weight": 3},
            {"fact": "retirement_share_pct", "op": "gte", "value": 15, "weight": 2},
            {"fact": "vacant_critical_positions", "op": "gte", "value": 1, "weight": 1},
        ],
    }
    facts = {
        "applicant_nonprofit_or_edu": True,
        "retirement_share_pct": 20,
        "vacant_critical_positions": 2,
    }
    result = evaluate_program(program, facts)
    assert result["program_id"] == "test-prog"
    assert result["fit_pct"] == 100
    assert result["fit_score"] == 6
    assert result["max_score"] == 6
    assert len(result["matched"]) == 3
    assert result["failed"] == []
    assert result["missing_facts"] == []


def test_evaluate_program_partial_and_missing():
    program = {
        "id": "partial",
        "name": "Partial",
        "eligibility_rules": [
            {"fact": "dac_status", "op": "eq", "value": True, "weight": 2, "reason": "DAC"},
            {"fact": "mhi_below_state", "op": "eq", "value": True, "weight": 1},
            {"fact": "has_dw_project_need", "op": "eq", "value": True, "weight": 1},
        ],
    }
    facts = {
        "dac_status": False,
        "has_dw_project_need": True,
        # mhi_below_state missing
    }
    result = evaluate_program(program, facts)
    assert result["fit_score"] == 1
    assert result["max_score"] == 4
    assert result["fit_pct"] == 25
    assert "mhi_below_state" in result["missing_facts"]
    assert any(f.get("fact") == "dac_status" for f in result["failed"])
    assert any(f.get("fact") == "has_dw_project_need" for f in result["matched"])


def test_evaluate_program_no_rules():
    result = evaluate_program({"id": "empty", "status": "open"}, {})
    assert result["fit_pct"] == 50
    assert result["fit_score"] == 50


def test_rank_programs_orders_by_fit_then_deadline():
    programs = [
        {
            "id": "low",
            "name": "Low",
            "deadline": "2026-01-01",
            "eligibility_rules": [
                {"fact": "x", "op": "eq", "value": 1, "weight": 1},
                {"fact": "y", "op": "eq", "value": 1, "weight": 1},
            ],
        },
        {
            "id": "high-late",
            "name": "High Late",
            "deadline": "2027-01-01",
            "eligibility_rules": [
                {"fact": "x", "op": "eq", "value": 1, "weight": 1},
            ],
        },
        {
            "id": "high-early",
            "name": "High Early",
            "deadline": "2026-06-01",
            "eligibility_rules": [
                {"fact": "x", "op": "eq", "value": 1, "weight": 1},
            ],
        },
    ]
    # y missing → low is 50%; highs are 100%. Tie-break by earlier deadline.
    facts = {"x": 1}
    ranked = rank_programs(programs, facts)
    assert [r["program_id"] for r in ranked] == ["high-early", "high-late", "low"]
    assert ranked[0]["fit_pct"] == 100
    assert ranked[2]["fit_pct"] == 50
    assert ranked[0]["deadline"] == "2026-06-01"


def test_rank_programs_failed_rule_sorts_lower():
    programs = [
        {
            "id": "good",
            "deadline": "2026-12-01",
            "eligibility_rules": [{"fact": "ok", "op": "eq", "value": True, "weight": 1}],
        },
        {
            "id": "bad",
            "deadline": "2026-01-01",
            "eligibility_rules": [{"fact": "ok", "op": "eq", "value": True, "weight": 1}],
        },
    ]
    facts = {"ok": True}
    # Make bad fail
    programs[1]["eligibility_rules"] = [{"fact": "ok", "op": "eq", "value": False, "weight": 1}]
    ranked = rank_programs(programs, facts)
    assert ranked[0]["program_id"] == "good"
    assert ranked[0]["fit_pct"] == 100
    assert ranked[1]["program_id"] == "bad"
    assert ranked[1]["fit_pct"] == 0
