"""Six Insights correlations (A.1–A.6) over SDWIS / NPDES / roster / workforce / overlays."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.national_metrics import ExternalMetricSnapshot, StateOperatorCertAggregate
from app.models.npdes_state_facility import NpdesStateFacility
from app.models.sdwis_state_system import SDWISStateSystem
from app.models.water_district import WaterDistrict
from app.models.workforce_succession import (
    WorkforceCertification,
    WorkforceEmployee,
    WorkforcePosition,
)
from app.services.jurisdiction_service import normalize_county_name
from app.services.sdwis_workforce_insights import GRADE_FROM_TIER, SIZE_TIERS, _tier_for_population

PERSONA_ALL = ("jenny", "regulator", "utility")

# NPDES plant_class → approximate NY wastewater grade demand
PLANT_CLASS_GRADE = {
    "1": {"1A": 1},
    "1A": {"1A": 1},
    "2": {"2A": 1},
    "2A": {"2A": 1},
    "3": {"3A": 1},
    "3A": {"3A": 1},
    "4": {"4A": 1},
    "4A": {"4A": 1},
}


def _flag(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).strip().upper() not in ("", "N", "NO", "FALSE", "0", "NONE")


def _county_key(raw: str | None) -> str:
    n = normalize_county_name(raw)
    return n.title() if n else "Unknown"


def _result(
    *,
    corr_id: str,
    title: str,
    persona_relevance: list[str] | tuple[str, ...],
    data_mode: str,
    summary: str,
    rows: list[dict[str, Any]] | None = None,
    counties: list[dict[str, Any]] | None = None,
    notes: list[str] | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": corr_id,
        "title": title,
        "persona_relevance": list(persona_relevance),
        "data_mode": data_mode,
        "summary": summary,
        "notes": notes or [],
    }
    if counties is not None:
        out["counties"] = counties
    if rows is not None:
        out["rows"] = rows
    return out


def _district_codes_for_state(db: Session, state_code: str) -> list[str]:
    rows = (
        db.query(WaterDistrict.district_code)
        .filter(WaterDistrict.state_code == state_code, WaterDistrict.is_active.is_(True))
        .all()
    )
    return [r[0] for r in rows if r[0]]


def _workforce_by_county(
    db: Session, state_code: str, *, today: date | None = None
) -> dict[str, dict[str, Any]]:
    """Roll workforce vacancy / retirement / cert expiry onto counties via employee home county."""
    today = today or date.today()
    horizon_5y = today + timedelta(days=365 * 5)
    cert_cutoff = today + timedelta(days=90)
    codes = _district_codes_for_state(db, state_code)

    by_county: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "county": "",
            "vacant_positions": 0,
            "retirement_eligible": 0,
            "certs_expiring_90d": 0,
            "active_employees": 0,
        }
    )
    district_to_county: dict[str, str] = {}

    emp_q = db.query(WorkforceEmployee).filter(WorkforceEmployee.is_active.is_(True))
    if codes:
        emp_q = emp_q.filter(WorkforceEmployee.district_code.in_(codes))
    employees = emp_q.limit(20000).all()

    for emp in employees:
        county = _county_key(emp.county_of_employment)
        if emp.district_code and emp.district_code not in district_to_county and county != "Unknown":
            district_to_county[emp.district_code] = county
        bucket = by_county[county]
        bucket["county"] = county
        bucket["active_employees"] += 1
        rd = emp.retirement_eligible_date or emp.planned_departure_date
        if rd and rd <= horizon_5y:
            bucket["retirement_eligible"] += 1

    pos_q = db.query(WorkforcePosition).filter(
        WorkforcePosition.is_vacant.is_(True),
        WorkforcePosition.record_status == "active",
    )
    if codes:
        pos_q = pos_q.filter(WorkforcePosition.district_code.in_(codes))
    for pos in pos_q.limit(20000).all():
        county = district_to_county.get(pos.district_code, "Unknown")
        bucket = by_county[county]
        bucket["county"] = county
        bucket["vacant_positions"] += 1

    cert_q = db.query(WorkforceCertification).filter(
        WorkforceCertification.record_status == "active",
        WorkforceCertification.expiration_date.isnot(None),
    )
    if codes:
        cert_q = cert_q.filter(WorkforceCertification.district_code.in_(codes))
    for cert in cert_q.limit(20000).all():
        if not cert.expiration_date or not (today <= cert.expiration_date <= cert_cutoff):
            continue
        county = district_to_county.get(cert.district_code, "Unknown")
        bucket = by_county[county]
        bucket["county"] = county
        bucket["certs_expiring_90d"] += 1

    return dict(by_county)


def _latest_overlay(
    db: Session, source: str, metric_key: str, scope_code: str
) -> ExternalMetricSnapshot | None:
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


def compliance_vs_coverage(db: Session, state_code: str) -> dict[str, Any]:
    """A.1 — SDWIS/NPDES SNC vs workforce vacancy / retirement / cert expiry by county."""
    st = state_code.upper()[:2]
    sdwis = db.query(SDWISStateSystem).filter(SDWISStateSystem.state_code == st).limit(50000).all()
    npdes = db.query(NpdesStateFacility).filter(NpdesStateFacility.state_code == st).limit(50000).all()
    wf = _workforce_by_county(db, st)

    counties: dict[str, dict[str, Any]] = {}

    def _bucket(name: str) -> dict[str, Any]:
        if name not in counties:
            counties[name] = {
                "county": name,
                "sdwis_snc": 0,
                "sdwis_systems": 0,
                "npdes_snc": 0,
                "npdes_facilities": 0,
                "vacant_positions": 0,
                "retirement_eligible": 0,
                "certs_expiring_90d": 0,
                "pressure_score": 0.0,
            }
        return counties[name]

    for s in sdwis:
        c = _county_key(s.county)
        b = _bucket(c)
        b["sdwis_systems"] += 1
        if _flag(s.snc) or (s.qtrs_with_snc or 0) > 0:
            b["sdwis_snc"] += 1

    for f in npdes:
        c = _county_key(f.county)
        b = _bucket(c)
        b["npdes_facilities"] += 1
        if _flag(f.snc) or (f.qtrs_with_nc or 0) > 0:
            b["npdes_snc"] += 1

    for c, metrics in wf.items():
        b = _bucket(c)
        b["vacant_positions"] = metrics["vacant_positions"]
        b["retirement_eligible"] = metrics["retirement_eligible"]
        b["certs_expiring_90d"] = metrics["certs_expiring_90d"]

    for b in counties.values():
        b["pressure_score"] = round(
            b["sdwis_snc"] * 2.0
            + b["npdes_snc"] * 2.0
            + b["vacant_positions"] * 1.5
            + b["retirement_eligible"] * 0.5
            + b["certs_expiring_90d"] * 0.75,
            2,
        )

    ranked = sorted(counties.values(), key=lambda r: (-r["pressure_score"], r["county"]))
    live_wf = any(
        r["vacant_positions"] or r["retirement_eligible"] or r["certs_expiring_90d"] for r in ranked
    )
    live_reg = any(r["sdwis_systems"] or r["npdes_facilities"] for r in ranked)
    if live_reg and live_wf:
        mode = "live"
    elif live_reg or live_wf:
        mode = "mixed"
    else:
        mode = "curated"

    top = ranked[:5]
    summary = (
        f"{len(ranked)} counties scored; top pressure: "
        + (
            ", ".join(f"{r['county']} ({r['pressure_score']})" for r in top)
            if top
            else "none"
        )
    )
    notes = []
    if not live_wf:
        notes.append(
            "Workforce vacancy/retirement/cert expiry mapped via employee county_of_employment; "
            "no workforce rows for this state yet."
        )
    return _result(
        corr_id="compliance_vs_coverage",
        title="Compliance pressure vs workforce coverage",
        persona_relevance=PERSONA_ALL,
        data_mode=mode,
        summary=summary,
        counties=ranked,
        notes=notes,
    )


def grade_demand_vs_supply(db: Session, state_code: str) -> dict[str, Any]:
    """A.2 — Plant class / SDWIS size tiers vs StateOperatorCertAggregate supply."""
    st = state_code.upper()[:2]
    sdwis = db.query(SDWISStateSystem).filter(SDWISStateSystem.state_code == st).limit(50000).all()
    npdes = db.query(NpdesStateFacility).filter(NpdesStateFacility.state_code == st).limit(50000).all()
    supply_rows = (
        db.query(
            StateOperatorCertAggregate.grade_code,
            StateOperatorCertAggregate.operator_count,
        )
        .filter(StateOperatorCertAggregate.state_code == st)
        .all()
    )

    demand: dict[str, int] = defaultdict(int)
    for s in sdwis:
        tier = _tier_for_population(s.population_served)
        for grade, n in GRADE_FROM_TIER.get(tier, {}).items():
            demand[grade] += n

    for f in npdes:
        cls = (f.plant_class or "").strip().upper()
        for grade, n in PLANT_CLASS_GRADE.get(cls, {}).items():
            demand[grade] += n
        # Size-proxy when plant_class missing: majors need higher grade
        if not cls and f.major_minor and "MAJOR" in str(f.major_minor).upper():
            demand["3A"] += 1

    supply: dict[str, int] = defaultdict(int)
    for grade, count in supply_rows:
        if grade:
            supply[str(grade).upper()] += int(count or 0)

    grades = sorted(set(demand) | set(supply))
    rows = []
    for g in grades:
        d = demand.get(g, 0)
        s = supply.get(g, 0)
        gap = d - s
        rows.append(
            {
                "grade_code": g,
                "demand_estimate": d,
                "supply_operators": s,
                "gap": gap,
                "coverage_pct": round(100.0 * s / d, 1) if d else None,
            }
        )
    rows.sort(key=lambda r: (-(r["gap"] or 0), r["grade_code"]))

    has_demand = any(r["demand_estimate"] for r in rows)
    has_supply = any(r["supply_operators"] for r in rows)
    if has_demand and has_supply:
        mode = "live"
    elif has_demand or has_supply:
        mode = "mixed"
    else:
        mode = "curated"

    gap_total = sum(max(0, r["gap"] or 0) for r in rows)
    summary = (
        f"{len(rows)} grade bands; estimated unmet demand {gap_total} seats "
        f"(size-tier + plant_class heuristics vs roster aggregates)."
    )
    notes = [
        "Drinking-water demand uses SDWIS population size tiers → NYS grade heuristic.",
        "Wastewater demand uses NPDES plant_class when present; majors without class count as 3A.",
    ]
    if not has_supply:
        notes.append("No StateOperatorCertAggregate rows for this state — supply side empty.")

    return _result(
        corr_id="grade_demand_vs_supply",
        title="Operator grade demand vs certified supply",
        persona_relevance=("jenny", "regulator", "utility"),
        data_mode=mode,
        summary=summary,
        rows=rows,
        notes=notes,
    )


def renewal_cliff(db: Session, state_code: str) -> dict[str, Any]:
    """A.3 — Certification expiration_month heatmap by county."""
    st = state_code.upper()[:2]
    now = datetime.now(timezone.utc)
    aggregates = (
        db.query(StateOperatorCertAggregate)
        .filter(StateOperatorCertAggregate.state_code == st)
        .limit(50000)
        .all()
    )

    # county -> month -> count
    heat: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    county_totals: dict[str, int] = defaultdict(int)
    cliff_12 = 0
    cliff_24 = 0

    for row in aggregates:
        county = _county_key(row.county) if row.county else "Statewide"
        month = row.expiration_month or "unknown"
        n = int(row.operator_count or 0)
        heat[county][month] += n
        county_totals[county] += n
        if row.expiration_month:
            try:
                exp_dt = datetime.strptime(row.expiration_month + "-01", "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                continue
            months = (exp_dt.year - now.year) * 12 + (exp_dt.month - now.month)
            if months <= 12:
                cliff_12 += n
            if months <= 24:
                cliff_24 += n

    counties = []
    for county, months in heat.items():
        counties.append(
            {
                "county": county,
                "operator_count": county_totals[county],
                "by_expiration_month": dict(sorted(months.items())),
            }
        )
    counties.sort(key=lambda r: (-r["operator_count"], r["county"]))

    mode = "live" if aggregates else "curated"
    summary = (
        f"{len(counties)} county cells; {cliff_12} operators renew within 12 months, "
        f"{cliff_24} within 24 months."
    )
    return _result(
        corr_id="renewal_cliff",
        title="Certification renewal cliff heatmap",
        persona_relevance=("jenny", "regulator", "utility"),
        data_mode=mode,
        summary=summary,
        counties=counties,
        rows=[
            {"window": "12mo", "operator_count": cliff_12},
            {"window": "24mo", "operator_count": cliff_24},
        ],
        notes=[] if aggregates else ["No roster aggregates — heatmap empty until NY OpCert refresh."],
    )


def retirement_horizon(db: Session, state_code: str) -> dict[str, Any]:
    """A.4 — Retirement-eligible workforce plus vacant positions (critical coverage risk)."""
    st = state_code.upper()[:2]
    today = date.today()
    horizons = {
        "12mo": today + timedelta(days=365),
        "24mo": today + timedelta(days=365 * 2),
        "60mo": today + timedelta(days=365 * 5),
    }
    codes = _district_codes_for_state(db, st)

    emp_q = db.query(WorkforceEmployee).filter(WorkforceEmployee.is_active.is_(True))
    if codes:
        emp_q = emp_q.filter(WorkforceEmployee.district_code.in_(codes))
    employees = emp_q.limit(20000).all()

    by_county: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "county": "",
            "retirement_12mo": 0,
            "retirement_24mo": 0,
            "retirement_60mo": 0,
            "vacant_positions": 0,
            "risk_score": 0.0,
        }
    )
    district_to_county: dict[str, str] = {}

    for emp in employees:
        county = _county_key(emp.county_of_employment)
        if emp.district_code and county != "Unknown":
            district_to_county[emp.district_code] = county
        rd = emp.retirement_eligible_date or emp.planned_departure_date
        if not rd:
            continue
        b = by_county[county]
        b["county"] = county
        if rd <= horizons["12mo"]:
            b["retirement_12mo"] += 1
        if rd <= horizons["24mo"]:
            b["retirement_24mo"] += 1
        if rd <= horizons["60mo"]:
            b["retirement_60mo"] += 1

    pos_q = db.query(WorkforcePosition).filter(
        WorkforcePosition.is_vacant.is_(True),
        WorkforcePosition.record_status == "active",
    )
    if codes:
        pos_q = pos_q.filter(WorkforcePosition.district_code.in_(codes))
    vacant_total = 0
    for pos in pos_q.limit(20000).all():
        vacant_total += 1
        county = district_to_county.get(pos.district_code, "Unknown")
        b = by_county[county]
        b["county"] = county
        b["vacant_positions"] += 1

    for b in by_county.values():
        b["risk_score"] = round(
            b["vacant_positions"] * 2.0
            + b["retirement_12mo"] * 1.5
            + b["retirement_24mo"] * 0.75
            + b["retirement_60mo"] * 0.25,
            2,
        )

    counties = sorted(by_county.values(), key=lambda r: (-r["risk_score"], r["county"]))
    mode = "live" if (employees or vacant_total) else "curated"
    r24 = sum(c["retirement_24mo"] for c in counties)
    summary = (
        f"{len(employees)} active employees; {r24} retirement-eligible within 24 months; "
        f"{vacant_total} vacant positions treated as critical coverage gaps."
    )
    notes = [
        "Vacant positions are treated as critical for this overlay "
        "(WorkforcePosition.is_vacant); deepen via critical_functions when needed.",
    ]
    if not codes:
        notes.append(f"No active water_districts for {st}; workforce queries unscoped.")

    return _result(
        corr_id="retirement_horizon",
        title="Retirement horizon and vacant critical positions",
        persona_relevance=("jenny", "utility", "regulator"),
        data_mode=mode,
        summary=summary,
        counties=counties,
        rows=[
            {
                "metric": "active_employees",
                "value": len(employees),
            },
            {"metric": "vacant_positions", "value": vacant_total},
            {"metric": "retirement_24mo", "value": r24},
        ],
        notes=notes,
    )


def source_water_complexity(db: Session, state_code: str) -> dict[str, Any]:
    """A.5 — Violation pressure vs system size; note missing primary_source_code."""
    st = state_code.upper()[:2]
    sdwis = db.query(SDWISStateSystem).filter(SDWISStateSystem.state_code == st).limit(50000).all()

    # primary_source_code is not on SDWISStateSystem today
    has_primary_source = False
    if sdwis and hasattr(sdwis[0], "primary_source_code"):
        has_primary_source = any(getattr(s, "primary_source_code", None) for s in sdwis)

    by_tier: dict[str, dict[str, Any]] = {
        name: {
            "size_tier": name,
            "systems": 0,
            "snc_count": 0,
            "health_flag_count": 0,
            "qtrs_with_vio_sum": 0,
            "avg_qtrs_with_vio": 0.0,
            "violation_rate_pct": 0.0,
        }
        for name, _, _ in SIZE_TIERS
    }

    for s in sdwis:
        tier = _tier_for_population(s.population_served)
        b = by_tier.setdefault(
            tier,
            {
                "size_tier": tier,
                "systems": 0,
                "snc_count": 0,
                "health_flag_count": 0,
                "qtrs_with_vio_sum": 0,
                "avg_qtrs_with_vio": 0.0,
                "violation_rate_pct": 0.0,
            },
        )
        b["systems"] += 1
        if _flag(s.snc) or (s.qtrs_with_snc or 0) > 0:
            b["snc_count"] += 1
        if _flag(s.health_flag):
            b["health_flag_count"] += 1
        b["qtrs_with_vio_sum"] += int(s.qtrs_with_vio or 0)

    rows = []
    for name, _, _ in SIZE_TIERS:
        b = by_tier[name]
        n = b["systems"] or 0
        b["avg_qtrs_with_vio"] = round(b["qtrs_with_vio_sum"] / n, 2) if n else 0.0
        b["violation_rate_pct"] = (
            round(100.0 * (b["snc_count"] + b["health_flag_count"]) / n, 1) if n else 0.0
        )
        rows.append(b)

    mode = "live" if sdwis else "curated"
    notes = []
    if not has_primary_source:
        notes.append(
            "primary_source_code is not available on sdwis_state_systems — "
            "source-water complexity is approximated via size-tier × SNC/health/qtrs_with_vio. "
            "See TODO in sdwis_bulk_ingest for PRIMACY_AGENCY / PRIMARY_SOURCE_CODE ingest."
        )

    worst = max(rows, key=lambda r: r["violation_rate_pct"]) if rows else None
    summary = (
        f"{len(sdwis)} systems across size tiers; highest violation pressure in "
        f"{worst['size_tier'] if worst else 'n/a'} "
        f"({worst['violation_rate_pct'] if worst else 0}% SNC/health rate)."
    )
    return _result(
        corr_id="source_water_complexity",
        title="Source-water complexity proxy (violation vs size)",
        persona_relevance=("regulator", "utility", "jenny"),
        data_mode=mode,
        summary=summary,
        rows=rows,
        notes=notes,
    )


def fundable_need_overlay(db: Session, state_code: str) -> dict[str, Any]:
    """A.6 — SNC + POTW major + DAC/MHI/EJ overlays when ExternalMetricSnapshot present."""
    st = state_code.upper()[:2]
    sdwis = db.query(SDWISStateSystem).filter(SDWISStateSystem.state_code == st).limit(50000).all()
    npdes = db.query(NpdesStateFacility).filter(NpdesStateFacility.state_code == st).limit(50000).all()

    counties: dict[str, dict[str, Any]] = {}

    def _bucket(name: str) -> dict[str, Any]:
        if name not in counties:
            counties[name] = {
                "county": name,
                "sdwis_snc": 0,
                "major_potw": 0,
                "potw_snc": 0,
                "is_dac": None,
                "mhi_usd": None,
                "ej_index": None,
                "fundable_score": 0.0,
            }
        return counties[name]

    for s in sdwis:
        c = _county_key(s.county)
        b = _bucket(c)
        if _flag(s.snc) or (s.qtrs_with_snc or 0) > 0:
            b["sdwis_snc"] += 1

    for f in npdes:
        c = _county_key(f.county)
        b = _bucket(c)
        is_potw = not f.facility_type_code or str(f.facility_type_code).upper() == "POTW"
        is_major = bool(f.major_minor and "MAJOR" in str(f.major_minor).upper())
        if is_potw and is_major:
            b["major_potw"] += 1
        if is_potw and (_flag(f.snc) or (f.qtrs_with_nc or 0) > 0):
            b["potw_snc"] += 1

    overlay_hits = 0
    for c, b in list(counties.items()):
        scope = c  # county name as scope_code when adapters use county names
        # Also try FIPS-less county slug variants
        candidates = [scope, scope.upper(), f"{st}-{scope}", f"{st}:{scope}"]
        dac = mhi = ej = None
        for sc in candidates:
            dac = dac or _latest_overlay(db, "ny_dac", "is_dac", sc)
            mhi = mhi or _latest_overlay(db, "census_acs", "mhi_usd", sc)
            ej = ej or _latest_overlay(db, "epa_ejscreen", "ej_index", sc)

        if dac:
            overlay_hits += 1
            if dac.value_numeric is not None:
                b["is_dac"] = bool(dac.value_numeric)
            elif isinstance(dac.value_json, dict):
                b["is_dac"] = bool(dac.value_json.get("is_dac"))
        if mhi and mhi.value_numeric is not None:
            overlay_hits += 1
            b["mhi_usd"] = mhi.value_numeric
        if ej and ej.value_numeric is not None:
            overlay_hits += 1
            b["ej_index"] = ej.value_numeric

        score = b["sdwis_snc"] * 2.0 + b["major_potw"] * 1.5 + b["potw_snc"] * 2.0
        if b["is_dac"] is True:
            score += 3.0
        if b["mhi_usd"] is not None and b["mhi_usd"] < 70000:
            score += 1.5
        if b["ej_index"] is not None and b["ej_index"] >= 80:
            score += 2.0
        b["fundable_score"] = round(score, 2)

    ranked = sorted(counties.values(), key=lambda r: (-r["fundable_score"], r["county"]))
    live_reg = bool(sdwis or npdes)
    if live_reg and overlay_hits:
        mode = "mixed"
    elif live_reg:
        mode = "live"
    elif overlay_hits:
        mode = "curated"
    else:
        mode = "curated"

    notes = []
    if not overlay_hits:
        notes.append(
            "No DAC/MHI/EJ ExternalMetricSnapshot rows matched — call POST /insights/refresh-overlays."
        )
    summary = (
        f"{len(ranked)} counties; top fundable need: "
        + (
            ", ".join(f"{r['county']} ({r['fundable_score']})" for r in ranked[:5])
            if ranked
            else "none"
        )
    )
    return _result(
        corr_id="fundable_need_overlay",
        title="Fundable need overlay (SNC + major POTW + DAC/MHI/EJ)",
        persona_relevance=("jenny", "regulator", "utility"),
        data_mode=mode,
        summary=summary,
        counties=ranked,
        notes=notes,
    )


CORRELATION_BUILDERS = {
    "compliance_vs_coverage": compliance_vs_coverage,
    "grade_demand_vs_supply": grade_demand_vs_supply,
    "renewal_cliff": renewal_cliff,
    "retirement_horizon": retirement_horizon,
    "source_water_complexity": source_water_complexity,
    "fundable_need_overlay": fundable_need_overlay,
}
