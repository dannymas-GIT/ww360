"""Optional NY SPDES enricher — sets plant_class on NpdesStateFacility when available.

Pulls the NYSDEC SPDES multi-sector dataset from data.ny.gov (Socrata) and matches
on NPDES/SPDES permit ID. Failures are logged and skipped so bulk ingest still succeeds.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from sqlalchemy.orm import Session

from app.models.npdes_state_facility import NpdesStateFacility

logger = logging.getLogger(__name__)

# NYSDEC SPDES permits (multi-sector) — Socrata resource on data.ny.gov.
# Dataset id historically published as 2v6p-juki; if retired, enrich becomes a no-op.
NY_SPDES_SOCRATA_URL = "https://data.ny.gov/resource/2v6p-juki.json"

_CLASS_RE = re.compile(
    r"\b(?:class(?:ification)?\s*)?([1-4]A?)\b",
    re.IGNORECASE,
)


def _extract_plant_class(row: dict[str, Any]) -> str | None:
    for key in (
        "plant_class",
        "plant_classification",
        "spd_class",
        "facility_class",
        "class",
        "classification",
        "permit_class",
    ):
        raw = row.get(key)
        if raw is None or raw == "":
            continue
        text = str(raw).strip().upper()
        if re.fullmatch(r"[1-4]A?", text):
            return text
        m = _CLASS_RE.search(text)
        if m:
            return m.group(1).upper()
    # Fall back to scanning any string field
    for val in row.values():
        if not isinstance(val, str):
            continue
        m = _CLASS_RE.search(val)
        if m and "CLASS" in val.upper():
            return m.group(1).upper()
    return None


def _permit_id(row: dict[str, Any]) -> str | None:
    for key in (
        "npdes_id",
        "npdesid",
        "spdes_id",
        "spdes_permit_number",
        "permit_id",
        "permit_number",
        "spd_id",
        "external_permit_nmbr",
    ):
        val = row.get(key)
        if val:
            return str(val).strip().upper()
    return None


def enrich_ny_plant_class(db: Session, *, limit: int = 50000) -> int:
    """Update plant_class for NY rows when SPDES open data provides a classification.

    Returns the number of rows updated. Returns 0 on any fetch/parse failure.
    """
    try:
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            resp = client.get(
                NY_SPDES_SOCRATA_URL,
                params={"$limit": str(limit)},
            )
            resp.raise_for_status()
            rows = resp.json()
    except Exception as exc:
        logger.info("NY SPDES enrich skipped (dataset unavailable): %s", exc)
        return 0

    if not isinstance(rows, list) or not rows:
        logger.info("NY SPDES enrich skipped (empty response)")
        return 0

    class_by_id: dict[str, str] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        pid = _permit_id(row)
        plant_class = _extract_plant_class(row)
        if pid and plant_class:
            class_by_id[pid] = plant_class

    if not class_by_id:
        logger.info("NY SPDES enrich: no plant_class fields found in dataset")
        return 0

    updated = 0
    ny_rows = (
        db.query(NpdesStateFacility)
        .filter(NpdesStateFacility.state_code == "NY")
        .all()
    )
    for fac in ny_rows:
        plant_class = class_by_id.get(fac.npdes_id.upper() if fac.npdes_id else "")
        if plant_class and fac.plant_class != plant_class:
            fac.plant_class = plant_class
            updated += 1
    if updated:
        db.commit()
    logger.info("NY SPDES enrich: updated plant_class on %d facilities", updated)
    return updated
