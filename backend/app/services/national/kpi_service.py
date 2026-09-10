"""KPI definition and snapshot management."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.national_metrics import ExternalMetricSnapshot, KpiDefinition, KpiSnapshot
from app.services.national.national_overview_service import build_national_overview


def list_kpis(db: Session, *, owner_scope: str | None, owner_code: str | None) -> list[KpiDefinition]:
    q = db.query(KpiDefinition)
    if owner_scope:
        q = q.filter(KpiDefinition.owner_scope == owner_scope)
    if owner_code:
        q = q.filter(KpiDefinition.owner_code == owner_code)
    return q.order_by(KpiDefinition.label).all()


def create_kpi(db: Session, *, data: dict[str, Any], created_by: int | None) -> KpiDefinition:
    row = KpiDefinition(
        id=str(uuid.uuid4()),
        owner_scope=data["owner_scope"],
        owner_code=data["owner_code"],
        metric_key=data["metric_key"],
        label=data["label"],
        target_value=data.get("target_value"),
        direction=data.get("direction") or "higher_better",
        warn_threshold=data.get("warn_threshold"),
        critical_threshold=data.get("critical_threshold"),
        cadence=data.get("cadence") or "monthly",
        created_by=created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_kpi(db: Session, kpi_id: str, data: dict[str, Any]) -> KpiDefinition | None:
    row = db.query(KpiDefinition).filter(KpiDefinition.id == kpi_id).first()
    if not row:
        return None
    for field in ("label", "target_value", "direction", "warn_threshold", "critical_threshold", "cadence"):
        if field in data and data[field] is not None:
            setattr(row, field, data[field])
    db.commit()
    db.refresh(row)
    return row


def compute_kpi_snapshots(db: Session) -> int:
    """Nightly job: snapshot values for all KPI definitions from external metrics."""
    defs = db.query(KpiDefinition).all()
    as_of = datetime.now(timezone.utc).strftime("%Y-%m")
    count = 0
    overview = build_national_overview(db)
    headline = overview.get("headline_kpis") or {}

    metric_map = {
        "workforce_replacement_gap.annual_openings": headline.get("workforce_replacement_gap", {}).get("annual_openings"),
        "compliance_pressure.health_violations": headline.get("compliance_pressure", {}).get("health_violation_systems"),
        "regulatory_workload.lead_service_lines": headline.get("regulatory_workload", {}).get("estimated_lead_service_lines"),
    }

    for d in defs:
        val = metric_map.get(d.metric_key)
        if val is None:
            snap = (
                db.query(ExternalMetricSnapshot)
                .filter(ExternalMetricSnapshot.metric_key == d.metric_key)
                .order_by(ExternalMetricSnapshot.fetched_at.desc())
                .first()
            )
            val = snap.value_numeric if snap else None
        db.add(
            KpiSnapshot(
                id=str(uuid.uuid4()),
                definition_id=d.id,
                as_of=as_of,
                value=float(val) if val is not None else None,
            )
        )
        count += 1
    db.commit()
    return count


def kpis_with_latest(db: Session, owner_scope: str, owner_code: str) -> list[dict[str, Any]]:
    defs = list_kpis(db, owner_scope=owner_scope, owner_code=owner_code)
    out = []
    for d in defs:
        snap = (
            db.query(KpiSnapshot)
            .filter(KpiSnapshot.definition_id == d.id)
            .order_by(KpiSnapshot.computed_at.desc())
            .first()
        )
        out.append(
            {
                "id": d.id,
                "label": d.label,
                "metric_key": d.metric_key,
                "target_value": d.target_value,
                "direction": d.direction,
                "warn_threshold": d.warn_threshold,
                "critical_threshold": d.critical_threshold,
                "current_value": snap.value if snap else None,
                "as_of": snap.as_of if snap else None,
            }
        )
    return out
