"""Per-district workforce training settings (operator self-enroll toggle)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass
class WorkforceTrainingSettings:
    operator_self_enroll_enabled: bool = False


def parse_workforce_training_settings(raw: Optional[Dict[str, Any]]) -> WorkforceTrainingSettings:
    if not raw or not isinstance(raw, dict):
        return WorkforceTrainingSettings()
    return WorkforceTrainingSettings(
        operator_self_enroll_enabled=bool(raw.get("operator_self_enroll_enabled", False)),
    )


def load_workforce_training_settings(db: Session, district_code: str) -> WorkforceTrainingSettings:
    try:
        row = db.execute(
            text(
                "SELECT config_data FROM district_configurations WHERE district_code = :dc"
            ),
            {"dc": district_code},
        ).fetchone()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        return WorkforceTrainingSettings()
    if not row or not row.config_data:
        return WorkforceTrainingSettings()
    raw = row.config_data
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        return WorkforceTrainingSettings()
    return parse_workforce_training_settings(raw.get("workforce_training"))


def workforce_training_to_dict(settings: WorkforceTrainingSettings) -> Dict[str, Any]:
    return {
        "operator_self_enroll_enabled": settings.operator_self_enroll_enabled,
    }
