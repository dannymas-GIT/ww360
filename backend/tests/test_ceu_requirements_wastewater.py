"""Unit tests for wastewater CEU / RTC requirements."""

from __future__ import annotations

from datetime import date

from app.services.workforce_succession.ceu_requirements import (
    get_requirements_taxonomy,
    required_hours_for_grade,
)
from app.services.workforce_succession.ceu_requirements_wastewater import (
    CYBER_CEU_EFFECTIVE_DATE,
    CYBER_CONTACT_HOURS,
    RENEWAL_CYCLE_YEARS_WW,
    cyber_rtc_required,
    get_wastewater_requirements_taxonomy,
    grade_meets_required,
    required_hours_for_grade_ww,
)


def test_wastewater_renewal_cycle_is_five_years():
    assert RENEWAL_CYCLE_YEARS_WW == 5
    taxonomy = get_wastewater_requirements_taxonomy()
    assert taxonomy["renewal_cycle_years"] == 5


def test_wastewater_required_hours_by_grade():
    assert required_hours_for_grade_ww("1") == 12.0
    assert required_hours_for_grade_ww("4") == 30.0
    assert required_hours_for_grade_ww("3A") == 24.0


def test_cyber_rtc_rule_applies_from_2027():
    assert cyber_rtc_required(date(2026, 12, 31)) is False
    assert cyber_rtc_required(date(2027, 1, 1)) is True
    assert cyber_rtc_required(CYBER_CEU_EFFECTIVE_DATE) is True

    base = required_hours_for_grade_ww("2", expiration_date=date(2026, 6, 1))
    with_cyber = required_hours_for_grade_ww("2", expiration_date=date(2027, 6, 1))
    assert with_cyber - base == CYBER_CONTACT_HOURS


def test_required_hours_dispatch_by_cert_program():
    dw = required_hours_for_grade("IA", cert_program="drinking_water")
    ww_ceu = required_hours_for_grade("3", cert_program="wastewater")
    assert dw == 3.0
    assert ww_ceu == 2.4  # 24 contact hours / 10


def test_get_requirements_taxonomy_includes_both_programs():
    taxonomy = get_requirements_taxonomy()
    assert "programs" in taxonomy
    assert "drinking_water" in taxonomy["programs"]
    assert "wastewater" in taxonomy["programs"]
    assert taxonomy["programs"]["wastewater"]["renewal_cycle_years"] == 5
    assert taxonomy["renewal_cycle_years"] == 3


def test_grade_meets_required_wastewater():
    assert grade_meets_required("4", "3") is True
    assert grade_meets_required("2", "3") is False
    assert grade_meets_required("4A", "3A") is True
    assert grade_meets_required("4", "3A") is False
