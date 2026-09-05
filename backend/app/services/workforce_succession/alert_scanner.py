"""Workforce succession alert scanner.

Inspects the workforce dataset and emits alerts (using the existing ``alerts``
table) for the workforce-specific situations the Plan / Hire / Transition /
Sustain workflow must surface:

- Required certifications expiring within configurable horizons.
- Critical functions without a qualified backup ("coverage gap").
- Employees whose retirement-eligibility date is imminent.
- Transition milestones that are overdue.
- 30 / 60 / 90 / 180-day check-ins that are due.

The scanner is idempotent: it dedupes against existing open alerts using a
deterministic key embedded in ``Alert.notes`` so a daily run does not flood the
inbox. This is intentionally synchronous so it can be triggered by an admin
API endpoint, a scheduled task, or invoked from a test.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Optional, Sequence

from sqlalchemy.orm import Session

from app.models.alert import Alert, AlertSeverity, AlertStatus, AlertType
from app.models.workforce_succession import (
    WorkforceCertification,
    WorkforceCriticalFunction,
    WorkforceEmployee,
    WorkforceRoleCoverage,
    WorkforceTransitionMilestone,
)
from app.services.workforce_succession.ceu_service import compute_district_ceu_summaries
from app.services.workforce_succession.workforce_alert_settings import (
    WorkforceAlertSettings,
    load_workforce_alert_settings,
)

logger = logging.getLogger(__name__)


CERT_EXPIRY_HORIZONS_DAYS: Sequence[int] = (30, 90, 180)
RETIREMENT_HORIZON_MONTHS: Sequence[int] = (12, 24)
CHECKIN_MILESTONE_TYPES = ("checkin_30", "checkin_60", "checkin_90", "checkin_180")
DEDUP_PREFIX = "[workforce_succession]"


@dataclass
class ScanResult:
    district_code: str
    created: int = 0
    skipped_duplicate: int = 0
    summary: List[Dict] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.summary is None:
            self.summary = []


def _dedup_key(alert_type: AlertType, *parts: object) -> str:
    return f"{DEDUP_PREFIX}::{alert_type.value}::" + "::".join(
        str(p) if p is not None else "-" for p in parts
    )


def _existing_open_alert(db: Session, dedup_key: str) -> Optional[Alert]:
    return (
        db.query(Alert)
        .filter(
            Alert.notes.like(f"%{dedup_key}%"),
            Alert.status.in_((AlertStatus.NEW, AlertStatus.ACKNOWLEDGED)),
        )
        .first()
    )


def _create_alert(
    db: Session,
    *,
    alert_type: AlertType,
    severity: AlertSeverity,
    contaminant_name: Optional[str],
    notes_payload: Dict,
    dedup_key: str,
    workflow_group: str,
) -> Optional[Alert]:
    if _existing_open_alert(db, dedup_key):
        return None
    payload = dict(notes_payload)
    payload["dedup_key"] = dedup_key
    alert = Alert(
        alert_type=alert_type,
        severity=severity,
        contaminant_name=contaminant_name,
        notes=f"{dedup_key}\n{json.dumps(payload, default=str)}",
        status=AlertStatus.NEW,
        workflow_group=workflow_group,
        processor_type="workforce_succession_scanner",
    )
    db.add(alert)
    return alert


def _scan_certifications(
    db: Session,
    district_code: str,
    today: date,
    result: ScanResult,
    horizons: Sequence[int],
) -> None:
    rows = (
        db.query(WorkforceCertification, WorkforceEmployee.full_name)
        .outerjoin(
            WorkforceEmployee,
            (WorkforceEmployee.district_code == WorkforceCertification.district_code)
            & (WorkforceEmployee.employee_code == WorkforceCertification.employee_code),
        )
        .filter(
            WorkforceCertification.district_code == district_code,
            WorkforceCertification.record_status == "active",
            WorkforceCertification.expiration_date.isnot(None),
        )
        .all()
    )
    for cert, employee_name in rows:
        if cert.expiration_date is None:
            continue
        days_left = (cert.expiration_date - today).days
        horizon: Optional[int] = None
        for limit in horizons:
            if 0 <= days_left <= limit:
                horizon = limit
                break
        if horizon is None:
            continue
        severity = (
            AlertSeverity.CRITICAL
            if horizon <= 30 and cert.is_required_for_role
            else AlertSeverity.WARNING
        )
        dedup = _dedup_key(
            AlertType.WORKFORCE_CERT_EXPIRING,
            district_code,
            cert.id,
            horizon,
        )
        payload = {
            "kind": "certification_expiration",
            "district_code": district_code,
            "employee_code": cert.employee_code,
            "employee_name": employee_name,
            "certification_type": cert.certification_type,
            "certification_grade": cert.certification_grade,
            "expiration_date": cert.expiration_date,
            "days_until_expiration": days_left,
            "is_required_for_role": cert.is_required_for_role,
            "horizon_days": horizon,
        }
        created = _create_alert(
            db,
            alert_type=AlertType.WORKFORCE_CERT_EXPIRING,
            severity=severity,
            contaminant_name=None,
            notes_payload=payload,
            dedup_key=dedup,
            workflow_group="workforce_succession",
        )
        if created is None:
            result.skipped_duplicate += 1
        else:
            result.created += 1
            result.summary.append(payload)


def _scan_coverage_gaps(
    db: Session, district_code: str, _today: date, result: ScanResult
) -> None:
    functions = (
        db.query(WorkforceCriticalFunction)
        .filter(
            WorkforceCriticalFunction.district_code == district_code,
            WorkforceCriticalFunction.record_status == "active",
        )
        .all()
    )
    for fn in functions:
        primaries = (
            db.query(WorkforceRoleCoverage)
            .filter(
                WorkforceRoleCoverage.district_code == district_code,
                WorkforceRoleCoverage.function_code == fn.function_code,
                WorkforceRoleCoverage.coverage_role == "primary",
                WorkforceRoleCoverage.record_status == "active",
            )
            .count()
        )
        backups = (
            db.query(WorkforceRoleCoverage)
            .filter(
                WorkforceRoleCoverage.district_code == district_code,
                WorkforceRoleCoverage.function_code == fn.function_code,
                WorkforceRoleCoverage.coverage_role.in_(("backup", "interim")),
                WorkforceRoleCoverage.record_status == "active",
            )
            .count()
        )
        if backups > 0 and primaries > 0:
            continue
        severity = (
            AlertSeverity.VIOLATION
            if primaries == 0
            else AlertSeverity.WARNING
        )
        dedup = _dedup_key(
            AlertType.WORKFORCE_COVERAGE_GAP, district_code, fn.id
        )
        payload = {
            "kind": "coverage_gap",
            "district_code": district_code,
            "function_id": fn.id,
            "function_code": fn.function_code,
            "function_name": fn.function_name,
            "primary_count": primaries,
            "backup_count": backups,
            "linked_program": fn.linked_program,
        }
        created = _create_alert(
            db,
            alert_type=AlertType.WORKFORCE_COVERAGE_GAP,
            severity=severity,
            contaminant_name=None,
            notes_payload=payload,
            dedup_key=dedup,
            workflow_group="workforce_succession",
        )
        if created is None:
            result.skipped_duplicate += 1
        else:
            result.created += 1
            result.summary.append(payload)


def _months_between(d1: date, d2: date) -> int:
    return (d1.year - d2.year) * 12 + (d1.month - d2.month)


def _scan_retirement_horizon(
    db: Session,
    district_code: str,
    today: date,
    result: ScanResult,
    horizons: Sequence[int],
) -> None:
    employees = (
        db.query(WorkforceEmployee)
        .filter(
            WorkforceEmployee.district_code == district_code,
            WorkforceEmployee.record_status == "active",
            WorkforceEmployee.is_active.is_(True),
            WorkforceEmployee.retirement_eligible_date.isnot(None),
        )
        .all()
    )
    for emp in employees:
        if emp.retirement_eligible_date is None:
            continue
        months = _months_between(emp.retirement_eligible_date, today)
        if months < 0 or months > max(horizons):
            continue
        horizon = next((m for m in horizons if months <= m), None)
        if horizon is None:
            continue
        severity = (
            AlertSeverity.CRITICAL if months <= 12 else AlertSeverity.WARNING
        )
        dedup = _dedup_key(
            AlertType.WORKFORCE_RETIREMENT_HORIZON,
            district_code,
            emp.id,
            horizon,
        )
        payload = {
            "kind": "retirement_horizon",
            "district_code": district_code,
            "employee_id": emp.id,
            "employee_code": emp.employee_code,
            "employee_name": emp.full_name,
            "position_code": emp.position_code,
            "retirement_eligible_date": emp.retirement_eligible_date,
            "months_until_eligible": months,
            "horizon_months": horizon,
        }
        created = _create_alert(
            db,
            alert_type=AlertType.WORKFORCE_RETIREMENT_HORIZON,
            severity=severity,
            contaminant_name=None,
            notes_payload=payload,
            dedup_key=dedup,
            workflow_group="workforce_succession",
        )
        if created is None:
            result.skipped_duplicate += 1
        else:
            result.created += 1
            result.summary.append(payload)


def _scan_milestones(
    db: Session, district_code: str, today: date, result: ScanResult
) -> None:
    milestones = (
        db.query(WorkforceTransitionMilestone)
        .filter(
            WorkforceTransitionMilestone.district_code == district_code,
            WorkforceTransitionMilestone.record_status == "active",
            WorkforceTransitionMilestone.status.in_(
                ("planned", "in_progress", "blocked")
            ),
            WorkforceTransitionMilestone.target_date.isnot(None),
        )
        .all()
    )
    for m in milestones:
        if m.target_date is None:
            continue
        if m.target_date < today:
            alert_type = AlertType.WORKFORCE_MILESTONE_OVERDUE
            severity = AlertSeverity.CRITICAL
            kind = "milestone_overdue"
        elif (
            m.milestone_type in CHECKIN_MILESTONE_TYPES
            and (m.target_date - today) <= timedelta(days=14)
        ):
            alert_type = AlertType.WORKFORCE_CHECKIN_DUE
            severity = AlertSeverity.WARNING
            kind = "checkin_due"
        else:
            continue
        dedup = _dedup_key(alert_type, district_code, m.id)
        payload = {
            "kind": kind,
            "district_code": district_code,
            "milestone_id": m.id,
            "position_code": m.position_code,
            "milestone_type": m.milestone_type,
            "title": m.title,
            "target_date": m.target_date,
            "toolkit_phase": m.toolkit_phase,
            "status": m.status,
        }
        created = _create_alert(
            db,
            alert_type=alert_type,
            severity=severity,
            contaminant_name=None,
            notes_payload=payload,
            dedup_key=dedup,
            workflow_group="workforce_succession",
        )
        if created is None:
            result.skipped_duplicate += 1
        else:
            result.created += 1
            result.summary.append(payload)


def _scan_ceu_shortfall(
    db: Session,
    district_code: str,
    today: date,
    result: ScanResult,
    settings: WorkforceAlertSettings,
) -> None:
    summaries = compute_district_ceu_summaries(
        db,
        district_code,
        today=today,
        ceu_overrides=settings.ceu_requirements_by_grade or None,
        ceu_shortfall_lead_days=settings.ceu_shortfall_lead_days,
    )
    for summary in summaries:
        if not summary.get("needs_ceu_alert"):
            continue
        severity = (
            AlertSeverity.CRITICAL
            if summary.get("days_until_cycle_end", 999) <= 30
            else AlertSeverity.WARNING
        )
        dedup = _dedup_key(
            AlertType.WORKFORCE_CEU_SHORTFALL,
            district_code,
            summary.get("employee_code"),
            summary.get("renewal_cycle_end"),
        )
        payload = {
            "kind": "ceu_shortfall",
            "district_code": district_code,
            **{k: v for k, v in summary.items() if k != "needs_ceu_alert"},
        }
        from app.services.workforce_succession.scheduled_training_service import (
            recommend_trainings_for_operator,
        )

        payload["recommended_trainings"] = recommend_trainings_for_operator(
            db,
            district_code=district_code,
            certification_grade=summary.get("certification_grade"),
            remaining_hours=float(summary.get("remaining_hours") or 0),
            today=today,
        )
        created = _create_alert(
            db,
            alert_type=AlertType.WORKFORCE_CEU_SHORTFALL,
            severity=severity,
            contaminant_name=None,
            notes_payload=payload,
            dedup_key=dedup,
            workflow_group="workforce_succession",
        )
        if created is None:
            result.skipped_duplicate += 1
        else:
            result.created += 1
            result.summary.append(payload)


def _scan_missing_vouchers(
    db: Session,
    district_code: str,
    today: date,
    result: ScanResult,
    settings: WorkforceAlertSettings,
) -> None:
    summaries = compute_district_ceu_summaries(
        db,
        district_code,
        today=today,
        ceu_overrides=settings.ceu_requirements_by_grade or None,
        ceu_shortfall_lead_days=settings.ceu_shortfall_lead_days,
    )
    for summary in summaries:
        missing = int(summary.get("records_missing_vouchers") or 0)
        if missing <= 0:
            continue
        days_left = int(summary.get("days_until_cycle_end") or 999)
        if days_left > settings.ceu_shortfall_lead_days:
            continue
        dedup = _dedup_key(
            AlertType.WORKFORCE_CEU_SHORTFALL,
            district_code,
            summary.get("employee_code"),
            "missing_vouchers",
            summary.get("renewal_cycle_end"),
        )
        payload = {
            "kind": "ceu_missing_vouchers",
            "district_code": district_code,
            "records_missing_vouchers": missing,
            **{k: v for k, v in summary.items() if k != "needs_ceu_alert"},
        }
        created = _create_alert(
            db,
            alert_type=AlertType.WORKFORCE_CEU_SHORTFALL,
            severity=AlertSeverity.WARNING,
            contaminant_name=None,
            notes_payload=payload,
            dedup_key=dedup,
            workflow_group="workforce_succession",
        )
        if created is None:
            result.skipped_duplicate += 1
        else:
            result.created += 1
            result.summary.append(payload)


def _notify_workforce_alerts(
    db: Session, district_code: str, settings: WorkforceAlertSettings, result: ScanResult
) -> None:
    if not settings.enabled or result.created == 0:
        return
    if "email" not in settings.notification_channels:
        return
    if not settings.recipient_emails:
        return
    try:
        from app.services.notification_service import (
            NotificationPayload,
            get_notification_service,
        )

        svc = get_notification_service()
        payload = NotificationPayload(
            title=f"Workforce alerts for {district_code}",
            body=f"{result.created} new workforce alert(s) were created.",
            channels=["email"],
            metadata={"district_code": district_code, "summary": result.summary[:10]},
        )
        for email in settings.recipient_emails:
            email_payload = NotificationPayload(
                title=payload.title,
                body=f"{payload.body} Notify: {email}",
                channels=["email"],
                metadata={**payload.metadata, "recipient": email},
            )
            svc.send(email_payload)
    except Exception as exc:
        logger.warning("Workforce notification dispatch failed: %s", exc)


def scan_district(
    db: Session,
    district_code: str,
    today: Optional[date] = None,
    settings: Optional[WorkforceAlertSettings] = None,
) -> ScanResult:
    """Run the full workforce alert scanner for a single district.

    The scanner commits its own changes before returning so partial failures in
    a multi-district run do not roll back already-created alerts.
    """
    today = today or date.today()
    result = ScanResult(district_code=district_code)
    cfg = settings or load_workforce_alert_settings(db, district_code)
    if not cfg.enabled:
        return result

    cert_horizons = tuple(cfg.cert_expiry_horizon_days or CERT_EXPIRY_HORIZONS_DAYS)
    retirement_horizons = tuple(cfg.retirement_horizon_months or RETIREMENT_HORIZON_MONTHS)

    _scan_certifications(db, district_code, today, result, cert_horizons)
    _scan_coverage_gaps(db, district_code, today, result)
    _scan_retirement_horizon(db, district_code, today, result, retirement_horizons)
    _scan_milestones(db, district_code, today, result)
    _scan_ceu_shortfall(db, district_code, today, result, cfg)
    _scan_missing_vouchers(db, district_code, today, result, cfg)

    db.commit()
    _notify_workforce_alerts(db, district_code, cfg, result)
    logger.info(
        "Workforce alert scan complete: district=%s created=%s deduped=%s",
        district_code,
        result.created,
        result.skipped_duplicate,
    )
    return result


def scan_all_districts(
    db: Session, district_codes: Sequence[str], today: Optional[date] = None
) -> List[ScanResult]:
    return [scan_district(db, code, today) for code in district_codes]
