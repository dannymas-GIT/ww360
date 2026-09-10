"""Deterministic sample continuity payloads for empty / unlinked logins.

Used when a viewer has no workforce profile linked, or a district has no
live roster yet — so Continuity still demos usefully. Always mark
``data_mode: "sample"`` so the UI can show the Sample data badge.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional


def build_sample_continuity_response(
    district_code: str,
    *,
    reason: str = "empty_district",
    today: Optional[date] = None,
) -> Dict[str, Any]:
    """Return a continuity-shaped payload with illustrative (non-live) numbers."""
    today = today or date.today()
    now = datetime.utcnow()
    notices = {
        "no_linked_profile": (
            "Sample data — this login has no workforce profile linked. "
            "Figures below are illustrative, not live district records."
        ),
        "empty_district": (
            "Sample data — this district has no live workforce roster yet. "
            "Figures below are illustrative until data is imported or entered."
        ),
    }
    notice = notices.get(
        reason,
        "Sample data — not live district records.",
    )

    coverage = [
        {
            "function_id": -1,
            "function_code": "SAMPLE-TREAT",
            "function_name": "Water treatment operations",
            "function_area": "Treatment",
            "primary_employee_codes": ["SAMPLE-OP-01"],
            "backup_employee_codes": ["SAMPLE-OP-02"],
            "trainee_employee_codes": ["SAMPLE-OP-03"],
            "backup_count": 1,
            "has_qualified_backup": True,
            "risk_level": "ok",
        },
        {
            "function_id": -2,
            "function_code": "SAMPLE-DIST",
            "function_name": "Distribution system response",
            "function_area": "Distribution",
            "primary_employee_codes": ["SAMPLE-OP-02"],
            "backup_employee_codes": [],
            "trainee_employee_codes": ["SAMPLE-OP-03"],
            "backup_count": 0,
            "has_qualified_backup": False,
            "risk_level": "high",
        },
        {
            "function_id": -3,
            "function_code": "SAMPLE-LAB",
            "function_name": "Compliance sampling & lab coordination",
            "function_area": "Compliance",
            "primary_employee_codes": ["SAMPLE-OP-01"],
            "backup_employee_codes": ["SAMPLE-OP-03"],
            "trainee_employee_codes": [],
            "backup_count": 1,
            "has_qualified_backup": True,
            "risk_level": "ok",
        },
    ]

    cert_cliff = [
        {
            "certification_id": -1,
            "employee_code": "SAMPLE-OP-02",
            "employee_name": "Sample Operator (Jordan Lee)",
            "certification_type": "Distribution",
            "certification_grade": "II",
            "expiration_date": today + timedelta(days=45),
            "days_until_expiration": 45,
            "is_required_for_role": True,
        },
        {
            "certification_id": -2,
            "employee_code": "SAMPLE-OP-01",
            "employee_name": "Sample Operator (Alex Rivera)",
            "certification_type": "Treatment",
            "certification_grade": "IIA",
            "expiration_date": today + timedelta(days=210),
            "days_until_expiration": 210,
            "is_required_for_role": True,
        },
    ]

    retirement_horizon = [
        {
            "employee_id": -1,
            "employee_code": "SAMPLE-OP-01",
            "employee_name": "Sample Operator (Alex Rivera)",
            "position_code": "SAMPLE-CHIEF",
            "retirement_eligible_date": today + timedelta(days=400),
            "months_until_eligible": 13,
        }
    ]

    upcoming_milestones = [
        {
            "milestone_id": -1,
            "position_code": "SAMPLE-CHIEF",
            "title": "Shadow week — treatment console",
            "milestone_type": "knowledge_transfer",
            "toolkit_phase": "prepare",
            "target_date": today + timedelta(days=30),
            "status": "planned",
            "is_overdue": False,
        },
        {
            "milestone_id": -2,
            "position_code": "SAMPLE-DIST-LEAD",
            "title": "Complete Grade II CEU package",
            "milestone_type": "training",
            "toolkit_phase": "develop",
            "target_date": today - timedelta(days=7),
            "status": "in_progress",
            "is_overdue": True,
        },
    ]

    scorecard = {
        "district_code": district_code,
        "as_of": now,
        "total_positions": 6,
        "funded_positions": 5,
        "vacant_positions": 1,
        "total_employees": 4,
        "total_critical_functions": 3,
        "functions_with_qualified_backup": 2,
        "functions_without_backup": 1,
        "coverage_pct": 66.7,
        "cert_cliff_30d": 0,
        "cert_cliff_90d": 1,
        "cert_cliff_365d": 2,
        "employees_retirement_eligible_24mo": 1,
        "overdue_milestones": 1,
        "readiness_score": 62.0,
        "ceu_shortfall_count": 1,
        "ceu_avg_completion_pct": 74.0,
        "doh352_ready_count": 2,
    }

    return {
        "scorecard": scorecard,
        "coverage": coverage,
        "cert_cliff": cert_cliff,
        "retirement_horizon": retirement_horizon,
        "upcoming_milestones": upcoming_milestones,
        "data_mode": "sample",
        "sample_notice": notice,
        "sample_reason": reason,
    }
