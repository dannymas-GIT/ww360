"""District-configurable workforce alert thresholds."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

DEFAULT_CERT_EXPIRY_HORIZONS_DAYS = (30, 90, 180)
DEFAULT_RETIREMENT_HORIZON_MONTHS = (12, 24)
DEFAULT_CEU_SHORTFALL_LEAD_DAYS = 90


@dataclass
class WorkforceAlertSettings:
    enabled: bool = True
    cert_expiry_horizon_days: List[int] = field(
        default_factory=lambda: list(DEFAULT_CERT_EXPIRY_HORIZONS_DAYS)
    )
    retirement_horizon_months: List[int] = field(
        default_factory=lambda: list(DEFAULT_RETIREMENT_HORIZON_MONTHS)
    )
    ceu_shortfall_lead_days: int = DEFAULT_CEU_SHORTFALL_LEAD_DAYS
    ceu_requirements_by_grade: Dict[str, float] = field(default_factory=dict)
    notification_channels: List[str] = field(default_factory=lambda: ["in_app"])
    recipient_emails: List[str] = field(default_factory=list)
    scan_daily: bool = True


def _coerce_int_list(raw: Any, default: List[int]) -> List[int]:
    if not isinstance(raw, list):
        return default
    out = []
    for item in raw:
        try:
            out.append(int(item))
        except (TypeError, ValueError):
            continue
    return sorted(set(out)) or default


def parse_workforce_alert_settings(raw: Optional[Dict[str, Any]]) -> WorkforceAlertSettings:
    if not raw or not isinstance(raw, dict):
        return WorkforceAlertSettings()
    grade_raw = raw.get("ceu_requirements_by_grade") or {}
    grade_map = {}
    if isinstance(grade_raw, dict):
        for k, v in grade_raw.items():
            try:
                grade_map[str(k).upper()] = float(v)
            except (TypeError, ValueError):
                continue
    return WorkforceAlertSettings(
        enabled=bool(raw.get("enabled", True)),
        cert_expiry_horizon_days=_coerce_int_list(
            raw.get("cert_expiry_horizon_days"), list(DEFAULT_CERT_EXPIRY_HORIZONS_DAYS)
        ),
        retirement_horizon_months=_coerce_int_list(
            raw.get("retirement_horizon_months"), list(DEFAULT_RETIREMENT_HORIZON_MONTHS)
        ),
        ceu_shortfall_lead_days=int(raw.get("ceu_shortfall_lead_days", DEFAULT_CEU_SHORTFALL_LEAD_DAYS)),
        ceu_requirements_by_grade=grade_map,
        notification_channels=list(raw.get("notification_channels") or ["in_app"]),
        recipient_emails=list(raw.get("recipient_emails") or []),
        scan_daily=bool(raw.get("scan_daily", True)),
    )


def load_workforce_alert_settings(db: Session, district_code: str) -> WorkforceAlertSettings:
    try:
        row = db.execute(
            text(
                "SELECT config_data FROM district_configurations WHERE district_code = :dc"
            ),
            {"dc": district_code},
        ).fetchone()
    except Exception:
        return WorkforceAlertSettings()
    if not row or not row.config_data:
        return WorkforceAlertSettings()
    raw = row.config_data
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        return WorkforceAlertSettings()
    return parse_workforce_alert_settings(raw.get("workforce_alerts"))


def workforce_alerts_to_dict(settings: WorkforceAlertSettings) -> Dict[str, Any]:
    return {
        "enabled": settings.enabled,
        "cert_expiry_horizon_days": settings.cert_expiry_horizon_days,
        "retirement_horizon_months": settings.retirement_horizon_months,
        "ceu_shortfall_lead_days": settings.ceu_shortfall_lead_days,
        "ceu_requirements_by_grade": settings.ceu_requirements_by_grade,
        "notification_channels": settings.notification_channels,
        "recipient_emails": settings.recipient_emails,
        "scan_daily": settings.scan_daily,
    }
