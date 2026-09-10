"""BLS OEWS, Employment Projections, and Projections Central adapters."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.national_metrics import ExternalMetricSnapshot
from app.services.national.constants import ALL_SDWIS_STATE_CODES

logger = logging.getLogger(__name__)

SOC_WATER = "51-8031"
PC_URL = f"https://public.projectionscentral.org/Projections/LongTermRestJson/all/{SOC_WATER}"


def _upsert_metric(
    db: Session,
    *,
    source: str,
    scope_type: str,
    scope_code: str,
    metric_key: str,
    value: float | None,
    value_json: dict | None,
    as_of: str,
    url: str,
    note: str | None = None,
) -> None:
    existing = (
        db.query(ExternalMetricSnapshot)
        .filter(
            ExternalMetricSnapshot.source == source,
            ExternalMetricSnapshot.scope_type == scope_type,
            ExternalMetricSnapshot.scope_code == scope_code,
            ExternalMetricSnapshot.metric_key == metric_key,
            ExternalMetricSnapshot.as_of == as_of,
        )
        .first()
    )
    if existing:
        existing.value_numeric = value
        existing.value_json = value_json
        existing.fetched_at = datetime.now(timezone.utc)
        existing.provenance_url = url
    else:
        db.add(
            ExternalMetricSnapshot(
                source=source,
                scope_type=scope_type,
                scope_code=scope_code,
                metric_key=metric_key,
                value_numeric=value,
                value_json=value_json,
                as_of=as_of,
                provenance_url=url,
                license_note=note,
            )
        )


def refresh_projections_central(db: Session) -> int:
    """Fetch state-level 51-8031 projections from Projections Central REST."""
    count = 0
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(PC_URL)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("Projections Central fetch failed: %s", exc)
        return 0

    rows = data if isinstance(data, list) else data.get("data") or data.get("occupations") or []
    as_of = "2024-2034"
    for row in rows:
        if not isinstance(row, dict):
            continue
        st_fips = str(row.get("STFIPS") or row.get("stfips") or "")
        st_abbr = str(row.get("StateAbbrev") or row.get("stateAbbrev") or "").upper()[:2]
        if not st_abbr and st_fips:
            # National row often fips 0
            if st_fips in ("0", "00"):
                st_abbr = "US"
        if not st_abbr:
            continue
        scope = "us" if st_abbr == "US" else "state"
        code = "US" if st_abbr == "US" else st_abbr
        if scope == "state" and code not in ALL_SDWIS_STATE_CODES:
            continue
        try:
            openings = float(row.get("AvgAnnualOpenings") or row.get("avgAnnualOpenings") or 0)
            pct = float(row.get("PercentChange") or row.get("percentChange") or 0)
            base = float(row.get("Base") or row.get("base") or 0)
            projected = float(row.get("Projected") or row.get("projected") or 0)
        except (TypeError, ValueError):
            continue
        _upsert_metric(
            db,
            source="projections_central",
            scope_type=scope,
            scope_code=code,
            metric_key="operator_annual_openings",
            value=openings,
            value_json=None,
            as_of=as_of,
            url=PC_URL,
        )
        _upsert_metric(
            db,
            source="projections_central",
            scope_type=scope,
            scope_code=code,
            metric_key="operator_pct_change",
            value=pct,
            value_json={"base": base, "projected": projected},
            as_of=as_of,
            url=PC_URL,
        )
        count += 2

    db.commit()
    return count


def refresh_bls_national_baseline(db: Session) -> int:
    """Store known BLS national baseline (2024-34) when API key not configured."""
    as_of = "2024-2034"
    _upsert_metric(
        db,
        source="bls_oep",
        scope_type="us",
        scope_code="US",
        metric_key="operator_employment_2024",
        value=132_400,
        value_json=None,
        as_of=as_of,
        url="https://www.bls.gov/ooh/production/water-and-wastewater-treatment-plant-and-system-operators.htm",
        note="BLS Occupational Outlook Handbook",
    )
    _upsert_metric(
        db,
        source="bls_oep",
        scope_type="us",
        scope_code="US",
        metric_key="operator_employment_2034",
        value=123_800,
        value_json=None,
        as_of=as_of,
        url="https://www.bls.gov/ooh/production/water-and-wastewater-treatment-plant-and-system-operators.htm",
    )
    _upsert_metric(
        db,
        source="bls_oep",
        scope_type="us",
        scope_code="US",
        metric_key="operator_annual_openings",
        value=10_700,
        value_json=None,
        as_of=as_of,
        url="https://www.bls.gov/ooh/production/water-and-wastewater-treatment-plant-and-system-operators.htm",
    )
    db.commit()
    return 3


def refresh_labor_market(db: Session) -> dict[str, int]:
    pc = refresh_projections_central(db)
    bls = refresh_bls_national_baseline(db)
    return {"projections_central": pc, "bls_baseline": bls}
