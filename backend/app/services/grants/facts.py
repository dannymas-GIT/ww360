"""District / program fact assembly for grant eligibility matching."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session


def _flag(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).strip().upper() not in ("", "N", "NO", "FALSE", "0", "NONE")


def build_district_facts(
    db: Session, district_code: str, state_code: str = "NY"
) -> dict[str, Any]:
    """Assemble matcher facts from live WW360 tables + ExternalMetricSnapshot overlays."""
    from app.models.national_metrics import ExternalMetricSnapshot
    from app.models.npdes_state_facility import NpdesStateFacility
    from app.models.sdwis_state_system import SDWISStateSystem
    from app.models.workforce_succession import (
        WorkforceCertification,
        WorkforceEmployee,
        WorkforcePosition,
    )

    st = (state_code or "NY").upper()[:2]
    code = (district_code or "").strip()

    facts: dict[str, Any] = {
        "district_code": code or None,
        "state_code": st,
        "is_ny_municipality": st == "NY" and bool(code),
        "applicant_nonprofit_or_edu": not bool(code),
        "data_mode": "live",
    }

    sdwis_rows = (
        db.query(SDWISStateSystem).filter(SDWISStateSystem.state_code == st).limit(20000).all()
    )
    cws_rows = [r for r in sdwis_rows if (r.pws_type or "").upper() == "CWS"]
    snc = sum(1 for r in sdwis_rows if _flag(r.snc))
    health = sum(1 for r in sdwis_rows if _flag(r.health_flag))
    pop = sum(int(r.population_served or 0) for r in cws_rows)
    small = sum(
        1 for r in cws_rows if r.population_served is not None and r.population_served < 10000
    )

    facts["cws_count"] = len(cws_rows)
    facts["small_rural_system_count"] = small
    facts["population_served"] = pop
    facts["sdwis_snc_count"] = snc
    facts["health_flag_systems"] = health
    facts["has_dw_project_need"] = bool(snc or health or cws_rows)

    potw_rows = (
        db.query(NpdesStateFacility).filter(NpdesStateFacility.state_code == st).limit(20000).all()
    )
    potws = [
        r
        for r in potw_rows
        if not r.facility_type_code or r.facility_type_code.upper() == "POTW"
    ]
    major = [r for r in potws if r.major_minor and "major" in r.major_minor.lower()]
    facts["potw_count"] = len(potws)
    facts["major_potws"] = len(major)
    facts["potw_snc"] = any(_flag(r.snc) for r in potws)
    facts["has_ww_project_need"] = bool(potws)
    facts["has_dw_or_ww_need"] = bool(facts["has_dw_project_need"] or facts["has_ww_project_need"])

    today = date.today()
    horizon = today + timedelta(days=365 * 5)
    emp_q = db.query(WorkforceEmployee).filter(WorkforceEmployee.is_active.is_(True))
    if code:
        emp_q = emp_q.filter(WorkforceEmployee.district_code == code)
    employees = emp_q.limit(5000).all()
    emp_count = len(employees)

    vacant_q = db.query(WorkforcePosition).filter(WorkforcePosition.is_vacant.is_(True))
    if code:
        vacant_q = vacant_q.filter(WorkforcePosition.district_code == code)
    vacant_n = vacant_q.count()

    retirement_n = sum(
        1
        for emp in employees
        if (d := (emp.retirement_eligible_date or emp.planned_departure_date)) and d <= horizon
    )

    facts["employee_count"] = emp_count
    facts["vacant_critical_positions"] = int(vacant_n or 0)
    facts["retirement_eligible_count"] = retirement_n
    facts["retirement_share_pct"] = (
        round(100.0 * retirement_n / emp_count, 1) if emp_count else 0.0
    )

    cert_q = db.query(WorkforceCertification).filter(
        WorkforceCertification.record_status == "active"
    )
    if code:
        cert_q = cert_q.filter(WorkforceCertification.district_code == code)
    cutoff = today + timedelta(days=90)
    facts["certs_expiring_90d"] = sum(
        1
        for c in cert_q.limit(5000).all()
        if c.expiration_date and today <= c.expiration_date <= cutoff
    )

    def _latest(source: str, metric_key: str, scope_code: str):
        return (
            db.query(ExternalMetricSnapshot)
            .filter(
                ExternalMetricSnapshot.source == source,
                ExternalMetricSnapshot.metric_key == metric_key,
                ExternalMetricSnapshot.scope_code == scope_code,
            )
            .order_by(ExternalMetricSnapshot.fetched_at.desc())
            .first()
        )

    scope = code or st
    mhi = _latest("census_acs", "mhi_usd", scope) or _latest("census_acs", "mhi_usd", st)
    state_mhi = _latest("census_acs", "mhi_usd", st)
    if mhi and mhi.value_numeric is not None:
        facts["mhi_usd"] = mhi.value_numeric
    if state_mhi and state_mhi.value_numeric is not None and facts.get("mhi_usd") is not None:
        facts["mhi_below_state"] = facts["mhi_usd"] < state_mhi.value_numeric
    else:
        facts["mhi_below_state"] = None

    dac = _latest("ny_dac", "is_dac", scope) or _latest("ny_dac", "is_dac", st)
    if dac and dac.value_numeric is not None:
        facts["dac_status"] = bool(dac.value_numeric)
    elif dac and isinstance(dac.value_json, dict):
        facts["dac_status"] = bool(dac.value_json.get("is_dac"))
    else:
        facts["dac_status"] = None

    ej = _latest("epa_ejscreen", "ej_index", scope)
    if ej and ej.value_numeric is not None:
        facts["ej_index"] = ej.value_numeric

    for key in (
        "emerging_contaminant_exceedance",
        "lsl_inventory_needed",
        "multi_municipality_project",
        "green_infrastructure_project",
        "cannot_finance_commercially",
        "never_received_water_funding",
        "septic_priority_area",
        "project_cost_usd",
    ):
        facts.setdefault(key, None)

    return facts


def build_program_facts(db: Session, state_code: str = "NY") -> dict[str, Any]:
    """Statewide / OWW program-level facts for EPA workforce NOFO auto-fill."""
    facts = build_district_facts(db, district_code="", state_code=state_code)
    facts["owner_scope"] = "program"
    facts["applicant_nonprofit_or_edu"] = True
    facts["is_ny_municipality"] = False
    facts["program_name"] = "One Water Workforce / NYSAWWA"
    return facts
