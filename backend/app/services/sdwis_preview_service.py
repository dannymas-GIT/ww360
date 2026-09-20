"""Fetch SDWIS / EPA data for in-app preview without persisting a district link."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models.sdwis_state_system import SDWISStateSystem
from app.models.sdwis_water_system import SDWISWaterSystem
from app.services.sdwis_client import SDWISClient, SDWISClientError
from app.services.sdwis_sync_service import (
    _extract_sdwa_permit,
    _population_from_areas,
    _stable_violation_key,
)

logger = logging.getLogger(__name__)

# ECHO DFR key names drift between programs and releases, so every read goes
# through an alias list plus a normalized (case/punctuation-insensitive) fallback.
_VE_SECTION_KEYS = (
    "ViolationsEnforcementActions",
    "ViolationsAndEnforcementActions",
    "ViolationsEnforcement",
    "SDWISViolationsEnforcementActions",
    "SDWAViolationsEnforcementActions",
)
_COMPLIANCE_SECTION_KEYS = ("SDWISCompliance", "SDWACompliance", "SDWISComplianceEXP")
_SURVEY_SECTION_KEYS = (
    "SDWISSanitarySurveys",
    "SanitarySurveys",
    "SDWASanitarySurveys",
)
_VISIT_SECTION_KEYS = ("SDWISSiteVisits", "SiteVisits", "SDWASiteVisits")

_CONTAMINANT_KEYS = (
    "ContaminantName",
    "Contaminant",
    "ContaminantDesc",
    "ContaminantCodeDesc",
    "ContaminantCode",
)
_RULE_KEYS = ("FederalRule", "RuleName", "FederalRuleName", "RuleFamily", "Rule")
_ENF_TYPE_KEYS = ("EnforcementType", "EnforcementActionCategory", "ActionType")
_ENF_DESC_KEYS = (
    "EnforcementActionTypeDesc",
    "EnforcementActionTypeDescription",
    "EnforcementActionDesc",
    "EnforcementActionType",
    "EnforcementDesc",
    "ActionDescription",
)
_ENF_DATE_KEYS = ("EnforcementDate", "EnforcementActionDate", "ActionDate")
_ENF_ID_KEYS = ("EnforcementId", "EnforcementID", "EnforcementActionId", "ActionId")
_AGENCY_KEYS = ("Agency", "AgencyType", "EnforcementAgency")

_MAX_QUARTERS = 13


def _norm_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def _pick(row: Any, keys: Iterable[str]) -> Optional[str]:
    """First non-empty value for any alias, falling back to normalized matching."""
    if not isinstance(row, dict):
        return None
    for key in keys:
        val = row.get(key)
        if val not in (None, ""):
            return str(val).strip() or None
    wanted = {_norm_key(k) for k in keys}
    for key, val in row.items():
        if _norm_key(key) in wanted and val not in (None, ""):
            return str(val).strip() or None
    return None


_STREET_KEYS = ("FacilityStreet", "FacilityAddress", "Street")
_CITY_KEYS = ("FacilityCity", "City")
_ZIP_KEYS = ("FacilityZip", "FacilityZipCode", "Zip")
_COUNTY_KEYS = ("FacilityCountyName", "FacilityCounty", "County", "CountyName")


def _address_from_permits(
    permits: Any, preferred: Optional[Dict[str, Any]] = None
) -> Dict[str, Optional[str]]:
    """
    FRS street/city/zip often live on sibling DFR permit rows, not the SDWA row.
    Prefer the SDWA permit, then any permit that has a street (or city+zip).
    """
    ordered: List[Dict[str, Any]] = []
    if isinstance(preferred, dict):
        ordered.append(preferred)
    if isinstance(permits, list):
        for p in permits:
            if isinstance(p, dict) and p is not preferred:
                ordered.append(p)

    empty = {
        "facility_street": None,
        "facility_city": None,
        "facility_zip": None,
        "facility_county": None,
    }
    fallback = dict(empty)
    for row in ordered:
        street = _pick(row, _STREET_KEYS)
        city = _pick(row, _CITY_KEYS)
        zip_code = _pick(row, _ZIP_KEYS)
        county = _pick(row, _COUNTY_KEYS)
        if not fallback["facility_county"] and county:
            fallback["facility_county"] = county
        if street or (city and zip_code):
            return {
                "facility_street": street,
                "facility_city": city,
                "facility_zip": zip_code,
                "facility_county": county or fallback["facility_county"],
            }
        if city and not fallback["facility_city"]:
            fallback["facility_city"] = city
        if zip_code and not fallback["facility_zip"]:
            fallback["facility_zip"] = zip_code
    return fallback


def _section(results: Dict[str, Any], keys: Iterable[str]) -> Any:
    """Read a DFR Results section by alias, then by normalized key match."""
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


def _section_containing(results: Dict[str, Any], fragment: str) -> Any:
    """Loose fallback: first non-empty section whose name contains `fragment`."""
    if not isinstance(results, dict):
        return None
    frag = _norm_key(fragment)
    for key, val in results.items():
        if val and frag in _norm_key(key):
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


def _landscape_row(db: Session, pwsid: str, state: Optional[str]) -> Optional[SDWISStateSystem]:
    pid = pwsid.strip().upper()
    q = db.query(SDWISStateSystem).filter(SDWISStateSystem.pwsid == pid)
    if state:
        q = q.filter(SDWISStateSystem.state_code == state.upper()[:2])
    return q.order_by(SDWISStateSystem.last_refreshed.desc().nullslast()).first()


def _linked_row(db: Session, pwsid: str) -> Optional[SDWISWaterSystem]:
    return db.query(SDWISWaterSystem).filter(SDWISWaterSystem.pwsid == pwsid.strip().upper()).one_or_none()


def _dfr_url(results: Dict[str, Any], permits: Any, pwsid: Optional[str] = None) -> Optional[str]:
    for p in permits or []:
        if not isinstance(p, dict):
            continue
        for key in ("DQURL", "DQUrl", "DetailedFacilityReportURL", "DFRURL"):
            if p.get(key):
                return str(p[key])
    registry_id = results.get("RegistryID") or results.get("RegistryId")
    if registry_id:
        return f"https://echo.epa.gov/detailed-facility-report?fid={registry_id}"
    pid = (pwsid or "").strip().upper()
    if len(pid) >= 7:
        return f"https://echo.epa.gov/detailed-facility-report?pwsid={pid}"
    return None


def _nested_event_rows(section: Any, nested_keys: Iterable[str]) -> List[Dict[str, Any]]:
    """ECHO often nests events under Sources[].SanitarySurvey / SiteVisit lists."""
    rows: List[Dict[str, Any]] = []
    for src in _sources(section):
        matched = False
        for key in nested_keys:
            nested = src.get(key)
            if isinstance(nested, list):
                rows.extend(r for r in nested if isinstance(r, dict))
                matched = True
            elif isinstance(nested, dict):
                rows.append(nested)
                matched = True
        if not matched and any(
            k for k in src.keys() if "date" in _norm_key(k) or "visit" in _norm_key(k)
        ):
            rows.append(src)
    if not rows and isinstance(section, list):
        rows = [r for r in section if isinstance(r, dict)]
    return rows


def _compliance_quarters(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Quarter-by-quarter compliance strip from the SDWISCompliance block."""
    section = _section(results, _COMPLIANCE_SECTION_KEYS)
    if not isinstance(section, dict):
        return []
    # Dates live on the section root (not under Header) in current ECHO DFR JSON.
    header = section.get("Header") if isinstance(section.get("Header"), dict) else {}
    status: Dict[str, Any] = {}
    for src in _sources(section):
        candidate = src.get("Status")
        if isinstance(candidate, dict):
            status = candidate
            break

    out: List[Dict[str, Any]] = []
    for i in range(1, _MAX_QUARTERS + 1):
        quarter_status = _pick(status, (f"Qtr{i}Status", f"Q{i}Status", f"Qtr{i}"))
        label = (
            _pick(header, (f"Qtr{i}", f"Qtr{i}Label", f"Qtr{i}Name"))
            or _pick(section, (f"Qtr{i}Label",))
            or f"Q{i}"
        )
        begin = _pick(header, (f"Qtr{i}Start", f"Qtr{i}Begin", f"Qtr{i}StartDate")) or _pick(
            section, (f"Qtr{i}Start", f"Qtr{i}Begin", f"Qtr{i}StartDate")
        )
        end = _pick(header, (f"Qtr{i}End", f"Qtr{i}EndDate")) or _pick(
            section, (f"Qtr{i}End", f"Qtr{i}EndDate")
        )
        period = " – ".join([p for p in (begin, end) if p]) or None
        if not quarter_status and not period:
            continue
        out.append({"label": label, "period": period, "status": quarter_status})
    return out


def _sanitary_surveys(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    section = _section(results, _SURVEY_SECTION_KEYS) or _section_containing(
        results, "sanitarysurvey"
    )
    rows = _nested_event_rows(
        section, ("SanitarySurvey", "SanitarySurveys", "Surveys", "Survey")
    )

    out: List[Dict[str, Any]] = []
    for row in rows:
        notes = _pick(row, ("Notes", "Comments", "Comment", "Description"))
        # Prefer a short deficiency summary when present.
        deficiency_bits = [
            _pick(row, (f"{k}Desc",))
            for k in (
                "Treatment",
                "Source",
                "Distribution",
                "FinishedWaterStorage",
                "Pumps",
                "ManagementOperation",
                "OperatorCompliance",
                "Security",
                "Financial",
                "DataVerification",
                "OtherEvaluation",
            )
        ]
        deficiency_bits = [b for b in deficiency_bits if b and b.lower() != "not applicable"]
        if not notes and deficiency_bits:
            # Keep this short — full deficiency matrix is noisy for a preview strip.
            notable = [b for b in deficiency_bits if "no deficiencies" not in b.lower()]
            notes = "; ".join((notable or deficiency_bits)[:3])

        survey = {
            "survey_date": _pick(
                row, ("SurveyDate", "SanitarySurveyDate", "VisitDate", "Date")
            ),
            "survey_type": _pick(
                row, ("SurveyType", "SanitarySurveyType", "Type", "VisitType")
            ),
            "result": _pick(
                row, ("Result", "SurveyResult", "Outcome", "Findings", "Deficiencies")
            ),
            "notes": notes,
        }
        if any(survey.values()):
            out.append(survey)
    return out[:100]


def _site_visits(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    section = _section(results, _VISIT_SECTION_KEYS) or _section_containing(
        results, "sitevisit"
    )
    rows = _nested_event_rows(section, ("SiteVisit", "SiteVisits", "Visits", "Visit"))
    out: List[Dict[str, Any]] = []
    for row in rows:
        visit = {
            "visit_date": _pick(row, ("VisitDate", "SiteVisitDate", "Date", "ActionDate")),
            "reason": _pick(
                row,
                (
                    "Reason",
                    "VisitReason",
                    "SiteVisitReason",
                    "Purpose",
                    "VisitType",
                ),
            ),
            "agency": _pick(row, _AGENCY_KEYS),
        }
        if any(visit.values()):
            out.append(visit)
    return out[:100]


def _parse_dfr_preview(pwsid: str, dfr: Dict[str, Any]) -> Dict[str, Any]:
    results = (dfr or {}).get("Results") or {}
    permits = results.get("Permits") or []
    permit = _extract_sdwa_permit(permits)
    if not permit:
        raise ValueError(f"No SDWA/SDWIS permit found in DFR for {pwsid}")

    src_id = (permit.get("SourceID") or pwsid).strip().upper()
    violations: List[Dict[str, Any]] = []
    enforcement: List[Dict[str, Any]] = []
    enforcement_keys: set[str] = set()

    ve = _section(results, _VE_SECTION_KEYS) or {}
    for src in _sources(ve):
        for v in src.get("Violations") or []:
            if not isinstance(v, dict):
                continue
            contaminant = _pick(v, _CONTAMINANT_KEYS)
            rule_name = _pick(v, _RULE_KEYS)
            if not (v.get("ViolationID") or rule_name or contaminant):
                continue
            violations.append(
                {
                    "violation_epa_id": _stable_violation_key(src_id, v),
                    "rule_name": rule_name,
                    "contaminant_name": contaminant,
                    "category_code": _pick(v, ("ViolationCategoryCode", "CategoryCode")),
                    "category_desc": _pick(
                        v, ("ViolationCategoryDesc", "ViolationCategory", "CategoryDesc")
                    ),
                    "violation_measure": _pick(
                        v, ("ViolationMeasure", "Measure", "ViolationValue")
                    ),
                    "state_mcl": _pick(v, ("StateMCL", "StateMcl")),
                    "federal_mcl": _pick(v, ("FederalMCL", "FederalMcl")),
                    "compliance_period_begin": _pick(
                        v, ("CompliancePeriodBeginDate", "CompliancePeriodBegin")
                    ),
                    "compliance_period_end": _pick(
                        v, ("CompliancePeriodEndDate", "CompliancePeriodEnd")
                    ),
                    "non_compliance_begin": _pick(
                        v, ("NonCompliancePeriodBeginDate", "NonCompliancePeriodBegin")
                    ),
                    "non_compliance_end": _pick(
                        v, ("NonCompliancePeriodEndDate", "NonCompliancePeriodEnd")
                    ),
                    "resolved_date": _pick(v, ("ResolvedDate", "ReturnToComplianceDate")),
                    "status": _pick(v, ("Status", "ViolationStatus")),
                }
            )
            for ea in v.get("EnforcementActions") or []:
                if not isinstance(ea, dict):
                    continue
                eid = _pick(ea, _ENF_ID_KEYS)
                if not eid:
                    continue
                dedupe = f"{src_id}:{eid}"
                if dedupe in enforcement_keys:
                    continue
                enforcement_keys.add(dedupe)
                enforcement.append(
                    {
                        "enforcement_epa_id": eid,
                        "enforcement_type": _pick(ea, _ENF_TYPE_KEYS),
                        "action_description": _pick(ea, _ENF_DESC_KEYS),
                        "action_date": _pick(ea, _ENF_DATE_KEYS),
                        "agency": _pick(ea, _AGENCY_KEYS),
                    }
                )

    open_count = sum(
        1 for v in violations if (v.get("status") or "").lower() != "resolved"
    )
    address = _address_from_permits(permits, permit)

    return {
        "pwsid": src_id,
        "pws_name": permit.get("FacilityName"),
        "state_code": (permit.get("FacilityState") or "")[:2] or None,
        "epa_region": permit.get("EPARegion"),
        "facility_status": permit.get("FacilityStatus"),
        "population_served": _population_from_areas(permit.get("Areas")),
        "facility_street": address["facility_street"],
        "facility_city": address["facility_city"],
        "facility_zip": address["facility_zip"],
        "facility_county": address["facility_county"],
        "universe_summary": _pick(permit, ("Universe", "UniverseSummary")),
        "dfr_url": _dfr_url(results, permits, src_id),
        "violation_count": len(violations),
        "open_violation_count": open_count,
        "enforcement_count": len(enforcement),
        "violations": violations[:100],
        "enforcement_actions": enforcement[:100],
        "compliance_quarters": _compliance_quarters(results),
        "sanitary_surveys": _sanitary_surveys(results),
        "site_visits": _site_visits(results),
        "source": "epa_live",
    }


def build_pws_preview(
    db: Session,
    *,
    pwsid: str,
    state: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Return in-app preview payload for a PWSID.

    Uses cached landscape when available; fetches EPA DFR for violations/enforcement
    without writing to sdwis_water_systems.
    """
    pid = pwsid.strip().upper()
    if len(pid) < 7:
        raise ValueError("Invalid PWSID")

    landscape = _landscape_row(db, pid, state)
    linked = _linked_row(db, pid)

    base: Dict[str, Any] = {
        "pwsid": pid,
        "pws_name": None,
        "state_code": (state or pid[:2]).upper()[:2] if state or len(pid) >= 2 else None,
        "epa_region": None,
        "facility_status": None,
        "population_served": None,
        "snc": None,
        "health_flag": None,
        "serious_violator": None,
        "qtrs_with_vio": None,
        "qtrs_with_snc": None,
        "facility_street": None,
        "facility_city": None,
        "facility_zip": None,
        "facility_county": None,
        "universe_summary": None,
        "dfr_url": None,
        "violation_count": 0,
        "open_violation_count": 0,
        "enforcement_count": 0,
        "violations": [],
        "enforcement_actions": [],
        "compliance_quarters": [],
        "sanitary_surveys": [],
        "site_visits": [],
        "source": "landscape",
        "preview_only": True,
        "is_linked": linked is not None,
    }

    if landscape:
        base.update(
            {
                "pws_name": landscape.pws_name,
                "state_code": landscape.state_code,
                "population_served": landscape.population_served,
                "snc": landscape.snc,
                "health_flag": landscape.health_flag,
                "serious_violator": landscape.serious_violator,
                "qtrs_with_vio": landscape.qtrs_with_vio,
                "qtrs_with_snc": landscape.qtrs_with_snc,
                "facility_county": landscape.county,
                "source": "landscape",
            }
        )

    client = SDWISClient()
    try:
        dfr = client.get_dfr(pid)
        live = _parse_dfr_preview(pid, dfr)
        base.update(
            {
                "pws_name": live.get("pws_name") or base.get("pws_name"),
                "state_code": live.get("state_code") or base.get("state_code"),
                "epa_region": live.get("epa_region"),
                "facility_status": live.get("facility_status") or base.get("facility_status"),
                "population_served": live.get("population_served") or base.get("population_served"),
                "facility_street": live.get("facility_street") or base.get("facility_street"),
                "facility_city": live.get("facility_city") or base.get("facility_city"),
                "facility_zip": live.get("facility_zip") or base.get("facility_zip"),
                "facility_county": live.get("facility_county") or base.get("facility_county"),
                "universe_summary": live.get("universe_summary") or base.get("universe_summary"),
                "dfr_url": live.get("dfr_url") or base.get("dfr_url"),
                "violation_count": live["violation_count"],
                "open_violation_count": live["open_violation_count"],
                "enforcement_count": live["enforcement_count"],
                "violations": live["violations"],
                "enforcement_actions": live["enforcement_actions"],
                "compliance_quarters": live["compliance_quarters"],
                "sanitary_surveys": live["sanitary_surveys"],
                "site_visits": live["site_visits"],
                "source": "epa_live",
            }
        )
        # Enrich compliance flags from EPA search when landscape missing them
        if not base.get("snc") or not base.get("health_flag"):
            try:
                rows = client.lookup_water_systems(
                    state=base.get("state_code") or pid[:2],
                    name_query=pid,
                    max_pages=1,
                )
                for row in rows:
                    rid = row.get("PWSId") or row.get("PWSID")
                    if str(rid).upper() == pid:
                        base["snc"] = base.get("snc") or row.get("SNC")
                        base["health_flag"] = base.get("health_flag") or row.get("HealthFlag")
                        base["serious_violator"] = base.get("serious_violator") or row.get(
                            "SeriousViolator"
                        )
                        break
            except Exception as exc:  # noqa: BLE001
                logger.info("Preview EPA search enrich skipped: %s", exc)
    except SDWISClientError as exc:
        if base.get("pws_name"):
            logger.warning("EPA DFR preview failed for %s, using landscape only: %s", pid, exc)
        else:
            raise
    finally:
        client.close()

    return base
