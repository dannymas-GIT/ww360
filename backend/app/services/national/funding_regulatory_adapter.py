"""DWSRF allotments, Grants.gov, USAspending, LCRR, UCMR curated metrics."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import yaml
from sqlalchemy.orm import Session

from app.models.national_metrics import ExternalMetricSnapshot

logger = logging.getLogger(__name__)

DWSRF_YAML = Path(__file__).resolve().parents[2] / "national" / "dwsrf_allotments.yaml"
GRANTS_URL = "https://api.grants.gov/v1/api/search2"
USASPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"


def _upsert(db: Session, **kwargs: Any) -> None:
    existing = (
        db.query(ExternalMetricSnapshot)
        .filter(
            ExternalMetricSnapshot.source == kwargs["source"],
            ExternalMetricSnapshot.scope_type == kwargs["scope_type"],
            ExternalMetricSnapshot.scope_code == kwargs["scope_code"],
            ExternalMetricSnapshot.metric_key == kwargs["metric_key"],
            ExternalMetricSnapshot.as_of == kwargs["as_of"],
        )
        .first()
    )
    if existing:
        for k, v in kwargs.items():
            setattr(existing, k, v)
        existing.fetched_at = datetime.now(timezone.utc)
    else:
        db.add(ExternalMetricSnapshot(**kwargs))


def refresh_dwsrf_allotments(db: Session) -> int:
    if not DWSRF_YAML.exists():
        logger.warning("DWSRF allotments YAML missing at %s", DWSRF_YAML)
        return 0
    data = yaml.safe_load(DWSRF_YAML.read_text()) or {}
    as_of = str(data.get("fiscal_year") or "FY2026")
    states = data.get("states") or {}
    count = 0
    for st, info in states.items():
        if not isinstance(info, dict):
            continue
        total = float(info.get("dwsrf_total") or 0)
        _upsert(
            db,
            source="epa_dwsrf",
            scope_type="state",
            scope_code=st.upper()[:2],
            metric_key="dwsrf_allotment_usd",
            value_numeric=total,
            value_json=info,
            as_of=as_of,
            provenance_url="https://www.epa.gov/dwsrf/fy-2026-allotments-tables",
            license_note="EPA public allotment tables",
        )
        count += 1
    db.commit()
    return count


def refresh_grants_pipeline(db: Session) -> int:
    """Count active water workforce grant opportunities from Grants.gov."""
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                GRANTS_URL,
                json={"keyword": "water workforce", "rows": 25},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("Grants.gov fetch failed: %s", exc)
        return 0

    hits = data.get("data") or data.get("oppHits") or []
    count = len(hits) if isinstance(hits, list) else 0
    as_of = datetime.now(timezone.utc).strftime("%Y-%m")
    _upsert(
        db,
        source="grants_gov",
        scope_type="us",
        scope_code="US",
        metric_key="workforce_grant_opportunities",
        value_numeric=float(count),
        value_json={"sample_titles": [h.get("title") for h in hits[:5] if isinstance(h, dict)]},
        as_of=as_of,
        provenance_url=GRANTS_URL,
    )
    db.commit()
    return 1


def refresh_regulatory_workload(db: Session) -> int:
    """Curated national LCRR / PFAS workload placeholders from EPA public summaries."""
    as_of = "2026-09"
    _upsert(
        db,
        source="epa_lcri",
        scope_type="us",
        scope_code="US",
        metric_key="estimated_lead_service_lines",
        value_numeric=4_000_000,
        value_json={"confirmed_lead": 3_000_000, "estimated_unknown": 1_000_000},
        as_of=as_of,
        provenance_url="https://ordspub.epa.gov/ords/sfdw/r/sfdw/sdwis_fed_reports_public/service-line-inventory",
        license_note="EPA LCRR service line inventory dashboard",
    )
    _upsert(
        db,
        source="epa_ucmr5",
        scope_type="us",
        scope_code="US",
        metric_key="ucmr5_systems_with_detections",
        value_numeric=10_299,
        value_json={"analytes": 29},
        as_of=as_of,
        provenance_url="https://www.epa.gov/dwanalyticalmethods/ucmr5",
    )
    db.commit()
    return 2


def refresh_funding_regulatory(db: Session) -> dict[str, int]:
    return {
        "dwsrf": refresh_dwsrf_allotments(db),
        "grants": refresh_grants_pipeline(db),
        "regulatory": refresh_regulatory_workload(db),
    }
