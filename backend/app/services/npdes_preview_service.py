"""Live EPA DFR preview for an NPDES permit (no persistence).

Merges the cached `npdes_state_facilities` row with a live ECHO Detailed Facility
Report so reviewers can drill into RNC quarters, effluent parameters, formal
actions, and notices without linking the facility to a district.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models.npdes_state_facility import NpdesStateFacility
from app.services.npdes_client import NPDESClient, NPDESClientError

logger = logging.getLogger(__name__)

_MAX_QUARTERS = 13

_RNC_SECTION_KEYS = ("CWARNCCompliance", "CWARNCComplianceEXP", "RNCCompliance")
_EFFLUENT_SECTION_KEYS = (
    "CWAEffluentComplianceEXP",
    "CWAEffluentCompliance",
    "EffluentCompliance",
)
_FORMAL_ACTION_SECTION_KEYS = (
    "FormalActions",
    "ICISFormalActions",
    "CWAFormalActions",
)
_NOTICE_SECTION_KEYS = ("Notices", "ICISNotices", "CWANotices")

_MAX_ROWS = 200


def _norm_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def _pick(row: Any, keys: Iterable[str]) -> Optional[str]:
    """First non-empty value for any alias, then normalized key matching."""
    if not isinstance(row, dict):
        return None
    for key in keys:
        val = row.get(key)
        if val not in (None, ""):
            text = str(val).strip()
            if text:
                return text
    wanted = {_norm_key(k) for k in keys}
    for key, val in row.items():
        if _norm_key(key) in wanted and val not in (None, ""):
            text = str(val).strip()
            if text:
                return text
    return None


def _pick_float(row: Any, keys: Iterable[str]) -> Optional[float]:
    raw = _pick(row, keys)
    if raw is None:
        return None
    cleaned = re.sub(r"[^0-9.\-]", "", raw)
    try:
        return float(cleaned) if cleaned not in ("", "-", ".", "-.") else None
    except ValueError:
        return None


def _pick_int(row: Any, keys: Iterable[str]) -> Optional[int]:
    value = _pick_float(row, keys)
    return int(value) if value is not None else None


def _section(results: Dict[str, Any], keys: Iterable[str]) -> Any:
    if not isinstance(results, dict):
        return None
    for key in keys:
        val = results.get(key)
        if val:
            return val
    wanted = {_norm_key(k) for k in keys}
    for key, val in results.items():
        if val and _norm_key(key) in wanted:
            return val
    return None


def _sources(section: Any) -> List[Dict[str, Any]]:
    if isinstance(section, dict):
        rows = section.get("Sources") or section.get("Source") or []
    elif isinstance(section, list):
        rows = section
    else:
        rows = []
    return [r for r in rows if isinstance(r, dict)]


def _cache_row(db: Session, npdes_id: str, state: Optional[str]) -> Optional[NpdesStateFacility]:
    q = db.query(NpdesStateFacility).filter(NpdesStateFacility.npdes_id == npdes_id)
    if state:
        q = q.filter(NpdesStateFacility.state_code == state.upper()[:2])
    return q.order_by(NpdesStateFacility.last_refreshed.desc().nullslast()).first()


def _extract_cwa_permit(permits: Any, npdes_id: str) -> Optional[Dict[str, Any]]:
    """CWA/NPDES permit block, preferring the one whose SourceID matches."""
    fallback: Optional[Dict[str, Any]] = None
    for p in permits or []:
        if not isinstance(p, dict):
            continue
        statute = (p.get("Statute") or "").upper()
        system = (p.get("EPASystem") or "").upper()
        is_cwa = statute in ("CWA", "NPDES") or system in ("ICP", "ICIS-NPDES", "NPDES", "PCS")
        source_id = (p.get("SourceID") or "").strip().upper()
        if source_id and source_id == npdes_id:
            return p
        if is_cwa and fallback is None:
            fallback = p
    return fallback


def _quarter_labels(header: Any) -> Dict[int, Dict[str, Optional[str]]]:
    """Quarter label/period from a DFR section Header (`QtrNStart` / `QtrNEnd`)."""
    header = header if isinstance(header, dict) else {}
    out: Dict[int, Dict[str, Optional[str]]] = {}
    for i in range(1, _MAX_QUARTERS + 1):
        begin = _pick(header, (f"Qtr{i}Start", f"Qtr{i}Begin", f"Qtr{i}StartDate"))
        end = _pick(header, (f"Qtr{i}End", f"Qtr{i}EndDate"))
        label = _pick(header, (f"Qtr{i}", f"Qtr{i}Label", f"Qtr{i}Name")) or f"Q{i}"
        period = " – ".join([p for p in (begin, end) if p]) or None
        out[i] = {"label": label, "period": period}
    return out


def _rnc_quarters(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    section = _section(results, _RNC_SECTION_KEYS)
    if not section:
        return []
    labels = _quarter_labels(section.get("Header") if isinstance(section, dict) else None)

    status: Dict[str, Any] = {}
    for src in _sources(section):
        candidate = src.get("Status")
        if isinstance(candidate, dict):
            status = candidate
            break

    out: List[Dict[str, Any]] = []
    for i in range(1, _MAX_QUARTERS + 1):
        quarter_status = _pick(status, (f"Qtr{i}Status", f"Q{i}Status"))
        meta = labels.get(i) or {}
        if not quarter_status and not meta.get("period"):
            continue
        out.append(
            {
                "label": meta.get("label") or f"Q{i}",
                "period": meta.get("period"),
                "status": quarter_status,
            }
        )
    return out


def _effluent_parameters(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    section = _section(results, _EFFLUENT_SECTION_KEYS)
    if not section:
        return []
    labels = _quarter_labels(section.get("Header") if isinstance(section, dict) else None)

    out: List[Dict[str, Any]] = []
    for src in _sources(section):
        for param in src.get("Parameters") or []:
            if not isinstance(param, dict):
                continue
            quarters: List[Dict[str, Any]] = []
            for i in range(1, _MAX_QUARTERS + 1):
                q_status = _pick(param, (f"Qtr{i}Status", f"Q{i}Status"))
                q_value = _pick(param, (f"Qtr{i}Value", f"Q{i}Value", f"Qtr{i}Exceedance"))
                if not q_status and not q_value:
                    continue
                meta = labels.get(i) or {}
                quarters.append(
                    {
                        "label": meta.get("label") or f"Q{i}",
                        "status": q_status,
                        "value": q_value,
                    }
                )
            name = _pick(param, ("ParameterDesc", "Parameter", "ParameterName", "ParamDesc"))
            if not name and not quarters:
                continue
            out.append(
                {
                    "name": name,
                    "discharge_point": _pick(
                        param, ("DischargePoint", "Outfall", "PermittedFeature", "DischargePointID")
                    ),
                    "monitoring_location": _pick(
                        param, ("MonitoringLocation", "MonitoringLocationDesc", "MonitoringLocationCode")
                    ),
                    "measurement_type": _pick(
                        param, ("MeasurementType", "StatisticalBase", "LimitType", "MeasureType")
                    ),
                    "quarters": quarters,
                }
            )
            if len(out) >= _MAX_ROWS:
                return out
    return out


def _formal_actions(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    section = _section(results, _FORMAL_ACTION_SECTION_KEYS)
    out: List[Dict[str, Any]] = []
    for row in _sources(section):
        action = {
            "action_id": _pick(row, ("ActionId", "ActivityId", "EnforcementId", "CaseNumber")),
            "action_date": _pick(row, ("ActionDate", "SettlementDate", "AchievedDate", "Date")),
            "action_type": _pick(row, ("ActionType", "ActionTypeDesc", "Type", "LawSection")),
            "description": _pick(row, ("Description", "ActionDesc", "Summary", "Docket")),
            "agency": _pick(row, ("Agency", "AgencyType", "LeadAgency")),
            "penalty": _pick(row, ("Penalty", "FederalPenalty", "TotalPenalty", "PenaltyAmount")),
        }
        if any(action.values()):
            out.append(action)
        if len(out) >= _MAX_ROWS:
            break
    return out


def _notices(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    section = _section(results, _NOTICE_SECTION_KEYS)
    out: List[Dict[str, Any]] = []
    for row in _sources(section):
        notice = {
            "notice_date": _pick(row, ("NoticeDate", "ActionDate", "Date")),
            "notice_type": _pick(row, ("NoticeType", "Type", "ActionType", "NoticeDesc")),
            "description": _pick(row, ("Description", "Summary", "Comment")),
            "agency": _pick(row, ("Agency", "AgencyType", "LeadAgency")),
        }
        if any(notice.values()):
            out.append(notice)
        if len(out) >= _MAX_ROWS:
            break
    return out


def _sections_present(results: Dict[str, Any]) -> List[str]:
    if not isinstance(results, dict):
        return []
    return sorted(key for key, val in results.items() if val not in (None, "", [], {}))


def _dfr_url(results: Dict[str, Any], permits: Any) -> Optional[str]:
    for p in permits or []:
        if isinstance(p, dict) and p.get("DQURL"):
            return str(p["DQURL"])
    registry_id = results.get("RegistryID") or results.get("RegistryId")
    if registry_id:
        return f"https://echo.epa.gov/detailed-facility-report?fid={registry_id}"
    return None


def build_npdes_preview(
    db: Session,
    npdes_id: str,
    state: Optional[str] = None,
) -> Dict[str, Any]:
    """Return an in-app preview payload for one NPDES permit."""
    pid = (npdes_id or "").strip().upper()
    if len(pid) < 7:
        raise ValueError("Invalid NPDES ID")

    cached = _cache_row(db, pid, state)

    payload: Dict[str, Any] = {
        "npdes_id": pid,
        "facility_name": None,
        "address": None,
        "county": None,
        "state_code": (state or pid[:2]).upper()[:2],
        "epa_region": None,
        "latitude": None,
        "longitude": None,
        "major_minor": None,
        "design_flow_mgd": None,
        "total_design_flow": None,
        "snc": None,
        "qtrs_with_nc": None,
        "plant_class": None,
        "permit_type": None,
        "facility_type_code": None,
        "sic_code": None,
        "owner_type": None,
        "permit_effective": None,
        "permit_expiration": None,
        "dfr_url": None,
        "rnc_quarters": [],
        "effluent_parameters": [],
        "formal_actions": [],
        "notices": [],
        "sections_present": [],
        "source": "cache" if cached else "epa_live",
        "preview_only": True,
    }

    if cached:
        payload.update(
            {
                "facility_name": cached.facility_name,
                "county": cached.county,
                "state_code": cached.state_code or payload["state_code"],
                "major_minor": cached.major_minor,
                "design_flow_mgd": cached.design_flow_mgd,
                "total_design_flow": cached.total_design_flow,
                "snc": cached.snc,
                "qtrs_with_nc": cached.qtrs_with_nc,
                "plant_class": cached.plant_class,
                "permit_type": cached.permit_type,
                "facility_type_code": cached.facility_type_code,
                "sic_code": cached.sic_code,
                "owner_type": cached.owner_type,
                "permit_effective": cached.permit_effective,
                "permit_expiration": cached.permit_expiration,
            }
        )

    client = NPDESClient()
    try:
        dfr = client.get_dfr(pid)
        results = (dfr or {}).get("Results") or {}
        permits = results.get("Permits") or []
        permit = _extract_cwa_permit(permits, pid) or {}

        street = _pick(permit, ("FacilityStreet", "FacilityAddress", "Street"))
        city = _pick(permit, ("FacilityCity", "City"))
        st = _pick(permit, ("FacilityState", "State"))
        zip_code = _pick(permit, ("FacilityZip", "FacilityZipCode", "Zip"))
        address_parts = [p for p in (street, city, st) if p]
        address = ", ".join(address_parts)
        if address and zip_code:
            address = f"{address} {zip_code}"

        _NC_KEYS = ("QtrsWithNC", "QtrsInNC", "CWAQtrsWithNC")
        live_qtrs_with_nc = _pick_int(permit, _NC_KEYS)

        payload.update(
            {
                "facility_name": _pick(permit, ("FacilityName", "Name"))
                or payload["facility_name"],
                "address": address or None,
                "county": _pick(permit, ("FacilityCounty", "County")) or payload["county"],
                "state_code": (st or payload["state_code"] or "")[:2].upper() or None,
                "epa_region": _pick(permit, ("EPARegion", "Region")),
                "latitude": _pick_float(permit, ("FacilityLatitude", "Latitude", "Lat")),
                "longitude": _pick_float(permit, ("FacilityLongitude", "Longitude", "Long")),
                "major_minor": _pick(permit, ("MajorMinorStatus", "MajorMinor", "Major"))
                or payload["major_minor"],
                "design_flow_mgd": _pick_float(permit, ("DesignFlow", "DesignFlowMGD"))
                or payload["design_flow_mgd"],
                "total_design_flow": _pick_float(
                    permit, ("TotalDesignFlow", "TotalDesignFlowMGD", "ActualAverageFlow")
                )
                or payload["total_design_flow"],
                "snc": _pick(permit, ("CurrentSNC", "SNC", "CWASNC")) or payload["snc"],
                "qtrs_with_nc": live_qtrs_with_nc
                if live_qtrs_with_nc is not None
                else payload["qtrs_with_nc"],
                "permit_type": _pick(permit, ("PermitTypeDesc", "PermitType"))
                or payload["permit_type"],
                "facility_type_code": _pick(
                    permit, ("FacilityTypeCode", "FacilityType", "CWAFacilityTypeCode")
                )
                or payload["facility_type_code"],
                "sic_code": _pick(permit, ("SICCodes", "SICCode", "SIC")) or payload["sic_code"],
                "owner_type": _pick(permit, ("OwnershipType", "OwnerType", "Ownership"))
                or payload["owner_type"],
                "permit_effective": _pick(
                    permit, ("EffectiveDate", "PermitEffectiveDate", "IssueDate")
                )
                or payload["permit_effective"],
                "permit_expiration": _pick(
                    permit, ("ExpirationDate", "PermitExpirationDate")
                )
                or payload["permit_expiration"],
                "dfr_url": _dfr_url(results, permits),
                "rnc_quarters": _rnc_quarters(results),
                "effluent_parameters": _effluent_parameters(results),
                "formal_actions": _formal_actions(results),
                "notices": _notices(results),
                "sections_present": _sections_present(results),
                "source": "epa_live",
            }
        )
    except NPDESClientError as exc:
        if cached:
            logger.warning(
                "EPA DFR preview failed for NPDES %s, using cache only: %s", pid, exc
            )
            payload["source"] = "cache"
        else:
            raise
    finally:
        client.close()

    return payload
