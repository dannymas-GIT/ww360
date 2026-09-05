"""Apply AquaSafe sync events to local mirror tables."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.sync import (
    ExtDistrict,
    ExtDistrictMembership,
    ExtModuleFlag,
    ExtUser,
    SyncCursor,
    SyncInbox,
    WaterDistrict,
)

logger = logging.getLogger(__name__)


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


def _upsert_district(db: Session, payload: dict[str, Any], version: int) -> None:
    code = payload["district_code"]
    row = db.query(ExtDistrict).filter(ExtDistrict.district_code == code).one_or_none()
    if row is None:
        row = ExtDistrict(id=int(payload["id"]), district_code=code)
        db.add(row)
    if row.version and row.version >= version:
        return
    row.district_name = payload.get("district_name", code)
    row.state_code = payload.get("state_code")
    row.is_active = bool(payload.get("is_active", True))
    row.version = version

    # Compatibility table for workforce FKs
    wd = db.query(WaterDistrict).filter(WaterDistrict.district_code == code).one_or_none()
    if wd is None:
        wd = WaterDistrict(id=int(payload["id"]), district_code=code)
        db.add(wd)
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


_HANDLERS = {
    "user": _upsert_user,
    "district": _upsert_district,
    "district_membership": _upsert_membership,
    "module_flag": _upsert_module_flag,
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
        row.processed_at = datetime.now(timezone.utc)
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
