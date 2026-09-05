"""Sync EPA ECHO DFR data into local SDWIS tables."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sdwis_enforcement_action import SDWISEnforcementAction
from app.models.sdwis_violation import SDWISViolation
from app.models.sdwis_water_system import SDWISWaterSystem
from app.services.sdwis_client import SDWISClient, SDWISClientError

logger = logging.getLogger(__name__)


def _population_from_areas(areas: Optional[str]) -> Optional[int]:
    if not areas:
        return None
    m = re.search(r"Population Served:\s*(\d+)", areas, re.IGNORECASE)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return None
    return None


def _stable_violation_key(pwsid: str, v: Dict[str, Any]) -> str:
    vid = (v.get("ViolationID") or "").strip()
    if vid:
        return vid
    payload = json.dumps(
        {
            "pwsid": pwsid,
            "rule": v.get("FederalRule"),
            "cb": v.get("CompliancePeriodBeginDate"),
            "cont": v.get("ContaminantName"),
            "ncb": v.get("NonCompliancePeriodBeginDate"),
        },
        sort_keys=True,
    )
    return "h" + hashlib.sha256(payload.encode()).hexdigest()[:31]


def _extract_sdwa_permit(permits: Any) -> Optional[Dict[str, Any]]:
    if not permits:
        return None
    for p in permits:
        if not isinstance(p, dict):
            continue
        if p.get("EPASystem") == "SDWIS" or p.get("Statute") == "SDWA":
            return p
    return None


def _compliance_history_from_status(status: Any) -> Optional[str]:
    if not isinstance(status, dict):
        return None
    parts: List[str] = []
    for i in range(1, 14):
        key = f"Qtr{i}Status"
        if key in status:
            parts.append(f"Q{i}:{status.get(key)}")
    return "|".join(parts) if parts else None


class SDWISSyncService:
    def __init__(self, db: Session, client: Optional[SDWISClient] = None):
        self.db = db
        self._own_client = client is None
        self.client = client or SDWISClient()

    def close(self) -> None:
        if self._own_client and self.client:
            self.client.close()

    def sync_water_system_from_dfr(
        self,
        pwsid: str,
        district_code: Optional[str],
    ) -> Tuple[SDWISWaterSystem, int, int]:
        if not settings.SDWIS_SYNC_ENABLED:
            raise RuntimeError("SDWIS sync is disabled (SDWIS_SYNC_ENABLED=false)")

        pwsid = pwsid.strip().upper()
        if len(pwsid) < 7:
            raise ValueError("Invalid PWSID")

        dfr = self.client.get_dfr(pwsid)
        results = (dfr or {}).get("Results") or {}
        permits = results.get("Permits") or []
        permit = _extract_sdwa_permit(permits)
        if not permit:
            raise ValueError(f"No SDWA/SDWIS permit found in DFR for {pwsid}")

        src_id = (permit.get("SourceID") or pwsid).strip().upper()
        now = datetime.utcnow()

        status_block = None
        sc = results.get("SDWISCompliance") or {}
        sources = sc.get("Sources") or []
        if sources and isinstance(sources[0], dict):
            status_block = sources[0].get("Status")

        ws = self.db.query(SDWISWaterSystem).filter(SDWISWaterSystem.pwsid == src_id).one_or_none()
        if not ws:
            ws = SDWISWaterSystem(pwsid=src_id)
            self.db.add(ws)

        ws.district_code = district_code
        ws.pws_name = permit.get("FacilityName")
        ws.state_code = (permit.get("FacilityState") or "")[:2] or None
        ws.epa_region = permit.get("EPARegion")
        ws.registry_id = results.get("RegistryID")
        ws.facility_status = permit.get("FacilityStatus")
        ws.universe_summary = permit.get("Universe")
        ws.areas_summary = permit.get("Areas")
        ws.population_served = _population_from_areas(permit.get("Areas"))
        ws.dfr_url = None
        for p in permits:
            if isinstance(p, dict) and p.get("DQURL"):
                ws.dfr_url = p.get("DQURL")
                break
        if not ws.dfr_url and results.get("RegistryID"):
            ws.dfr_url = (
                f"https://echo.epa.gov/detailed-facility-report?fid={results.get('RegistryID')}"
            )

        ws.raw_compliance_status_json = status_block if isinstance(status_block, dict) else None
        ws.compliance_qtrs_history = _compliance_history_from_status(status_block)

        try:
            qrows = self.client.lookup_water_systems(
                state=ws.state_code or src_id[:2],
                name_query=src_id,
                max_pages=1,
            )
            for row in qrows:
                rid = row.get("PWSId") or row.get("PWSID")
                if str(rid).upper() == src_id:
                    ws.serious_violator = row.get("SeriousViolator")
                    ws.health_flag = row.get("HealthFlag")
                    ws.snc = row.get("SNC")
                    try:
                        ws.qtrs_with_vio = int(row.get("QtrsWithVio") or 0)
                    except (TypeError, ValueError):
                        ws.qtrs_with_vio = None
                    try:
                        ws.qtrs_with_snc = int(row.get("QtrsWithSNC") or 0)
                    except (TypeError, ValueError):
                        ws.qtrs_with_snc = None
                    ws.counties_served = row.get("CountiesServed")
                    ws.cities_served = row.get("CitiesServed")
                    ws.contaminants_in_current_violation = row.get("SDWAContaminantsInCurViol")
                    ws.violation_categories = row.get("ViolationCategories")
                    ws.pws_type_code = row.get("PWSTypeCode")
                    ws.pws_type_desc = row.get("PWSTypeDesc")
                    ws.primary_source_code = row.get("PrimarySourceCode")
                    ws.primary_source_desc = row.get("PrimarySourceDesc")
                    ws.owner_type_code = row.get("OwnerTypeCode")
                    ws.owner_desc = row.get("OwnerDesc")
                    break
        except Exception as e:
            logger.info("SDWIS optional search enrich skipped: %s", e)

        ws.last_synced_at = now
        self.db.flush()

        self.db.query(SDWISViolation).filter(SDWISViolation.pwsid == src_id).delete(
            synchronize_session=False
        )
        self.db.query(SDWISEnforcementAction).filter(
            SDWISEnforcementAction.pwsid == src_id
        ).delete(synchronize_session=False)

        ve = results.get("ViolationsEnforcementActions") or {}
        srcs = ve.get("Sources") or []
        violations_out = 0
        enforcement_keys: set[str] = set()

        for src in srcs:
            if not isinstance(src, dict):
                continue
            viols = src.get("Violations") or []
            for v in viols:
                if not isinstance(v, dict):
                    continue
                if not (v.get("ViolationID") or v.get("FederalRule") or v.get("ContaminantName")):
                    continue
                key = _stable_violation_key(src_id, v)
                sv = SDWISViolation(
                    pwsid=src_id,
                    violation_epa_id=key,
                    rule_name=v.get("FederalRule"),
                    contaminant_name=v.get("ContaminantName"),
                    category_code=v.get("ViolationCategoryCode"),
                    category_desc=v.get("ViolationCategoryDesc"),
                    violation_measure=v.get("ViolationMeasure"),
                    state_mcl=v.get("StateMCL"),
                    federal_mcl=v.get("FederalMCL"),
                    compliance_period_begin=v.get("CompliancePeriodBeginDate"),
                    compliance_period_end=v.get("CompliancePeriodEndDate"),
                    non_compliance_begin=v.get("NonCompliancePeriodBeginDate"),
                    non_compliance_end=v.get("NonCompliancePeriodEndDate"),
                    resolved_date=v.get("ResolvedDate"),
                    status=v.get("Status"),
                    last_synced_at=now,
                )
                self.db.add(sv)
                violations_out += 1

                for ea in v.get("EnforcementActions") or []:
                    if not isinstance(ea, dict):
                        continue
                    eid = (ea.get("EnforcementId") or "").strip() or None
                    if not eid:
                        raw = json.dumps(ea, sort_keys=True)
                        eid = "h" + hashlib.sha256(raw.encode()).hexdigest()[:24]
                    dedupe = f"{src_id}:{eid}"
                    if dedupe in enforcement_keys:
                        continue
                    enforcement_keys.add(dedupe)
                    self.db.add(
                        SDWISEnforcementAction(
                            pwsid=src_id,
                            enforcement_epa_id=eid,
                            enforcement_type=ea.get("EnforcementType"),
                            action_description=ea.get("EnforcementActionTypeDesc"),
                            action_date=ea.get("EnforcementDate"),
                            agency=ea.get("Agency"),
                            last_synced_at=now,
                        )
                    )

        self.db.commit()
        self.db.refresh(ws)
        return ws, violations_out, len(enforcement_keys)
