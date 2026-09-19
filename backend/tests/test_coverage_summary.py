"""Unit tests for facility operator coverage summary."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock

from app.models.sync import ExtFacility
from app.models.workforce_succession import WorkforceCertification, WorkforceEmployee
from app.services.workforce_succession.coverage_summary_service import compute_coverage_summary


def _mock_db_with_facility_and_certs(
    facility: ExtFacility,
    cert_rows: list[tuple[WorkforceCertification, WorkforceEmployee]],
):
    db = MagicMock()

    def query_side_effect(*models):
        q = MagicMock()
        # Service calls db.query(ExtFacility) or db.query(WorkforceCertification, WorkforceEmployee)
        if models and models[0] is ExtFacility:
            q.filter.return_value.first.return_value = facility
        elif models and models[0] is WorkforceCertification:
            q.join.return_value.filter.return_value.all.return_value = cert_rows
        return q

    db.query.side_effect = query_side_effect
    return db


def test_coverage_summary_no_chief_operator():
    facility = MagicMock(spec=ExtFacility)
    facility.district_code = "HF001"
    facility.facility_id = "WWTP-1"
    facility.facility_type = "wwtp"
    facility.plant_class = "3"

    db = _mock_db_with_facility_and_certs(facility, [])
    result = compute_coverage_summary(
        db, district_code="HF001", facility_id="WWTP-1", today=date(2026, 1, 1)
    )
    assert result["program"] == "wastewater"
    assert result["required_grade"] == "3"
    assert result["covered"] is False
    assert result["chief_operator"] is None
    assert "no_chief_operator" in result["warnings"]


def test_coverage_summary_grade_below_class_and_expiring():
    facility = MagicMock(spec=ExtFacility)
    facility.district_code = "HF001"
    facility.facility_id = "WWTP-1"
    facility.facility_type = "wwtp"
    facility.plant_class = "4"

    cert = MagicMock(spec=WorkforceCertification)
    cert.certification_grade = "2"
    cert.cert_program = "wastewater"
    cert.expiration_date = date(2026, 2, 15)
    emp = MagicMock(spec=WorkforceEmployee)
    emp.employee_code = "E001"
    emp.full_name = "Alex Operator"

    db = _mock_db_with_facility_and_certs(facility, [(cert, emp)])
    result = compute_coverage_summary(
        db, district_code="HF001", facility_id="WWTP-1", today=date(2026, 1, 1)
    )
    assert result["covered"] is False
    assert "grade_below_class" in result["warnings"]
    assert "expiring_90d" in result["warnings"]
    assert result["chief_operator"]["employee_code"] == "E001"


def test_coverage_summary_covered_when_grade_meets_class():
    facility = MagicMock(spec=ExtFacility)
    facility.district_code = "HF001"
    facility.facility_id = "WWTP-1"
    facility.facility_type = "wwtp"
    facility.plant_class = "3"

    cert = MagicMock(spec=WorkforceCertification)
    cert.certification_grade = "4"
    cert.cert_program = "wastewater"
    cert.expiration_date = date(2028, 1, 1)
    emp = MagicMock(spec=WorkforceEmployee)
    emp.employee_code = "E002"
    emp.full_name = "Sam Chief"

    db = _mock_db_with_facility_and_certs(facility, [(cert, emp)])
    result = compute_coverage_summary(
        db, district_code="HF001", facility_id="WWTP-1", today=date(2026, 1, 1)
    )
    assert result["covered"] is True
    assert result["warnings"] == []
