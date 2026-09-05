"""Per-district module entitlements stored in district_configurations.config_data."""

from __future__ import annotations

import json
from typing import Any, Dict, List

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.district_offline_config import ensure_district_configurations_table

MODULE_CORE = "core"
MODULE_LMS = "lms"
MODULE_WORKFORCE = "workforce"
ALL_MODULES = [MODULE_CORE, MODULE_LMS, MODULE_WORKFORCE]
DEFAULT_DISTRICT_MODULES = [MODULE_CORE]


class DistrictModuleConfig(BaseModel):
    """District-scoped enabled product modules."""

    enabled_modules: List[str] = Field(default_factory=lambda: list(DEFAULT_DISTRICT_MODULES))


DEFAULT_DISTRICT_MODULE_CONFIG = DistrictModuleConfig()


def _coerce_modules_payload(raw: Any) -> DistrictModuleConfig:
    if raw is None:
        return DEFAULT_DISTRICT_MODULE_CONFIG.model_copy()
    if isinstance(raw, DistrictModuleConfig):
        return raw
    if isinstance(raw, dict):
        return DistrictModuleConfig.model_validate(raw)
    return DEFAULT_DISTRICT_MODULE_CONFIG.model_copy()


def load_district_module_config(
    db: Session, district_code: str | None
) -> DistrictModuleConfig:
    """Load enabled modules for a district; defaults to core when missing."""
    if not district_code:
        return DEFAULT_DISTRICT_MODULE_CONFIG.model_copy()

    try:
        ensure_district_configurations_table(db)
        row = db.execute(
            text(
                """
                SELECT config_data
                FROM district_configurations
                WHERE district_code = :district_code
                """
            ),
            {"district_code": district_code},
        ).fetchone()
    except Exception:
        db.rollback()
        return DEFAULT_DISTRICT_MODULE_CONFIG.model_copy()

    if not row or not row.config_data:
        return DEFAULT_DISTRICT_MODULE_CONFIG.model_copy()

    data = row.config_data
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return DEFAULT_DISTRICT_MODULE_CONFIG.model_copy()

    if not isinstance(data, dict):
        return DEFAULT_DISTRICT_MODULE_CONFIG.model_copy()

    enabled = data.get("enabled_modules")
    if isinstance(enabled, list):
        modules = [str(m).strip() for m in enabled if str(m).strip() in ALL_MODULES]
        if modules:
            return DistrictModuleConfig(enabled_modules=modules)

    return DEFAULT_DISTRICT_MODULE_CONFIG.model_copy()


def save_district_module_config(
    db: Session,
    district_code: str,
    config: DistrictModuleConfig,
    user_id: int,
    district_name: str | None = None,
) -> DistrictModuleConfig:
    """Merge enabled_modules into district_configurations."""
    ensure_district_configurations_table(db)

    row = db.execute(
        text(
            """
            SELECT config_data
            FROM district_configurations
            WHERE district_code = :district_code
            """
        ),
        {"district_code": district_code},
    ).fetchone()

    if row and row.config_data:
        data = row.config_data
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                data = {}
        if not isinstance(data, dict):
            data = {}
    else:
        data = {}

    data["district_code"] = district_code
    if district_name:
        data["district_name"] = district_name
    data["enabled_modules"] = [
        m for m in config.enabled_modules if m in ALL_MODULES
    ] or list(DEFAULT_DISTRICT_MODULES)

    db.execute(
        text(
            """
            INSERT INTO district_configurations (district_code, config_data, updated_by)
            VALUES (:district_code, :config_data, :user_id)
            ON CONFLICT (district_code)
            DO UPDATE SET
                config_data = EXCLUDED.config_data,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = EXCLUDED.updated_by
            """
        ),
        {
            "district_code": district_code,
            "config_data": json.dumps(data),
            "user_id": user_id,
        },
    )
    db.commit()
    return config


def district_modules_public_payload(config: DistrictModuleConfig) -> Dict[str, Any]:
    return {"enabled_modules": list(config.enabled_modules)}
