"""State-level workforce metrics: roster, continuity roll-up, regional breakdown."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.national_metrics import StateOperatorCertAggregate
from app.models.water_district import WaterDistrict
from app.models.workforce_organization import OrganizationDistrictMembership
from app.services.jurisdiction_service import load_pack
from app.services.national.national_overview_service import build_state_scorecard
from app.services.workforce_succession.analytics import compute_continuity_response


def build_state_workforce(db: Session, state_code: str) -> dict[str, Any]:
    st = state_code.upper()[:2]
    scorecard = build_state_scorecard(db, st)
    roster = _roster_summary(db, st)
    continuity = _continuity_rollup(db, st)
    regions = _roster_by_region(db, st)
    return {
        "state_code": st,
        "scorecard": scorecard,
        "roster": roster,
        "continuity_rollup": continuity,
        "operators_by_region": regions,
    }


def _roster_summary(db: Session, state_code: str) -> dict[str, Any]:
    total = (
        db.query(func.coalesce(func.sum(StateOperatorCertAggregate.operator_count), 0))
        .filter(StateOperatorCertAggregate.state_code == state_code)
        .scalar()
    )
    by_grade = (
        db.query(
            StateOperatorCertAggregate.grade_code,
            func.sum(StateOperatorCertAggregate.operator_count),
        )
        .filter(StateOperatorCertAggregate.state_code == state_code)
        .group_by(StateOperatorCertAggregate.grade_code)
        .all()
    )
    now = datetime.now(timezone.utc)
    cliff_12 = 0
    cliff_24 = 0
    for exp_month, count in (
        db.query(
            StateOperatorCertAggregate.expiration_month,
            func.sum(StateOperatorCertAggregate.operator_count),
        )
        .filter(StateOperatorCertAggregate.state_code == state_code)
        .group_by(StateOperatorCertAggregate.expiration_month)
        .all()
    ):
        if not exp_month:
            continue
        try:
            exp_dt = datetime.strptime(exp_month + "-01", "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        months = (exp_dt.year - now.year) * 12 + (exp_dt.month - now.month)
        c = int(count or 0)
        if months <= 12:
            cliff_12 += c
        if months <= 24:
            cliff_24 += c

    return {
        "total_operators": int(total or 0),
        "by_grade": {g: int(c) for g, c in by_grade},
        "renewal_cliff_12mo": cliff_12,
        "renewal_cliff_24mo": cliff_24,
        "roster_published": bool(total),
    }


def _continuity_rollup(db: Session, state_code: str) -> dict[str, Any]:
    districts = (
        db.query(WaterDistrict.district_code)
        .filter(WaterDistrict.state_code == state_code, WaterDistrict.is_active.is_(True))
        .all()
    )
    codes = [d[0] for d in districts]
    if not codes:
        return {"district_count": 0, "districts": []}

    rows = []
    totals = {
        "readiness_sum": 0.0,
        "coverage_sum": 0.0,
        "cert_cliff_90d": 0,
        "retirement_24mo": 0,
    }
    for code in codes:
        try:
            score = compute_continuity_response(db, code)
        except Exception:
            continue
        sc = score.get("scorecard") or {}
        rows.append(
            {
                "district_code": code,
                "readiness_score": sc.get("readiness_score"),
                "coverage_pct": sc.get("coverage_pct"),
                "cert_cliff_90d": sc.get("cert_cliff_90d"),
                "employees_retirement_eligible_24mo": sc.get("employees_retirement_eligible_24mo"),
            }
        )
        totals["readiness_sum"] += float(sc.get("readiness_score") or 0)
        totals["coverage_sum"] += float(sc.get("coverage_pct") or 0)
        totals["cert_cliff_90d"] += int(sc.get("cert_cliff_90d") or 0)
        totals["retirement_24mo"] += int(sc.get("employees_retirement_eligible_24mo") or 0)

    n = len(rows) or 1
    return {
        "district_count": len(rows),
        "districts": rows,
        "averages": {
            "readiness_score": round(totals["readiness_sum"] / n, 1),
            "coverage_pct": round(totals["coverage_sum"] / n, 1),
        },
        "totals": {
            "cert_cliff_90d": totals["cert_cliff_90d"],
            "retirement_eligible_24mo": totals["retirement_24mo"],
        },
    }


def _roster_by_region(db: Session, state_code: str) -> list[dict[str, Any]]:
    try:
        pack = load_pack(state_code)
        regions = pack.economic_regions
    except Exception:
        return []

    county_rows = (
        db.query(
            StateOperatorCertAggregate.county,
            StateOperatorCertAggregate.grade_code,
            func.sum(StateOperatorCertAggregate.operator_count),
        )
        .filter(StateOperatorCertAggregate.state_code == state_code)
        .group_by(StateOperatorCertAggregate.county, StateOperatorCertAggregate.grade_code)
        .all()
    )
    if not county_rows:
        return []

    from app.services.jurisdiction_service import region_for_county

    by_region: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for county, grade, count in county_rows:
        region = region_for_county(state_code, county)
        region_id = region.id if region else "unmapped"
        by_region[region_id][grade] += int(count or 0)

    # Prefer pack region order; append unmapped last.
    ordered_ids = [r.id for r in regions] + (
        ["unmapped"] if "unmapped" in by_region else []
    )
    return [
        {
            "region_id": rid,
            "by_grade": dict(by_region[rid]),
            "total": sum(by_region[rid].values()),
        }
        for rid in ordered_ids
        if rid in by_region
    ]
