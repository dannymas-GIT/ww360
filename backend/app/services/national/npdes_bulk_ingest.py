"""Ingest EPA ECHO ICIS-NPDES bulk CSV into npdes_state_facilities."""

from __future__ import annotations

import csv
import io
import logging
import zipfile
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.models.npdes_state_facility import NpdesStateFacility
from app.services.national.constants import ALL_SDWIS_STATE_CODES, ECHO_NPDES_BULK_URL
from app.services.npdes_client import NPDESClient, NPDESClientError

logger = logging.getLogger(__name__)

_FACILITY_NAME_HINTS = ("ICIS_FACILITIES", "NPDES_FACILITIES", "FACILITIES")
_PERMIT_NAME_HINTS = ("ICIS_PERMITS", "NPDES_PERMITS", "PERMITS")


def _parse_float(val: Any) -> float | None:
    if val is None or val == "":
        return None
    try:
        return float(str(val).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _parse_int(val: Any) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(float(str(val).replace(",", "")))
    except (TypeError, ValueError):
        return None


def _pick(row: dict[str, str], *keys: str) -> str:
    for k in keys:
        if k in row and row[k] not in (None, ""):
            return str(row[k]).strip()
    lower = {k.lower(): v for k, v in row.items()}
    for k in keys:
        v = lower.get(k.lower())
        if v not in (None, ""):
            return str(v).strip()
    return ""


def _find_csv(zf: zipfile.ZipFile, hints: tuple[str, ...]) -> str | None:
    for hint in hints:
        for name in zf.namelist():
            base = name.rsplit("/", 1)[-1].upper()
            if hint in base and base.endswith(".CSV"):
                return name
    return None


def _is_active_individual(row: dict[str, str]) -> bool:
    status = _pick(row, "PERMIT_STATUS_CODE", "FACILITY_STATUS", "STATUS").upper()
    if status and status not in ("EFFECTIVE", "ACTIVE", "ISSUED", "E", "A"):
        if status.startswith("T") or status in ("EXPIRED", "TERMINATED", "RETIRED"):
            return False
    ptype = _pick(row, "PERMIT_TYPE_CODE", "PERMIT_TYPE").upper()
    if ptype in ("GEN", "GENERAL", "GP"):
        return False
    return True


def _is_potwish(facility_row: dict[str, str], permit_row: dict[str, str]) -> bool:
    sic = _pick(facility_row, "SIC_CODE", "PRIMARY_SIC_CODE", "SIC") or _pick(
        permit_row, "SIC_CODE", "PRIMARY_SIC_CODE", "SIC"
    )
    if sic.startswith("4952") or sic == "4952":
        return True
    fac_type = _pick(
        facility_row,
        "FACILITY_TYPE_INDICATOR",
        "FACILITY_TYPE_CODE",
        "FAC_TYPE",
        "POTW_INDICATOR",
    ).upper()
    if fac_type in ("POTW", "Y", "YES", "PUBLICLY OWNED TREATMENT WORKS"):
        return True
    name = _pick(facility_row, "FACILITY_NAME", "FAC_NAME", "NAME").upper()
    if any(tok in name for tok in ("WWTP", "WASTEWATER", "SEWAGE", "POTW", "WATER POLLUTION")):
        return True
    return False


def _merge_row(
    state_code: str,
    facility: dict[str, str],
    permit: dict[str, str],
    now: datetime,
) -> NpdesStateFacility | None:
    npdes_id = (
        _pick(
            permit,
            "EXTERNAL_PERMIT_NMBR",
            "NPDES_ID",
            "NPDESID",
            "PERMIT_ID",
            "SOURCE_ID",
        ).upper()
        or _pick(facility, "NPDES_ID", "NPDESID", "EXTERNAL_PERMIT_NMBR").upper()
    )
    if not npdes_id or len(npdes_id) < 5:
        return None
    if not _is_active_individual(permit):
        return None
    if not _is_potwish(facility, permit):
        return None

    fac_type = _pick(
        facility, "FACILITY_TYPE_INDICATOR", "FACILITY_TYPE_CODE", "POTW_INDICATOR"
    ).upper()
    if fac_type in ("Y", "YES"):
        fac_type = "POTW"
    elif not fac_type:
        fac_type = "POTW"

    major = _pick(permit, "MAJOR_MINOR_STATUS_FLAG", "MAJOR_MINOR", "MAJOR").upper()
    if major in ("Y", "MAJOR", "M"):
        major = "MAJOR"
    elif major in ("N", "MINOR"):
        major = "MINOR"

    return NpdesStateFacility(
        state_code=state_code,
        npdes_id=npdes_id,
        facility_name=_pick(facility, "FACILITY_NAME", "FAC_NAME", "NAME")
        or _pick(permit, "FACILITY_NAME")
        or None,
        county=_pick(facility, "FACILITY_COUNTY", "COUNTY_NAME", "COUNTY") or None,
        facility_type_code=fac_type or "POTW",
        permit_type=_pick(permit, "PERMIT_TYPE_CODE", "PERMIT_TYPE") or None,
        major_minor=major or None,
        sic_code=_pick(facility, "SIC_CODE", "PRIMARY_SIC_CODE", "SIC")
        or _pick(permit, "SIC_CODE")
        or None,
        design_flow_mgd=_parse_float(
            _pick(permit, "DESIGN_FLOW_NMBR", "DESIGN_FLOW", "FACILITY_DESIGN_FLOW")
            or _pick(facility, "DESIGN_FLOW_NMBR", "DESIGN_FLOW")
        ),
        total_design_flow=_parse_float(
            _pick(permit, "TOTAL_DESIGN_FLOW_NMBR", "TOTAL_DESIGN_FLOW")
        ),
        permit_effective=_pick(permit, "PERMIT_EFFECTIVE_DATE", "EFFECTIVE_DATE") or None,
        permit_expiration=_pick(permit, "PERMIT_EXPIRATION_DATE", "EXPIRATION_DATE") or None,
        snc=_pick(permit, "CURRENT_SNC", "SNC_FLAG", "SNC") or None,
        qtrs_with_nc=_parse_int(_pick(permit, "QTRS_WITH_NC", "QTRS_WITH_NONCOMPLIANCE")),
        owner_type=_pick(facility, "OWNER_TYPE_CODE", "OWNER_TYPE") or None,
        plant_class=None,
        last_refreshed=now,
    )


def refresh_from_bulk_download(db: Session) -> dict[str, int]:
    """Download ECHO NPDES zip, join facilities+permits, refresh POTW rows per state."""
    now = datetime.utcnow()
    results: dict[str, int] = {}
    try:
        with httpx.Client(timeout=180.0, follow_redirects=True) as client:
            resp = client.get(ECHO_NPDES_BULK_URL)
            resp.raise_for_status()
            zdata = resp.content
    except Exception as exc:
        logger.warning("NPDES bulk download failed, falling back to per-state API: %s", exc)
        return _fallback_per_state(db)

    try:
        with zipfile.ZipFile(io.BytesIO(zdata)) as zf:
            fac_name = _find_csv(zf, _FACILITY_NAME_HINTS)
            perm_name = _find_csv(zf, _PERMIT_NAME_HINTS)
            if not fac_name or not perm_name:
                logger.warning(
                    "NPDES zip missing facilities/permits CSV (fac=%s perm=%s); falling back",
                    fac_name,
                    perm_name,
                )
                return _fallback_per_state(db)
            fac_raw = zf.read(fac_name).decode("utf-8", errors="replace")
            perm_raw = zf.read(perm_name).decode("utf-8", errors="replace")
    except Exception as exc:
        logger.warning("NPDES zip parse failed: %s", exc)
        return _fallback_per_state(db)

    facilities_by_key: dict[str, dict[str, str]] = {}
    for row in csv.DictReader(io.StringIO(fac_raw)):
        key = _pick(
            row,
            "NPDES_ID",
            "NPDESID",
            "EXTERNAL_PERMIT_NMBR",
            "ICIS_FACILITY_INTEREST_ID",
            "FACILITY_UIN",
        ).upper()
        if not key:
            st = _pick(row, "STATE_CODE", "FACILITY_STATE", "STATE").upper()[:2]
            name = _pick(row, "FACILITY_NAME", "FAC_NAME")
            if st and name:
                key = f"{st}:{name.upper()}"
            else:
                continue
        facilities_by_key[key] = row
        interest = _pick(row, "ICIS_FACILITY_INTEREST_ID", "FACILITY_UIN")
        if interest:
            facilities_by_key[interest.upper()] = row

    by_state: dict[str, list[NpdesStateFacility]] = {
        st: [] for st in ALL_SDWIS_STATE_CODES
    }
    seen_ids: dict[str, set[str]] = {st: set() for st in ALL_SDWIS_STATE_CODES}

    for perm in csv.DictReader(io.StringIO(perm_raw)):
        npdes_id = _pick(
            perm, "EXTERNAL_PERMIT_NMBR", "NPDES_ID", "NPDESID", "PERMIT_ID"
        ).upper()
        interest = _pick(perm, "ICIS_FACILITY_INTEREST_ID", "FACILITY_UIN")
        fac = (
            facilities_by_key.get(npdes_id)
            or facilities_by_key.get(interest.upper() if interest else "")
            or {}
        )
        st = (
            _pick(perm, "STATE_CODE", "FACILITY_STATE", "PERMIT_STATE", "STATE")
            or _pick(fac, "STATE_CODE", "FACILITY_STATE", "STATE")
            or (npdes_id[:2] if len(npdes_id) >= 2 else "")
        ).upper()[:2]
        if not st or st not in by_state:
            continue
        row = _merge_row(st, fac, perm, now)
        if not row or row.npdes_id in seen_ids[st]:
            continue
        seen_ids[st].add(row.npdes_id)
        by_state[st].append(row)

    for st, rows in by_state.items():
        if not rows:
            continue
        db.query(NpdesStateFacility).filter(NpdesStateFacility.state_code == st).delete(
            synchronize_session=False
        )
        for r in rows:
            db.add(r)
        db.commit()
        results[st] = len(rows)
        logger.info("NPDES bulk refresh: %s = %d POTW facilities", st, len(rows))

    try:
        from app.services.national.ny_spdes_enrich import enrich_ny_plant_class

        enrich_ny_plant_class(db)
    except Exception as exc:
        logger.info("NY SPDES enrich after bulk skipped: %s", exc)

    return results


def _row_from_api(state: str, raw: dict[str, Any], now: datetime) -> NpdesStateFacility | None:
    npdes_id = str(
        raw.get("SourceID")
        or raw.get("NPDESId")
        or raw.get("NPDESID")
        or raw.get("CWAPermitID")
        or ""
    ).strip().upper()
    if not npdes_id:
        return None
    major = str(raw.get("MajorMinorStatusFlag") or raw.get("MajorStatus") or "").upper()
    if major in ("Y", "MAJOR", "M"):
        major = "MAJOR"
    elif major in ("N", "MINOR"):
        major = "MINOR"
    return NpdesStateFacility(
        state_code=state.upper()[:2],
        npdes_id=npdes_id,
        facility_name=raw.get("FacilityName") or raw.get("CWPName"),
        county=raw.get("CountyName") or raw.get("CWPCounty"),
        facility_type_code="POTW",
        permit_type=raw.get("PermitType") or raw.get("CWPPermitType"),
        major_minor=major or None,
        sic_code=str(raw.get("SicCode") or raw.get("CWPSICCodes") or "") or None,
        design_flow_mgd=_parse_float(raw.get("DesignFlow") or raw.get("CWPDesignFlow")),
        total_design_flow=None,
        permit_effective=None,
        permit_expiration=raw.get("PermitExpirationDate") or raw.get("CWPExpirationDate"),
        snc=raw.get("CurrentSncFlag") or raw.get("CWPSNC"),
        qtrs_with_nc=_parse_int(raw.get("QtrsWithNc") or raw.get("CWPQtrsWithNC")),
        owner_type=raw.get("OwnerType"),
        plant_class=None,
        last_refreshed=now,
    )


def refresh_state_landscape(db: Session, state: str) -> int:
    """Refresh one state's POTW cache via ECHO CWA REST."""
    now = datetime.utcnow()
    state = state.upper()[:2]
    try:
        with NPDESClient() as client:
            rows_raw = client.fetch_state_potws(state)
    except NPDESClientError as exc:
        logger.warning("NPDES REST refresh failed for %s: %s", state, exc)
        return 0

    facilities: list[NpdesStateFacility] = []
    seen: set[str] = set()
    for raw in rows_raw:
        row = _row_from_api(state, raw, now)
        if not row or row.npdes_id in seen:
            continue
        seen.add(row.npdes_id)
        facilities.append(row)

    db.query(NpdesStateFacility).filter(NpdesStateFacility.state_code == state).delete(
        synchronize_session=False
    )
    for r in facilities:
        db.add(r)
    db.commit()
    logger.info("NPDES REST refresh: %s = %d facilities", state, len(facilities))
    return len(facilities)


def _fallback_per_state(db: Session) -> dict[str, int]:
    results: dict[str, int] = {}
    for st in ALL_SDWIS_STATE_CODES:
        try:
            results[st] = refresh_state_landscape(db, st)
        except Exception as exc:
            logger.warning("Per-state NPDES refresh failed for %s: %s", st, exc)
    return results


def refresh_all_states(db: Session) -> dict[str, int]:
    return refresh_from_bulk_download(db)
