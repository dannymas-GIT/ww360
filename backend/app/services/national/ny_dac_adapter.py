"""NYS Disadvantaged Community (DAC) flags → ExternalMetricSnapshot (source=ny_dac)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.national_metrics import ExternalMetricSnapshot

logger = logging.getLogger(__name__)

PROVENANCE_URL = "https://climate.ny.gov/resources/disadvantaged-communities-criteria/"
AS_OF = "2023-dac"

# Curated sample: representative NY counties marked DAC / non-DAC for Insights demos.
# Real production refresh should pull from NYSERDA / DEC DAC GIS layers.
CURATED_NY_DAC: dict[str, bool] = {
    "Bronx": True,
    "Kings": True,
    "Queens": True,
    "Erie": True,
    "Monroe": True,
    "Onondaga": True,
    "Albany": False,
    "Nassau": False,
    "Suffolk": False,
    "Westchester": False,
    "Broome": True,
    "New York": False,
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


def refresh_ny_dac(db: Session) -> int:
    """Upsert NY DAC county flags. Returns upsert count."""
    count = 0
    for county, is_dac in CURATED_NY_DAC.items():
        _upsert(
            db,
            source="ny_dac",
            scope_type="county",
            scope_code=county,
            metric_key="is_dac",
            value_numeric=1.0 if is_dac else 0.0,
            value_json={"is_dac": is_dac, "curated": True},
            as_of=AS_OF,
            provenance_url=PROVENANCE_URL,
            license_note="Curated sample from NYS Disadvantaged Communities criteria (demo overlay)",
        )
        count += 1
    db.commit()
    logger.info("ny_dac adapter upserted %s county rows", count)
    return count
