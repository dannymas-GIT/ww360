"""Apply AquaSafe sync events to local mirror tables."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from app.models.sync import (
    ExtDistrict,
    ExtDistrictMembership,
    ExtFacility,
    ExtModuleFlag,
    ExtUser,
    SyncCursor,
    SyncInbox,
)
from app.models.water_district import WaterDistrict
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class DistrictIdentityConflict(Exception):
    """Raised when canonical (pwsid|npdes_id, state_code) is already claimed."""


def _upsert_user(db: Session, payload: dict[str, Any], version: int) -> None:
    uid = int(payload["id"])
    row = db.get(ExtUser, uid)
    if row is None:
        row = ExtUser(id=uid)
        db.add(row)
    if row.version and row.version >= version:
        return
    row.username = payload.get("username", "")
    row.email = payload.get("email")
    row.full_name = payload.get("full_name")
    row.is_active = bool(payload.get("is_active", True))
    row.roles = payload.get("roles") or []
    row.version = version


def resolve_water_district(db: Session, payload: dict[str, Any]) -> WaterDistrict:
    """Resolve or create ``WaterDistrict`` without borrowing AquaSafe's integer PK.

    Lookup order: ``district_code`` → ``aquasafe_district_id`` → canonical
    ``(pwsid, state_code)`` / ``(npdes_id, state_code)``. Conflicts raise
    ``DistrictIdentityConflict`` for platform_admin merge.
    """
    code = str(payload["district_code"]).strip()
    aquasafe_id = int(payload["id"]) if payload.get("id") is not None else None
    state = (payload.get("state_code") or "").strip().upper()[:2] or None
    pwsid = (payload.get("pwsid") or payload.get("pws_id") or "").strip() or None
    npdes_id = (payload.get("npdes_id") or payload.get("npdes_permit_id") or "").strip() or None
    spdes_id = (payload.get("spdes_id") or "").strip() or None

    wd = db.query(WaterDistrict).filter(WaterDistrict.district_code == code).one_or_none()

    if wd is None and aquasafe_id is not None:
        wd = (
            db.query(WaterDistrict)
            .filter(WaterDistrict.aquasafe_district_id == aquasafe_id)
            .one_or_none()
        )

    if wd is None and pwsid and state:
        by_pws = (
            db.query(WaterDistrict)
            .filter(WaterDistrict.pwsid == pwsid, WaterDistrict.state_code == state)
            .one_or_none()
        )
        if by_pws is not None and by_pws.district_code != code:
            raise DistrictIdentityConflict(
                f"PWSID {pwsid}/{state} already claimed by district {by_pws.district_code}"
            )
        wd = by_pws

    if wd is None and npdes_id and state:
        by_npdes = (
            db.query(WaterDistrict)
            .filter(WaterDistrict.npdes_id == npdes_id, WaterDistrict.state_code == state)
            .one_or_none()
        )
        if by_npdes is not None and by_npdes.district_code != code:
            raise DistrictIdentityConflict(
                f"NPDES {npdes_id}/{state} already claimed by district {by_npdes.district_code}"
            )
        wd = by_npdes

    if wd is None:
        # Let Postgres sequence assign local water_districts.id — do NOT pass AquaSafe id.
        wd = WaterDistrict(district_code=code, district_name=payload.get("district_name") or code)
        db.add(wd)
        db.flush()

    if aquasafe_id is not None:
        other = (
            db.query(WaterDistrict)
            .filter(
                WaterDistrict.aquasafe_district_id == aquasafe_id,
                WaterDistrict.id != wd.id,
            )
            .one_or_none()
        )
        if other is not None:
            raise DistrictIdentityConflict(
                f"aquasafe_district_id={aquasafe_id} already linked to {other.district_code}"
            )
        wd.aquasafe_district_id = aquasafe_id

    if pwsid:
        wd.pwsid = pwsid
    if npdes_id:
        wd.npdes_id = npdes_id
    if spdes_id:
        wd.spdes_id = spdes_id
    if state:
        wd.state_code = state
    return wd


def _upsert_district(db: Session, payload: dict[str, Any], version: int) -> None:
    code = payload["district_code"]
    row = db.query(ExtDistrict).filter(ExtDistrict.district_code == code).one_or_none()
    if row is None:
        # ExtDistrict remains an AquaSafe id mirror (separate from water_districts PK).
        row = ExtDistrict(id=int(payload["id"]), district_code=code)
        db.add(row)
    if row.version and row.version >= version:
        return
    row.district_name = payload.get("district_name", code)
    row.state_code = payload.get("state_code")
    row.is_active = bool(payload.get("is_active", True))
    row.version = version

    wd = resolve_water_district(db, payload)
    wd.district_name = row.district_name
    wd.state_code = row.state_code
    wd.is_active = row.is_active


def _upsert_membership(db: Session, payload: dict[str, Any], version: int) -> None:
    user_id = int(payload["user_id"])
    district_code = payload["district_code"]
    row = (
        db.query(ExtDistrictMembership)
        .filter(
            ExtDistrictMembership.user_id == user_id,
            ExtDistrictMembership.district_code == district_code,
        )
        .one_or_none()
    )
    if row is None:
        row = ExtDistrictMembership(user_id=user_id, district_code=district_code)
        db.add(row)
    if row.version and row.version >= version:
        return
    row.roles = payload.get("roles") or []
    row.version = version


def _upsert_module_flag(db: Session, payload: dict[str, Any], version: int) -> None:
    district_code = payload["district_code"]
    module_key = payload["module_key"]
    row = (
        db.query(ExtModuleFlag)
        .filter(
            ExtModuleFlag.district_code == district_code,
            ExtModuleFlag.module_key == module_key,
        )
        .one_or_none()
    )
    if row is None:
        row = ExtModuleFlag(district_code=district_code, module_key=module_key)
        db.add(row)
    if row.version and row.version >= version:
        return
    row.enabled = bool(payload.get("enabled", False))
    row.version = version


def _upsert_facility(db: Session, payload: dict[str, Any], version: int) -> None:
    publisher = (payload.get("publisher") or payload.get("source") or "aquasafe").strip()
    facility_id = str(payload.get("facility_id") or "").strip()
    if not facility_id:
        raise ValueError("facility payload missing facility_id")
    row = (
        db.query(ExtFacility)
        .filter(
            ExtFacility.publisher == publisher,
            ExtFacility.facility_id == facility_id,
        )
        .one_or_none()
    )
    if row is None:
        row = ExtFacility(
            publisher=publisher,
            facility_id=facility_id,
            district_code=str(payload.get("district_code") or ""),
            facility_type=str(payload.get("facility_type") or "pws"),
            name=str(payload.get("name") or facility_id),
        )
        db.add(row)
    if row.version and row.version >= version:
        return
    row.district_code = payload.get("district_code") or row.district_code or ""
    row.facility_type = payload.get("facility_type") or row.facility_type or "pws"
    row.name = payload.get("name") or row.name or facility_id
    row.state_code = payload.get("state_code")
    row.pwsid = payload.get("pwsid") or payload.get("pws_id")
    row.npdes_id = payload.get("npdes_id") or payload.get("npdes_permit_id")
    row.spdes_id = payload.get("spdes_id")
    row.plant_class = payload.get("plant_class") or payload.get("plant_classification")
    flow = payload.get("design_flow_mgd")
    row.design_flow_mgd = float(flow) if flow is not None and flow != "" else None
    lat = payload.get("latitude")
    lon = payload.get("longitude")
    row.latitude = float(lat) if lat is not None and lat != "" else None
    row.longitude = float(lon) if lon is not None and lon != "" else None
    row.is_active = bool(payload.get("is_active", True))
    row.version = version


_HANDLERS = {
    "user": _upsert_user,
    "district": _upsert_district,
    "district_membership": _upsert_membership,
    "module_flag": _upsert_module_flag,
    "facility": _upsert_facility,
}


def apply_event(db: Session, event: dict[str, Any]) -> None:
    aggregate = event["aggregate"]
    handler = _HANDLERS.get(aggregate)
    if not handler:
        logger.warning("Unknown sync aggregate: %s", aggregate)
        return
    handler(db, event["payload"], int(event["version"]))


def process_inbox_event(db: Session, event_id: str) -> bool:
    row = db.get(SyncInbox, event_id)
    if row is None or row.processed_at is not None:
        return False
    try:
        apply_event(
            db,
            {
                "aggregate": row.aggregate,
                "payload": row.payload,
                "version": row.version,
            },
        )
        row.processed_at = datetime.now(UTC)
        row.error = None
        cursor = db.get(SyncCursor, row.aggregate)
        if cursor is None:
            cursor = SyncCursor(entity=row.aggregate, last_version=0)
            db.add(cursor)
        if row.version > cursor.last_version:
            cursor.last_version = row.version
        db.commit()
        return True
    except Exception as exc:
        db.rollback()
        row = db.get(SyncInbox, event_id)
        if row:
            row.error = str(exc)[:2000]
            db.commit()
        logger.exception("Sync event %s failed", event_id)
        return False
