"""Ingest EPA ECHO SDWA bulk CSV into sdwis_state_systems."""

from __future__ import annotations

import csv
import io
import logging
import zipfile
from datetime import datetime
from typing import Any

import httpx

from sqlalchemy.orm import Session

from app.models.sdwis_state_system import SDWISStateSystem
from app.services.national.constants import ALL_SDWIS_STATE_CODES, ECHO_SDWA_BULK_URL
from app.services.sdwis_state_refresh_service import refresh_state_landscape

logger = logging.getLogger(__name__)

BULK_SYSTEMS_FILE = "SDWA_PUB_WATER_SYSTEMS.csv"


def _parse_int(val: Any) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(float(str(val).replace(",", "")))
    except (TypeError, ValueError):
        return None


def _row_to_system(state_code: str, row: dict[str, str], now: datetime) -> SDWISStateSystem | None:
    pid = (row.get("PWSID") or row.get("PWSId") or row.get("PWS_ID") or "").strip().upper()
    if not pid:
        return None
    activity = (row.get("ACTIVITY") or row.get("Activity") or row.get("PWSActivity") or "A").upper()
    if activity and activity not in ("A", "ACTIVE", "I"):
        if activity.startswith("I"):
            return None
    county = (row.get("COUNTY_SERVED") or row.get("CountiesServed") or row.get("COUNTY") or "")
    county = county.split(",")[0].strip() if county else None
    return SDWISStateSystem(
        state_code=state_code,
        pwsid=pid,
        pws_name=row.get("PWS_NAME") or row.get("PWSName"),
        county=county,
        pws_type=row.get("PWS_TYPE_CODE") or row.get("PWSTypeCode"),
        owner_type=row.get("OWNER_TYPE") or row.get("OwnerDesc"),
        population_served=_parse_int(row.get("POPULATION_SERVED") or row.get("PopulationServedCount")),
        serious_violator=row.get("SERIOUS_VIOLATOR") or row.get("SeriousViolator"),
        health_flag=row.get("HEALTH_FLAG") or row.get("HealthFlag"),
        snc=row.get("SNC") or row.get("SNCFlag"),
        qtrs_with_vio=_parse_int(row.get("QTRS_WITH_VIO") or row.get("QtrsWithVio")),
        qtrs_with_snc=_parse_int(row.get("QTRS_WITH_SNC") or row.get("QtrsWithSNC")),
        last_refreshed=now,
    )


def refresh_from_bulk_download(db: Session) -> dict[str, int]:
    """Download ECHO SDWA bulk zip and refresh all states found in CSV."""
    now = datetime.utcnow()
    results: dict[str, int] = {}
    try:
        with httpx.Client(timeout=120.0, follow_redirects=True) as client:
            resp = client.get(ECHO_SDWA_BULK_URL)
            resp.raise_for_status()
            zdata = resp.content
    except Exception as exc:
        logger.warning("SDWA bulk download failed, falling back to per-state API: %s", exc)
        return _fallback_per_state(db)

    try:
        with zipfile.ZipFile(io.BytesIO(zdata)) as zf:
            csv_name = next((n for n in zf.namelist() if n.endswith(BULK_SYSTEMS_FILE)), None)
            if not csv_name:
                csv_name = next((n for n in zf.namelist() if "PUB_WATER" in n.upper() and n.endswith(".csv")), None)
            if not csv_name:
                logger.warning("Bulk zip missing systems CSV; falling back")
                return _fallback_per_state(db)

            raw = zf.read(csv_name).decode("utf-8", errors="replace")
    except Exception as exc:
        logger.warning("Bulk zip parse failed: %s", exc)
        return _fallback_per_state(db)

    reader = csv.DictReader(io.StringIO(raw))
    by_state: dict[str, list[SDWISStateSystem]] = {st: [] for st in ALL_SDWIS_STATE_CODES}

    for row in reader:
        st = (row.get("STATE_CODE") or row.get("State") or row.get("PWS_STATE_CODE") or "").upper()[:2]
        if not st or st not in by_state:
            continue
        sys_row = _row_to_system(st, row, now)
        if sys_row:
            by_state[st].append(sys_row)

    for st, rows in by_state.items():
        if not rows:
            continue
        db.query(SDWISStateSystem).filter(SDWISStateSystem.state_code == st).delete(
            synchronize_session=False
        )
        for r in rows:
            db.add(r)
        db.commit()
        results[st] = len(rows)
        logger.info("SDWA bulk refresh: %s = %d systems", st, len(rows))

    return results


def _fallback_per_state(db: Session) -> dict[str, int]:
    results = {}
    for st in ALL_SDWIS_STATE_CODES:
        try:
            results[st] = refresh_state_landscape(db, st)
        except Exception as exc:
            logger.warning("Per-state refresh failed for %s: %s", st, exc)
    return results


def refresh_all_states(db: Session) -> dict[str, int]:
    return refresh_from_bulk_download(db)
