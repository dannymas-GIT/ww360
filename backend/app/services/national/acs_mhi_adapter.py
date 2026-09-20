"""Census ACS median household income → ExternalMetricSnapshot (source=census_acs)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models.national_metrics import ExternalMetricSnapshot

logger = logging.getLogger(__name__)

PROVENANCE_URL = "https://api.census.gov/data/2023/acs/acs5/variables.html"
# Curated NY county MHI samples (ACS 5-year style) — used when live Census API unavailable.
# scope_code uses Title Case county names matching SDWIS county spellings.
CURATED_NY_COUNTY_MHI: dict[str, float] = {
    "Albany": 78_829,
    "Bronx": 47_036,
    "Broome": 58_271,
    "Erie": 66_582,
    "Kings": 74_692,
    "Monroe": 66_317,
    "Nassau": 137_582,
    "New York": 99_880,
    "Onondaga": 68_499,
    "Queens": 82_085,
    "Suffolk": 122_498,
    "Westchester": 110_359,
}
CURATED_STATE_MHI = {"NY": 81_386}
AS_OF = "2023-acs5"


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


def _try_live_census(db: Session) -> int:
    """Best-effort state-level ACS B19013_001E for NY via Census API (no key required for low volume)."""
    url = (
        "https://api.census.gov/data/2023/acs/acs5"
        "?get=NAME,B19013_001E&for=state:36"
    )
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.info("Census ACS live fetch unavailable (%s); using curated samples", exc)
        return 0

    if not isinstance(data, list) or len(data) < 2:
        return 0
    try:
        mhi = float(data[1][1])
    except (TypeError, ValueError, IndexError):
        return 0
    _upsert(
        db,
        source="census_acs",
        scope_type="state",
        scope_code="NY",
        metric_key="mhi_usd",
        value_numeric=mhi,
        value_json={"name": data[1][0], "variable": "B19013_001E"},
        as_of=AS_OF,
        provenance_url=url,
        license_note="U.S. Census Bureau ACS 5-year estimates (public domain)",
    )
    return 1


def refresh_acs_mhi(db: Session) -> int:
    """Upsert ACS median household income snapshots. Returns upsert count."""
    count = _try_live_census(db)
    for st, mhi in CURATED_STATE_MHI.items():
        # Keep curated state baseline if live did not write, or refresh alongside
        if count == 0 or st != "NY":
            _upsert(
                db,
                source="census_acs",
                scope_type="state",
                scope_code=st,
                metric_key="mhi_usd",
                value_numeric=mhi,
                value_json={"curated": True},
                as_of=AS_OF,
                provenance_url=PROVENANCE_URL,
                license_note="Curated ACS-style sample for WW360 Insights when live API unavailable",
            )
            count += 1

    for county, mhi in CURATED_NY_COUNTY_MHI.items():
        _upsert(
            db,
            source="census_acs",
            scope_type="county",
            scope_code=county,
            metric_key="mhi_usd",
            value_numeric=mhi,
            value_json={"state": "NY", "curated": True},
            as_of=AS_OF,
            provenance_url=PROVENANCE_URL,
            license_note="Curated NY county MHI samples for fundable-need overlay demos",
        )
        count += 1

    db.commit()
    return count
