"""Auto-fill stats for EPA / EFC grant narrative templates."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.grants.facts import build_district_facts, build_program_facts


def epa_iwiwd_autofill(
    db: Session, *, state_code: str = "NY", district_code: str = ""
) -> dict[str, Any]:
    facts = (
        build_district_facts(db, district_code, state_code)
        if district_code
        else build_program_facts(db, state_code)
    )
    return {
        "template_id": "epa-iwiwd-2026-narrative",
        "opportunity_number": "EPA-OW-OWM-26-03",
        "deadline": "2026-10-05",
        "state_code": facts.get("state_code"),
        "applicant": facts.get("program_name") or facts.get("district_code") or "Applicant",
        "stats": {
            "cws_count": facts.get("cws_count"),
            "small_rural_system_count": facts.get("small_rural_system_count"),
            "population_served": facts.get("population_served"),
            "sdwis_snc_count": facts.get("sdwis_snc_count"),
            "health_flag_systems": facts.get("health_flag_systems"),
            "potw_count": facts.get("potw_count"),
            "major_potws": facts.get("major_potws"),
            "potw_snc": facts.get("potw_snc"),
            "employee_count": facts.get("employee_count"),
            "retirement_eligible_count": facts.get("retirement_eligible_count"),
            "retirement_share_pct": facts.get("retirement_share_pct"),
            "vacant_critical_positions": facts.get("vacant_critical_positions"),
            "certs_expiring_90d": facts.get("certs_expiring_90d"),
        },
        "suggested_project_area": (
            "area_3"
            if (facts.get("retirement_share_pct") or 0) >= 15
            or (facts.get("small_rural_system_count") or 0) >= 5
            else "area_1"
        ),
        "narrative_bullets": _bullets(facts),
        "data_mode": facts.get("data_mode", "live"),
    }


def _bullets(facts: dict[str, Any]) -> list[str]:
    bullets: list[str] = []
    pct = facts.get("retirement_share_pct") or 0
    if pct:
        bullets.append(
            f"Approximately {pct}% of tracked water-sector employees are retirement-eligible "
            f"within five years ({facts.get('retirement_eligible_count')} of {facts.get('employee_count')})."
        )
    if facts.get("vacant_critical_positions"):
        bullets.append(
            f"{facts['vacant_critical_positions']} critical positions are currently vacant — "
            "strengthening the case for apprenticeship and bridge programs (Area 1 / Area 3)."
        )
    if facts.get("certs_expiring_90d"):
        bullets.append(
            f"{facts['certs_expiring_90d']} operator certifications expire within 90 days, "
            "indicating an acute renewal / CEU support need."
        )
    if facts.get("small_rural_system_count"):
        bullets.append(
            f"{facts['small_rural_system_count']} community water systems serve fewer than 10,000 people — "
            "priority partners for regional workforce collaborations (Area 3)."
        )
    if facts.get("potw_count"):
        bullets.append(
            f"State inventory includes {facts['potw_count']} POTWs "
            f"({facts.get('major_potws') or 0} major) needing certified wastewater operators."
        )
    if facts.get("sdwis_snc_count"):
        bullets.append(
            f"{facts['sdwis_snc_count']} systems show Serious Noncompliance signals — "
            "workforce capacity is a compliance risk factor."
        )
    return bullets
