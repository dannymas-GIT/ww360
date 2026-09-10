"""Tests for national overview roll-up."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.services.national.national_overview_service import build_national_overview


def test_build_national_overview_empty_db():
    db = MagicMock()
    db.query.return_value.distinct.return_value.all.return_value = []
    db.query.return_value.filter.return_value.count.return_value = 0
    db.query.return_value.filter.return_value.scalar.return_value = 0
    db.query.return_value.filter.return_value.all.return_value = []
    db.query.return_value.filter.return_value.group_by.return_value.all.return_value = []
    db.query.return_value.group_by.return_value.all.return_value = []
    db.query.return_value.count.return_value = 0
    db.query.return_value.order_by.return_value.first.return_value = None

    result = build_national_overview(db)
    assert "headline_kpis" in result
    assert "states" in result
    assert result["headline_kpis"]["workforce_replacement_gap"]["employment_2024"] == 132400
