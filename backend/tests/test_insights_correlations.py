"""Unit tests for Insights correlations (synthetic in-memory rows, no DB)."""

from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.insights import correlations as corr
from app.services.insights.service import (
    CORRELATION_IDS,
    build_insights_overview,
    get_correlation,
    list_personas,
)


def _sdwis(**kwargs):
    defaults = dict(
        county="Albany",
        pws_type="CWS",
        population_served=5000,
        health_flag="N",
        snc="N",
        qtrs_with_vio=0,
        qtrs_with_snc=0,
        serious_violator="N",
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _npdes(**kwargs):
    defaults = dict(
        county="Albany",
        facility_type_code="POTW",
        major_minor="MAJOR",
        snc="N",
        qtrs_with_nc=0,
        plant_class="3A",
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _emp(**kwargs):
    defaults = dict(
        district_code="D1",
        county_of_employment="Albany",
        is_active=True,
        retirement_eligible_date=date.today() + timedelta(days=180),
        planned_departure_date=None,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _pos(**kwargs):
    defaults = dict(district_code="D1", is_vacant=True, record_status="active")
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _agg(**kwargs):
    defaults = dict(county="Albany", grade_code="A", expiration_month="2026-12", operator_count=10)
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


class _Query:
    """Minimal SQLAlchemy query stub that supports chained filters/limits."""

    def __init__(self, rows):
        self._rows = list(rows)

    def filter(self, *args, **kwargs):
        return self

    def limit(self, n):
        self._rows = self._rows[:n]
        return self

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return list(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None

    def count(self):
        return len(self._rows)


def _model_name(model) -> str:
    return getattr(model, "__name__", "")


def test_correlation_ids_complete():
    assert set(CORRELATION_IDS) == {
        "compliance_vs_coverage",
        "grade_demand_vs_supply",
        "renewal_cliff",
        "retirement_horizon",
        "source_water_complexity",
        "fundable_need_overlay",
    }


def test_list_personas():
    personas = list_personas()
    ids = {p["id"] for p in personas}
    assert ids == {"jenny", "regulator", "utility"}


def test_compliance_vs_coverage_synthetic():
    db = MagicMock()

    def _query_for(*models):
        name = _model_name(models[0]) if models else ""
        if name == "SDWISStateSystem":
            return _Query([_sdwis(snc="Y"), _sdwis(county="Erie")])
        if name == "NpdesStateFacility":
            return _Query([_npdes(snc="Y")])
        return _Query([])

    db.query.side_effect = _query_for
    with patch.object(
        corr,
        "_workforce_by_county",
        return_value={
            "Albany": {
                "county": "Albany",
                "vacant_positions": 2,
                "retirement_eligible": 1,
                "certs_expiring_90d": 1,
                "active_employees": 5,
            }
        },
    ):
        result = corr.compliance_vs_coverage(db, "NY")

    assert result["id"] == "compliance_vs_coverage"
    assert result["data_mode"] in ("live", "mixed")
    assert any(c["county"] == "Albany" and c["sdwis_snc"] >= 1 for c in result["counties"])
    assert any(c["county"] == "Albany" and c["vacant_positions"] == 2 for c in result["counties"])


def test_grade_demand_vs_supply_gap():
    db = MagicMock()

    def _query_for(*models):
        name = _model_name(models[0]) if models else ""
        if name == "SDWISStateSystem":
            return _Query([_sdwis(population_served=150000)])
        if name == "NpdesStateFacility":
            return _Query([_npdes(plant_class="4A")])
        # Column pair query for StateOperatorCertAggregate
        return _Query([("A", 1), ("4A", 0)])

    db.query.side_effect = _query_for
    result = corr.grade_demand_vs_supply(db, "NY")
    assert result["id"] == "grade_demand_vs_supply"
    assert result["rows"]
    assert any(r["grade_code"] == "A" for r in result["rows"])
    assert result["data_mode"] in ("live", "mixed")


def test_renewal_cliff_heatmap():
    db = MagicMock()
    db.query.return_value = _Query(
        [
            _agg(expiration_month="2026-10", operator_count=5),
            _agg(county="Erie", expiration_month="2027-06", operator_count=3),
        ]
    )
    result = corr.renewal_cliff(db, "NY")
    assert result["id"] == "renewal_cliff"
    assert result["counties"]
    assert result["data_mode"] == "live"


def test_retirement_horizon():
    db = MagicMock()

    def _query_for(*models):
        name = _model_name(models[0]) if models else ""
        if name == "WorkforceEmployee":
            return _Query([_emp(), _emp(county_of_employment="Erie")])
        if name == "WorkforcePosition":
            return _Query([_pos()])
        return _Query([])

    db.query.side_effect = _query_for
    with patch.object(corr, "_district_codes_for_state", return_value=["D1"]):
        result = corr.retirement_horizon(db, "NY")

    assert result["id"] == "retirement_horizon"
    assert result["counties"]
    assert any(r["metric"] == "vacant_positions" for r in result["rows"])


def test_source_water_complexity_notes_missing_primary_source():
    db = MagicMock()
    db.query.return_value = _Query(
        [
            _sdwis(population_served=200, snc="Y", qtrs_with_vio=4),
            _sdwis(population_served=50000, snc="N", health_flag="Y"),
        ]
    )
    result = corr.source_water_complexity(db, "NY")
    assert result["id"] == "source_water_complexity"
    assert result["rows"]
    assert any("primary_source" in n.lower() for n in result["notes"])


def test_fundable_need_overlay_with_dac():
    db = MagicMock()
    overlay = SimpleNamespace(value_numeric=1.0, value_json={"is_dac": True}, fetched_at=None)

    def _query_for(*models):
        name = _model_name(models[0]) if models else ""
        if name == "SDWISStateSystem":
            return _Query([_sdwis(snc="Y")])
        if name == "NpdesStateFacility":
            return _Query([_npdes(snc="Y", major_minor="MAJOR")])
        return _Query([])

    db.query.side_effect = _query_for
    with patch.object(corr, "_latest_overlay", return_value=overlay):
        result = corr.fundable_need_overlay(db, "NY")

    assert result["id"] == "fundable_need_overlay"
    albany = next(c for c in result["counties"] if c["county"] == "Albany")
    assert albany["is_dac"] is True
    assert albany["fundable_score"] > 0


def test_build_insights_overview_persona_order():
    db = MagicMock()
    stub_base = {
        "title": "t",
        "persona_relevance": ["jenny", "regulator", "utility"],
        "data_mode": "curated",
        "summary": "s",
        "notes": [],
        "counties": [],
    }
    builders = {
        cid: (lambda db, st, _id=cid: {**stub_base, "id": _id}) for cid in CORRELATION_IDS
    }
    with patch("app.services.insights.service.CORRELATION_BUILDERS", builders):
        overview = build_insights_overview(db, "NY", persona="jenny")

    assert overview["state_code"] == "NY"
    assert overview["persona"] == "jenny"
    assert overview["data_mode"] == "curated"
    assert len(overview["correlations"]) == 6
    assert overview["correlations"][0]["id"] == "compliance_vs_coverage"


def test_get_correlation_unknown():
    db = MagicMock()
    try:
        get_correlation(db, "not_a_real_id", "NY")
        assert False, "expected KeyError"
    except KeyError:
        pass
