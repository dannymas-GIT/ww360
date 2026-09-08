"""Aggregate SDWIS data for OWW executive dashboard."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.sdwis_state_system import SDWISStateSystem
from app.models.sdwis_violation import SDWISViolation
from app.models.sdwis_water_system import SDWISWaterSystem
from app.schemas.sdwis import SDWISWorkforceInsightsOut
from app.services.jurisdiction_service import county_region_index, normalize_county_name

_SPLIT_RE = re.compile(r"[,;|]+")

SIZE_TIERS = [
    ("very_small", 0, 500),
    ("small", 500, 3300),
    ("medium", 3300, 10000),
    ("large", 10000, 100000),
    ("very_large", 100000, 10_000_000),
]

# Heuristic: NYS operator grade demand from system size tiers
GRADE_FROM_TIER = {
    "very_small": {"D": 1},
    "small": {"C": 1, "D": 1},
    "medium": {"B": 1, "C": 1},
    "large": {"A": 1, "B": 1},
    "very_large": {"A": 2, "B": 1},
}


def _tier_for_population(pop: Optional[int]) -> str:
    p = pop or 0
    for name, lo, hi in SIZE_TIERS:
        if lo <= p < hi:
            return name
    return "very_large"


def _is_yes(value: object) -> bool:
    return str(value or "").strip().lower() in {"y", "yes", "true", "1"}


def _open_status(status: object) -> bool:
    return str(status or "").strip().lower() != "resolved"


def _training_topic(rule: Optional[str], contaminant: Optional[str]) -> str:
    text = f"{rule or ''} {contaminant or ''}".lower()
    if "lead" in text or "copper" in text or "lcr" in text:
        return "Lead and Copper Rule sampling & corrosion control"
    if "dbp" in text or "disinfection by" in text or "tthm" in text or "haa" in text:
        return "Disinfection byproducts & DBPR compliance CEU"
    if "nitrate" in text or "nitrite" in text:
        return "Nitrate/nitrite monitoring & source protection"
    if "coliform" in text or "e. coli" in text:
        return "Microbiological sampling & distribution hygiene"
    if "arsenic" in text or "rad" in text:
        return "Inorganic/radionuclide treatment CEU"
    return "General SDWA compliance & operator certification"


def _raw_pressure_score(metrics: dict[str, Any]) -> float:
    linked = max(int(metrics.get("linked_systems_count", 1)), 1)
    return (
        int(metrics.get("open_violations", 0)) * 0.40
        + (int(metrics.get("snc_count", 0)) / linked) * 25.0
        + (int(metrics.get("health_flag_count", 0)) / linked) * 15.0
        + (int(metrics.get("serious_violator_count", 0)) / linked) * 10.0
        + int(metrics.get("qtrs_with_vio_sum", 0)) * 0.10
    )


def build_workforce_insights(db: Session, state_code: str) -> SDWISWorkforceInsightsOut:
    state_code = state_code.upper()[:2]
    landscape = (
        db.query(SDWISStateSystem)
        .filter(SDWISStateSystem.state_code == state_code)
        .all()
    )

    cws = [s for s in landscape if (s.pws_type or "").upper() in {"CWS", "COMMUNITY", ""} or True]
    if not cws:
        cws = landscape

    total_pop = sum(s.population_served or 0 for s in cws)
    health_count = sum(1 for s in cws if _is_yes(s.health_flag))
    serious = sum(1 for s in cws if _is_yes(s.serious_violator))
    snc_count = sum(1 for s in cws if _is_yes(s.snc) or (s.qtrs_with_snc or 0) > 0)

    size_tiers: dict[str, int] = defaultdict(int)
    grade_demand: dict[str, int] = defaultdict(int)
    for s in cws:
        tier = _tier_for_population(s.population_served)
        size_tiers[tier] += 1
        for grade, n in GRADE_FROM_TIER.get(tier, {}).items():
            grade_demand[grade] += n

    county_metrics: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "county": "",
            "linked_systems_count": 0,
            "population_served_total": 0,
            "open_violations": 0,
            "serious_violator_count": 0,
            "health_flag_count": 0,
            "snc_count": 0,
            "qtrs_with_vio_sum": 0,
        }
    )
    for s in cws:
        county = (s.county or "Unknown").strip() or "Unknown"
        m = county_metrics[county]
        m["county"] = county
        m["linked_systems_count"] += 1
        m["population_served_total"] += s.population_served or 0
        if _is_yes(s.serious_violator):
            m["serious_violator_count"] += 1
        if _is_yes(s.health_flag):
            m["health_flag_count"] += 1
        if _is_yes(s.snc) or (s.qtrs_with_snc or 0) > 0:
            m["snc_count"] += 1
        m["qtrs_with_vio_sum"] += s.qtrs_with_vio or 0

    linked_systems = (
        db.query(SDWISWaterSystem)
        .filter(SDWISWaterSystem.state_code == state_code)
        .filter(SDWISWaterSystem.district_code.isnot(None))
        .all()
    )
    for ws in linked_systems:
        counties = _SPLIT_RE.split(ws.counties_served or "Member")
        county = counties[0].strip() if counties else "Member"
        if county in county_metrics:
            open_v = (
                db.query(SDWISViolation)
                .filter(SDWISViolation.pwsid == ws.pwsid)
                .filter((SDWISViolation.status.is_(None)) | (SDWISViolation.status != "Resolved"))
                .count()
            )
            county_metrics[county]["open_violations"] += open_v

    region_index = county_region_index(state_code)
    pressure_rows = []
    for county, m in county_metrics.items():
        raw = _raw_pressure_score(m)
        region = region_index.get(normalize_county_name(county))
        pressure_rows.append(
            {
                **m,
                "pressure_score": round(min(100.0, raw), 1),
                "pressure_raw": raw,
                "economic_region_id": region.id if region else None,
                "economic_region_label": region.label if region else None,
            }
        )
    pressure_rows.sort(key=lambda r: r["pressure_raw"], reverse=True)

    watchlist: List[dict[str, Any]] = []
    for ws in linked_systems:
        open_violations = (
            db.query(SDWISViolation)
            .filter(SDWISViolation.pwsid == ws.pwsid)
            .filter((SDWISViolation.status.is_(None)) | (SDWISViolation.status != "Resolved"))
            .limit(5)
            .all()
        )
        topics = list(
            dict.fromkeys(
                _training_topic(v.rule_name, v.contaminant_name) for v in open_violations
            )
        )
        watchlist.append(
            {
                "district_code": ws.district_code,
                "pwsid": ws.pwsid,
                "pws_name": ws.pws_name,
                "population_served": ws.population_served,
                "open_violations": len(open_violations),
                "snc": ws.snc,
                "health_flag": ws.health_flag,
                "suggested_training_topics": topics[:3] or ["Operator certification renewal"],
                "dfr_url": ws.dfr_url,
            }
        )
    watchlist.sort(key=lambda w: (w["open_violations"], w["population_served"] or 0), reverse=True)

    member_pop = sum(ws.population_served or 0 for ws in linked_systems)
    last_refreshed = None
    if landscape:
        last_refreshed = max((s.last_refreshed for s in landscape if s.last_refreshed), default=None)

    return SDWISWorkforceInsightsOut(
        state_code=state_code,
        active_cws_count=len(cws),
        total_population_served=total_pop,
        health_violation_systems=health_count,
        serious_violator_count=serious,
        snc_count=snc_count,
        size_tiers=dict(size_tiers),
        grade_demand_estimate=dict(grade_demand),
        # Full county list so landscape economic-region filters are complete (not top-N only).
        compliance_pressure_by_county=pressure_rows,
        member_watchlist=watchlist[:20],
        coverage={
            "member_utilities": len(linked_systems),
            "member_population_served": member_pop,
            "state_utilities": len(cws),
            "state_population_served": total_pop,
            "coverage_pct_population": round(100.0 * member_pop / total_pop, 1) if total_pop else 0.0,
        },
        last_refreshed=last_refreshed,
    )
