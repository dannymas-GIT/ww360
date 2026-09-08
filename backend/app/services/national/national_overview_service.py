"""National executive KPI roll-ups from SDWIS cache and external metrics."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.national_metrics import ExternalMetricSnapshot, StateOperatorCertAggregate
from app.models.sdwis_state_system import SDWISStateSystem
from app.models.water_district import WaterDistrict
from app.models.workforce_organization import WorkforceOrganization
from app.services.national.constants import ALL_SDWIS_STATE_CODES
from app.services.sdwis_workforce_insights import build_workforce_insights


def _latest_metric(db: Session, source: str, scope_type: str, scope_code: str, key: str) -> ExternalMetricSnapshot | None:
    return (
        db.query(ExternalMetricSnapshot)
        .filter(
            ExternalMetricSnapshot.source == source,
            ExternalMetricSnapshot.scope_type == scope_type,
            ExternalMetricSnapshot.scope_code == scope_code,
            ExternalMetricSnapshot.metric_key == key,
        )
        .order_by(ExternalMetricSnapshot.fetched_at.desc())
        .first()
    )


def _state_compliance_stats(db: Session, state_code: str) -> dict[str, Any]:
    q = db.query(SDWISStateSystem).filter(SDWISStateSystem.state_code == state_code.upper()[:2])
    total = q.count()
    if total == 0:
        return {"active_cws": 0, "health_violations": 0, "snc_count": 0, "population_served": 0}
    health = q.filter(SDWISStateSystem.health_flag.in_(["Y", "Yes", "1"])).count()
    snc = q.filter(SDWISStateSystem.snc.isnot(None), SDWISStateSystem.snc != "No").count()
    pop = db.query(func.coalesce(func.sum(SDWISStateSystem.population_served), 0)).filter(
        SDWISStateSystem.state_code == state_code.upper()[:2]
    ).scalar()
    return {
        "active_cws": total,
        "health_violations": health,
        "snc_count": snc,
        "population_served": int(pop or 0),
    }


def build_national_overview(db: Session) -> dict[str, Any]:
    states_with_data = (
        db.query(SDWISStateSystem.state_code)
        .distinct()
        .all()
    )
    state_codes = sorted({r[0] for r in states_with_data if r[0]})

    us_stats = {"active_cws": 0, "health_violations": 0, "snc_count": 0, "population_served": 0}
    state_rows = []
    for st in state_codes:
        stats = _state_compliance_stats(db, st)
        for k in us_stats:
            us_stats[k] += stats[k]
        dwsrf = _latest_metric(db, "epa_dwsrf", "state", st, "dwsrf_allotment_usd")
        openings = _latest_metric(db, "projections_central", "state", st, "operator_annual_openings")
        roster_count = (
            db.query(func.coalesce(func.sum(StateOperatorCertAggregate.operator_count), 0))
            .filter(StateOperatorCertAggregate.state_code == st)
            .scalar()
        )
        systems_per_op = None
        if roster_count and stats["active_cws"]:
            systems_per_op = round(stats["active_cws"] / float(roster_count), 2)
        state_rows.append(
            {
                "state_code": st,
                "active_cws": stats["active_cws"],
                "health_violations": stats["health_violations"],
                "snc_count": stats["snc_count"],
                "population_served": stats["population_served"],
                "dwsrf_allotment_usd": dwsrf.value_numeric if dwsrf else None,
                "operator_annual_openings": openings.value_numeric if openings else None,
                "certified_operators": int(roster_count or 0) if roster_count else None,
                "systems_per_operator": systems_per_op,
            }
        )

    emp_2024 = _latest_metric(db, "bls_oep", "us", "US", "operator_employment_2024")
    emp_2034 = _latest_metric(db, "bls_oep", "us", "US", "operator_employment_2034")
    openings_us = _latest_metric(db, "bls_oep", "us", "US", "operator_annual_openings")
    lsl = _latest_metric(db, "epa_lcri", "us", "US", "estimated_lead_service_lines")
    grants = _latest_metric(db, "grants_gov", "us", "US", "workforce_grant_opportunities")

    live_states = (
        db.query(WorkforceOrganization.state_code)
        .filter(WorkforceOrganization.is_active.is_(True))
        .distinct()
        .all()
    )
    enrolled_districts = db.query(WaterDistrict).filter(WaterDistrict.is_active.is_(True)).count()

    return {
        "as_of": datetime.utcnow().isoformat() + "Z",
        "headline_kpis": {
            "workforce_replacement_gap": {
                "employment_2024": emp_2024.value_numeric if emp_2024 else 132400,
                "employment_2034": emp_2034.value_numeric if emp_2034 else 123800,
                "annual_openings": openings_us.value_numeric if openings_us else 10700,
                "source": "bls_oep",
            },
            "systems_per_certified_operator": {
                "national_value": round(us_stats["active_cws"] / max(
                    db.query(func.coalesce(func.sum(StateOperatorCertAggregate.operator_count), 0))
                    .filter(StateOperatorCertAggregate.state_code == "NY")
                    .scalar() or 1,
                    1,
                ), 2),
                "roster_states": ["NY"],
                "source": "nysdoh_roster",
            },
            "compliance_pressure": {
                "health_violation_systems": us_stats["health_violations"],
                "snc_systems": us_stats["snc_count"],
                "active_cws": us_stats["active_cws"],
                "source": "epa_echo_sdwis",
            },
            "regulatory_workload": {
                "estimated_lead_service_lines": lsl.value_numeric if lsl else 4_000_000,
                "source": "epa_lcri",
            },
            "investment_pipeline": {
                "workforce_grant_opportunities": grants.value_numeric if grants else None,
                "source": "grants_gov",
            },
        },
        "states": state_rows,
        "program_adoption": {
            "live_state_orgs": len({r[0] for r in live_states if r[0] and r[0] != "US"}),
            "enrolled_districts": enrolled_districts,
        },
        "sources_freshness": _sources_freshness(db),
    }


def build_state_scorecard(db: Session, state_code: str) -> dict[str, Any]:
    st = state_code.upper()[:2]
    insights = build_workforce_insights(db, st)
    stats = _state_compliance_stats(db, st)
    roster_total = (
        db.query(func.coalesce(func.sum(StateOperatorCertAggregate.operator_count), 0))
        .filter(StateOperatorCertAggregate.state_code == st)
        .scalar()
    )
    dwsrf = _latest_metric(db, "epa_dwsrf", "state", st, "dwsrf_allotment_usd")
    openings = _latest_metric(db, "projections_central", "state", st, "operator_annual_openings")

    return {
        "state_code": st,
        "sdwis_insights": insights,
        "compliance": stats,
        "certified_operators": int(roster_total or 0) if roster_total else None,
        "systems_per_operator": (
            round(stats["active_cws"] / float(roster_total), 2)
            if roster_total and stats["active_cws"]
            else None
        ),
        "dwsrf_allotment_usd": dwsrf.value_numeric if dwsrf else None,
        "operator_annual_openings": openings.value_numeric if openings else None,
        "workforce_readiness_index": _readiness_index(stats, roster_total, openings),
    }


def _readiness_index(stats, roster_total, openings) -> float | None:
    """Simple composite 0-100 for state scorecard."""
    if not stats["active_cws"]:
        return None
    compliance_score = max(0, 100 - (stats["health_violations"] / max(stats["active_cws"], 1)) * 200)
    roster_score = min(100, (float(roster_total or 0) / max(stats["active_cws"], 1)) * 50) if roster_total else 50
    pipeline_score = min(100, float(openings.value_numeric) * 5) if openings and openings.value_numeric else 50
    return round((compliance_score + roster_score + pipeline_score) / 3, 1)


def _sources_freshness(db: Session) -> list[dict[str, Any]]:
    rows = (
        db.query(
            ExternalMetricSnapshot.source,
            func.max(ExternalMetricSnapshot.fetched_at).label("last_fetched"),
            func.count(ExternalMetricSnapshot.id).label("metric_count"),
        )
        .group_by(ExternalMetricSnapshot.source)
        .all()
    )
    sdwis_last = db.query(func.max(SDWISStateSystem.last_refreshed)).scalar()
    out = [
        {
            "source": r.source,
            "last_fetched": r.last_fetched.isoformat() if r.last_fetched else None,
            "metric_count": r.metric_count,
        }
        for r in rows
    ]
    if sdwis_last:
        out.append(
            {
                "source": "epa_echo_sdwis",
                "last_fetched": sdwis_last.isoformat() if hasattr(sdwis_last, "isoformat") else str(sdwis_last),
                "metric_count": db.query(SDWISStateSystem).count(),
            }
        )
    return out
