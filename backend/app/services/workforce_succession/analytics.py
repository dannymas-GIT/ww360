"""Workforce continuity analytics.

Computes the data behind the continuity dashboard and the executive scorecard.
The implementation favors readable, deterministic logic over query
optimization; the volumes are small (utilities have tens to a few hundred
positions, not millions).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.workforce_succession import (
    WorkforceCertification,
    WorkforceCriticalFunction,
    WorkforceEmployee,
    WorkforcePosition,
    WorkforceRoleCoverage,
    WorkforceTransitionMilestone,
)
from app.services.workforce_succession.ceu_service import compute_district_ceu_summaries
from app.services.workforce_succession.workforce_alert_settings import (
    load_workforce_alert_settings,
)


def _months_between(d1: date, d2: date) -> int:
    """Approximate whole-month difference (d1 - d2)."""
    return (d1.year - d2.year) * 12 + (d1.month - d2.month)


def _classify_function_risk(
    primaries: int, backups: int, trainees: int
) -> str:
    if primaries == 0:
        return "critical"
    if backups == 0 and trainees == 0:
        return "high"
    if backups == 0:
        return "medium"
    return "ok"


def compute_continuity_response(
    db: Session,
    district_code: str,
    today: Optional[date] = None,
    *,
    employee_code: Optional[str] = None,
) -> Dict:
    """Build the continuity dashboard payload for a single district.

    When ``employee_code`` is set, restrict employee/cert/CEU views to that
    operator (self-scoped operator logins).
    """
    today = today or date.today()
    now = datetime.utcnow()

    positions = (
        db.query(WorkforcePosition)
        .filter(
            WorkforcePosition.district_code == district_code,
            WorkforcePosition.record_status == "active",
        )
        .all()
    )
    emp_query = db.query(WorkforceEmployee).filter(
        WorkforceEmployee.district_code == district_code,
        WorkforceEmployee.record_status == "active",
    )
    if employee_code:
        emp_query = emp_query.filter(WorkforceEmployee.employee_code == employee_code)
    employees = emp_query.all()
    employees_by_code = {e.employee_code: e for e in employees}

    functions = (
        db.query(WorkforceCriticalFunction)
        .filter(
            WorkforceCriticalFunction.district_code == district_code,
            WorkforceCriticalFunction.record_status == "active",
        )
        .all()
    )
    coverage_rows = (
        db.query(WorkforceRoleCoverage)
        .filter(
            WorkforceRoleCoverage.district_code == district_code,
            WorkforceRoleCoverage.record_status == "active",
        )
        .all()
    )
    if employee_code:
        coverage_rows = [c for c in coverage_rows if c.employee_code == employee_code]

    coverage_by_function: Dict[str, Dict[str, List[str]]] = {}
    for c in coverage_rows:
        bucket = coverage_by_function.setdefault(
            c.function_code,
            {"primary": [], "backup": [], "trainee": [], "interim": []},
        )
        bucket.setdefault(c.coverage_role, [])
        bucket[c.coverage_role].append(c.employee_code)

    coverage_payload: List[Dict] = []
    functions_with_backup = 0
    functions_without_backup = 0
    for fn in functions:
        roles = coverage_by_function.get(
            fn.function_code,
            {"primary": [], "backup": [], "trainee": [], "interim": []},
        )
        primaries = roles.get("primary", [])
        backups = roles.get("backup", []) + roles.get("interim", [])
        trainees = roles.get("trainee", [])
        # Self-scoped: only include functions the operator is on.
        if employee_code and not (primaries or backups or trainees):
            continue
        risk = _classify_function_risk(
            len(primaries), len(backups), len(trainees)
        )
        if backups:
            functions_with_backup += 1
        else:
            functions_without_backup += 1
        coverage_payload.append(
            {
                "function_id": fn.id,
                "function_code": fn.function_code,
                "function_name": fn.function_name,
                "function_area": fn.function_area,
                "primary_employee_codes": primaries,
                "backup_employee_codes": backups,
                "trainee_employee_codes": trainees,
                "backup_count": len(backups),
                "has_qualified_backup": len(backups) > 0,
                "risk_level": risk,
            }
        )

    cert_query = db.query(WorkforceCertification).filter(
        WorkforceCertification.district_code == district_code,
        WorkforceCertification.record_status == "active",
        WorkforceCertification.expiration_date.isnot(None),
    )
    if employee_code:
        cert_query = cert_query.filter(
            WorkforceCertification.employee_code == employee_code
        )
    cert_rows = cert_query.all()

    cert_cliff: List[Dict] = []
    cliff_30 = cliff_90 = cliff_365 = 0
    for cert in cert_rows:
        if cert.expiration_date is None:
            continue
        delta = (cert.expiration_date - today).days
        if delta <= 30:
            cliff_30 += 1
        if delta <= 90:
            cliff_90 += 1
        if delta <= 365:
            cliff_365 += 1
        if delta <= 365:
            employee = employees_by_code.get(cert.employee_code)
            cert_cliff.append(
                {
                    "certification_id": cert.id,
                    "employee_code": cert.employee_code,
                    "employee_name": employee.full_name if employee else None,
                    "certification_type": cert.certification_type,
                    "certification_grade": cert.certification_grade,
                    "expiration_date": cert.expiration_date,
                    "days_until_expiration": delta,
                    "is_required_for_role": cert.is_required_for_role,
                }
            )
    cert_cliff.sort(key=lambda r: r["days_until_expiration"])

    retirement_horizon: List[Dict] = []
    retirement_24mo = 0
    for emp in employees:
        if not emp.is_active or not emp.retirement_eligible_date:
            continue
        months = _months_between(emp.retirement_eligible_date, today)
        if months > 60:
            continue
        if 0 <= months <= 24:
            retirement_24mo += 1
        retirement_horizon.append(
            {
                "employee_id": emp.id,
                "employee_code": emp.employee_code,
                "employee_name": emp.full_name,
                "position_code": emp.position_code,
                "retirement_eligible_date": emp.retirement_eligible_date,
                "months_until_eligible": months,
            }
        )
    retirement_horizon.sort(
        key=lambda r: r["months_until_eligible"]
        if r["months_until_eligible"] is not None
        else 9999
    )

    milestones = (
        db.query(WorkforceTransitionMilestone)
        .filter(
            WorkforceTransitionMilestone.district_code == district_code,
            WorkforceTransitionMilestone.record_status == "active",
            WorkforceTransitionMilestone.status.in_(("planned", "in_progress", "blocked")),
        )
        .all()
    )
    upcoming_milestones: List[Dict] = []
    overdue_count = 0
    cutoff = today + timedelta(days=180)
    for m in milestones:
        is_overdue = bool(
            m.target_date and m.target_date < today and m.status != "complete"
        )
        if is_overdue:
            overdue_count += 1
        if m.target_date and m.target_date <= cutoff:
            upcoming_milestones.append(
                {
                    "milestone_id": m.id,
                    "position_code": m.position_code,
                    "title": m.title,
                    "milestone_type": m.milestone_type,
                    "toolkit_phase": m.toolkit_phase,
                    "target_date": m.target_date,
                    "status": m.status,
                    "is_overdue": is_overdue,
                }
            )
    upcoming_milestones.sort(
        key=lambda r: r["target_date"] or date.max
    )

    total_positions = len(positions)
    funded_positions = sum(1 for p in positions if p.is_funded)
    vacant_positions = sum(1 for p in positions if p.is_vacant)
    total_employees = sum(1 for e in employees if e.is_active)
    total_functions = len(functions)
    coverage_pct = (
        100.0 * functions_with_backup / total_functions
        if total_functions
        else 0.0
    )

    has_workforce_data = (
        total_employees > 0 or total_functions > 0 or total_positions > 0
    )

    settings = load_workforce_alert_settings(db, district_code)
    ceu_summaries = compute_district_ceu_summaries(
        db,
        district_code,
        ceu_overrides=settings.ceu_requirements_by_grade or None,
        ceu_shortfall_lead_days=settings.ceu_shortfall_lead_days,
        employee_code=employee_code,
    )
    ceu_shortfall_count = sum(1 for s in ceu_summaries if s.get("is_shortfall"))
    ceu_avg_completion = (
        round(
            sum(s.get("percent_complete", 0) for s in ceu_summaries)
            / len(ceu_summaries),
            1,
        )
        if ceu_summaries
        else 0.0
    )

    # Composite readiness: average only signals that have real denominators.
    # Empty districts must not score as "Adequate" from vacuous 100% cert/retirement.
    if not has_workforce_data:
        readiness_score = 0.0
    else:
        component_scores: List[float] = []
        if total_functions > 0:
            component_scores.append(coverage_pct)
        if total_employees > 0:
            cert_score = max(0.0, 100.0 - 100.0 * cliff_90 / total_employees)
            retirement_score = max(
                0.0, 100.0 - 100.0 * retirement_24mo / total_employees
            )
            component_scores.append(cert_score)
            component_scores.append(retirement_score)
        if ceu_summaries:
            component_scores.append(ceu_avg_completion)
        readiness_score = round(
            sum(component_scores) / len(component_scores), 1
        ) if component_scores else 0.0
    doh352_ready_count = sum(
        1
        for s in ceu_summaries
        if not s.get("is_shortfall") and not (s.get("missing_fields") if isinstance(s.get("missing_fields"), list) else False)
    )

    scorecard = {
        "district_code": district_code,
        "as_of": now,
        "total_positions": total_positions,
        "funded_positions": funded_positions,
        "vacant_positions": vacant_positions,
        "total_employees": total_employees,
        "total_critical_functions": total_functions,
        "functions_with_qualified_backup": functions_with_backup,
        "functions_without_backup": functions_without_backup,
        "coverage_pct": round(coverage_pct, 1),
        "cert_cliff_30d": cliff_30,
        "cert_cliff_90d": cliff_90,
        "cert_cliff_365d": cliff_365,
        "employees_retirement_eligible_24mo": retirement_24mo,
        "overdue_milestones": overdue_count,
        "readiness_score": readiness_score,
        "ceu_shortfall_count": ceu_shortfall_count,
        "ceu_avg_completion_pct": ceu_avg_completion,
        "doh352_ready_count": doh352_ready_count,
    }

    return {
        "scorecard": scorecard,
        "coverage": coverage_payload,
        "cert_cliff": cert_cliff[:50],
        "retirement_horizon": retirement_horizon[:50],
        "upcoming_milestones": upcoming_milestones[:50],
    }
