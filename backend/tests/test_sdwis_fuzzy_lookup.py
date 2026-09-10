"""Unit tests for fuzzy PWS name matching."""

from app.services.sdwis_fuzzy_lookup import _acronyms_for_name, _score_row


def test_case_insensitive_substring():
    score, reason = _score_row("westbury", "WESTBURY WD", "NY2902856")
    assert score >= 85
    assert "name" in reason


def test_acronym_wwd_matches_westbury_wd():
    acros = _acronyms_for_name("WESTBURY WD")
    assert "wwd" in acros
    score, reason = _score_row("WWD", "WESTBURY WD", "NY2902856")
    assert score >= 74
    assert "acronym" in reason


def test_acronym_wwd_matches_westbury_water_district():
    score, reason = _score_row("wwd", "Westbury Water District", "NY1")
    assert score >= 74
    assert "acronym" in reason


def test_near_spelling():
    score, reason = _score_row("Westbery", "WESTBURY WD", "NY2902856")
    assert score >= 55
    assert reason in {"similar spelling", "name contains", "name starts with"}
