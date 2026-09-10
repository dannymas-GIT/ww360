"""Workforce alert scanner — cert expiry, CEU shortfall, retirement horizon."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, List

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User
from app.models.water_district import WaterDistrict
from app.models.workforce_succession import (
    WorkforceCertification,
    WorkforceCeuRecord,
    WorkforceEmployee,
)
from app.services.notification_service import create_notification
from app.services.workforce_succession.workforce_alert_settings import (
    load_workforce_alert_settings,
)


@dataclass
class ScanResult:
    district_code: str
    created: int = 0
    skipped_duplicate: int = 0
    summary: List[Dict] = field(default_factory=list)


def _recent_duplicate(
    db: Session, user_id: int, category: str, title: str, days: int = 7
) -> bool:
    since = date.today() - timedelta(days=days)
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.category == category,
            Notification.title == title,
            Notification.created_at >= since,
        )
        .first()
        is not None
    )


def _district_managers(db: Session, district_code: str) -> list[User]:
    rows = db.query(User).all()
    out = []
    for u in rows:
        memberships = list(u.district_memberships or [])
        if district_code not in memberships:
            continue
        roles = set(u.roles or [])
        if roles & {"district_manager", "district_admin", "ceu_manager", "workforce_manager"}:
            out.append(u)
    return out


def scan_district(db: Session, district_code: str) -> ScanResult:
    result = ScanResult(district_code=district_code)
    settings = load_workforce_alert_settings(db, district_code)
    if not settings.enabled:
        return result

    today = date.today()
    managers = _district_managers(db, district_code)

    # Cert expiry
    for horizon in settings.cert_expiry_horizon_days:
        cutoff = today + timedelta(days=horizon)
        certs = (
            db.query(WorkforceCertification)
            .filter(
                WorkforceCertification.district_code == district_code,
                WorkforceCertification.record_status == "active",
                WorkforceCertification.expiration_date.isnot(None),
                WorkforceCertification.expiration_date <= cutoff,
                WorkforceCertification.expiration_date >= today,
            )
            .all()
        )
        for cert in certs:
            title = f"Cert expiring ({horizon}d): {cert.certification_type} {cert.employee_code}"
            for mgr in managers:
                if _recent_duplicate(db, mgr.id, "cert_expiry", title):
                    result.skipped_duplicate += 1
                    continue
                create_notification(
                    db,
                    user_id=mgr.id,
                    district_code=district_code,
                    category="cert_expiry",
                    title=title,
                    body=f"Expires {cert.expiration_date}",
                    link_path="/continuity",
                    send_email="email" in settings.notification_channels,
                )
                result.created += 1
            result.summary.append({"type": "cert_expiry", "employee": cert.employee_code})

    # Retirement horizon
    for months in settings.retirement_horizon_months:
        cutoff = today + timedelta(days=months * 30)
        employees = (
            db.query(WorkforceEmployee)
            .filter(
                WorkforceEmployee.district_code == district_code,
                WorkforceEmployee.record_status == "active",
                WorkforceEmployee.planned_departure_date.isnot(None),
                WorkforceEmployee.planned_departure_date <= cutoff,
                WorkforceEmployee.planned_departure_date >= today,
            )
            .all()
        )
        for emp in employees:
            title = f"Retirement horizon ({months}mo): {emp.full_name}"
            for mgr in managers:
                if _recent_duplicate(db, mgr.id, "retirement", title):
                    result.skipped_duplicate += 1
                    continue
                create_notification(
                    db,
                    user_id=mgr.id,
                    district_code=district_code,
                    category="retirement",
                    title=title,
                    body=f"Planned departure {emp.planned_departure_date}",
                    link_path="/continuity",
                    send_email="email" in settings.notification_channels,
                )
                result.created += 1

    # CEU shortfall (simplified: compare hours vs grade requirement)
    grade_req = settings.ceu_requirements_by_grade or {"IIA": 24.0}
    lead = today + timedelta(days=settings.ceu_shortfall_lead_days)
    employees = (
        db.query(WorkforceEmployee)
        .filter(
            WorkforceEmployee.district_code == district_code,
            WorkforceEmployee.record_status == "active",
            WorkforceEmployee.operator_grade.isnot(None),
        )
        .all()
    )
    for emp in employees:
        grade = (emp.operator_grade or "").upper()
        required = grade_req.get(grade)
        if not required:
            continue
        records = (
            db.query(WorkforceCeuRecord)
            .filter(
                WorkforceCeuRecord.district_code == district_code,
                WorkforceCeuRecord.employee_code == emp.employee_code,
                WorkforceCeuRecord.record_status == "active",
                WorkforceCeuRecord.completion_date >= today - timedelta(days=365),
            )
            .all()
        )
        earned = sum(r.ceu_hours or 0 for r in records)
        if earned >= required:
            continue
        if emp.retirement_eligible_date and emp.retirement_eligible_date > lead:
            continue
        title = f"CEU shortfall: {emp.full_name} ({earned:.1f}/{required} hrs)"
        for mgr in managers:
            if _recent_duplicate(db, mgr.id, "ceu_shortfall", title):
                result.skipped_duplicate += 1
                continue
            create_notification(
                db,
                user_id=mgr.id,
                district_code=district_code,
                category="ceu_shortfall",
                title=title,
                link_path="/continuity/ceu-training",
                send_email="email" in settings.notification_channels,
            )
            result.created += 1

    return result


def scan_all_districts(db: Session) -> List[ScanResult]:
    codes = [
        r.district_code
        for r in db.query(WaterDistrict).filter(WaterDistrict.is_active.is_(True)).all()
    ]
    return [scan_district(db, code) for code in codes]
