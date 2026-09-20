"""EPA EJScreen index → ExternalMetricSnapshot (source=epa_ejscreen)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.national_metrics import ExternalMetricSnapshot

logger = logging.getLogger(__name__)

PROVENANCE_URL = "https://www.epa.gov/ejscreen"
AS_OF = "2024-ejscreen"

# Curated EJ index percentiles (0–100) for sample NY counties.
CURATED_NY_EJ: dict[str, float] = {
    "Bronx": 95.0,
    "Kings": 88.0,
    "Queens": 82.0,
    "New York": 70.0,
    "Erie": 78.0,
    "Monroe": 74.0,
    "Onondaga": 71.0,
    "Albany": 55.0,
    "Broome": 62.0,
    "Nassau": 40.0,
    "Suffolk": 38.0,
    "Westchester": 42.0,
}


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


def refresh_ejscreen(db: Session) -> int:
    """Upsert EJScreen index snapshots. Returns upsert count."""
    count = 0
    for county, idx in CURATED_NY_EJ.items():
        _upsert(
            db,
            source="epa_ejscreen",
            scope_type="county",
            scope_code=county,
            metric_key="ej_index",
            value_numeric=idx,
            value_json={"percentile": idx, "curated": True},
            as_of=AS_OF,
            provenance_url=PROVENANCE_URL,
            license_note="Curated EJScreen-style percentile samples for WW360 Insights demos",
        )
        count += 1
    db.commit()
    logger.info("ejscreen adapter upserted %s county rows", count)
    return count
