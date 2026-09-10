"""Tests for SDWIS workforce insights aggregation."""

from datetime import datetime
from unittest.mock import MagicMock

from app.services.sdwis_workforce_insights import build_workforce_insights


def test_build_workforce_insights_empty_db():
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    db.query.return_value.filter.return_value.filter.return_value.all.return_value = []
    db.query.return_value.filter.return_value.filter.return_value.count.return_value = 0

    result = build_workforce_insights(db, "NY")
    assert result.state_code == "NY"
    assert result.active_cws_count == 0
    assert result.total_population_served == 0
    assert result.member_watchlist == []
