"""Fetch SDWIS / EPA data for in-app preview without persisting a district link."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

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


def _landscape_row(db: Session, pwsid: str, state: Optional[str]) -> Optional[SDWISStateSystem]:
    pid = pwsid.strip().upper()
    q = db.query(SDWISStateSystem).filter(SDWISStateSystem.pwsid == pid)
    if state:
        q = q.filter(SDWISStateSystem.state_code == state.upper()[:2])
    return q.order_by(SDWISStateSystem.last_refreshed.desc().nullslast()).first()


def _linked_row(db: Session, pwsid: str) -> Optional[SDWISWaterSystem]:
    return db.query(SDWISWaterSystem).filter(SDWISWaterSystem.pwsid == pwsid.strip().upper()).one_or_none()


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

    ve = results.get("ViolationsEnforcementActions") or {}
    for src in ve.get("Sources") or []:
        if not isinstance(src, dict):
            continue
        for v in src.get("Violations") or []:
            if not isinstance(v, dict):
                continue
            if not (v.get("ViolationID") or v.get("FederalRule") or v.get("ContaminantName")):
                continue
            status = v.get("Status")
            violations.append(
                {
                    "violation_epa_id": _stable_violation_key(src_id, v),
                    "rule_name": v.get("FederalRule"),
                    "contaminant_name": v.get("ContaminantName"),
                    "category_code": v.get("ViolationCategoryCode"),
                    "category_desc": v.get("ViolationCategoryDesc"),
                    "violation_measure": v.get("ViolationMeasure"),
                    "state_mcl": v.get("StateMCL"),
                    "federal_mcl": v.get("FederalMCL"),
                    "compliance_period_begin": v.get("CompliancePeriodBeginDate"),
                    "compliance_period_end": v.get("CompliancePeriodEndDate"),
                    "non_compliance_begin": v.get("NonCompliancePeriodBeginDate"),
                    "non_compliance_end": v.get("NonCompliancePeriodEndDate"),
                    "resolved_date": v.get("ResolvedDate"),
                    "status": status,
                }
            )
            for ea in v.get("EnforcementActions") or []:
                if not isinstance(ea, dict):
                    continue
                eid = (ea.get("EnforcementId") or "").strip() or None
                if not eid:
                    continue
                dedupe = f"{src_id}:{eid}"
                if dedupe in enforcement_keys:
                    continue
                enforcement_keys.add(dedupe)
                enforcement.append(
                    {
                        "enforcement_epa_id": eid,
                        "enforcement_type": ea.get("EnforcementType"),
                        "action_description": ea.get("EnforcementActionTypeDesc"),
                        "action_date": ea.get("EnforcementDate"),
                        "agency": ea.get("Agency"),
                    }
                )

    open_count = sum(
        1 for v in violations if (v.get("status") or "").lower() != "resolved"
    )

    return {
        "pwsid": src_id,
        "pws_name": permit.get("FacilityName"),
        "state_code": (permit.get("FacilityState") or "")[:2] or None,
        "epa_region": permit.get("EPARegion"),
        "facility_status": permit.get("FacilityStatus"),
        "population_served": _population_from_areas(permit.get("Areas")),
        "violation_count": len(violations),
        "open_violation_count": open_count,
        "enforcement_count": len(enforcement),
        "violations": violations[:100],
        "enforcement_actions": enforcement[:100],
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
        "violation_count": 0,
        "open_violation_count": 0,
        "enforcement_count": 0,
        "violations": [],
        "enforcement_actions": [],
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
                "violation_count": live["violation_count"],
                "open_violation_count": live["open_violation_count"],
                "enforcement_count": live["enforcement_count"],
                "violations": live["violations"],
                "enforcement_actions": live["enforcement_actions"],
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
