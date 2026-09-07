#!/usr/bin/env python3
"""Seed Village of Hudson Falls Water Department (HFWD) mock district."""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.db.database import SessionLocal, init_db  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.water_district import WaterDistrict  # noqa: E402
from app.models.workforce_organization import (  # noqa: E402
    OrganizationDistrictMembership,
    WorkforceOrganization,
)
from app.models.workforce_succession import (  # noqa: E402
    WorkforceCertification,
    WorkforceCriticalFunction,
    WorkforceCeuRecord,
    WorkforceEmployee,
    WorkforcePosition,
    WorkforceRoleCoverage,
    WorkforceSuccessionCandidate,
)

DISTRICT_CODE = "HFWD"
DISTRICT_NAME = "Village of Hudson Falls Water Department"
NY_OWW = "NY_OWW"
DEFAULT_PASSWORD = "ChangeMe-HFWD!"


def _upsert_user(
    db,
    *,
    username: str,
    email: str,
    full_name: str,
    roles: list[str],
    password: str,
) -> User:
    user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        user = User(
            username=username,
            email=email,
            full_name=full_name,
            roles=roles,
            district_memberships=[DISTRICT_CODE],
            is_active=True,
        )
        user.set_password(password)
        db.add(user)
        db.flush()
        print(f"  created user {username}")
    else:
        user.roles = roles
        user.district_memberships = [DISTRICT_CODE]
        user.full_name = full_name
        user.email = email
        user.is_active = True
        if password:
            user.set_password(password)
        print(f"  updated user {username}")
    return user


def main() -> int:
    password = os.environ.get("WW360_SEED_DISTRICT_PASSWORD", DEFAULT_PASSWORD)
    init_db()
    db = SessionLocal()
    try:
        district = (
            db.query(WaterDistrict).filter(WaterDistrict.district_code == DISTRICT_CODE).one_or_none()
        )
        if not district:
            district = WaterDistrict(
                district_code=DISTRICT_CODE,
                district_name=DISTRICT_NAME,
                state_code="NY",
                mailing_address_line1="220 Main Street",
                mailing_address_line2="Hudson Falls, NY 12839",
                is_active=True,
            )
            db.add(district)
            print(f"Created district {DISTRICT_CODE}")
        else:
            district.district_name = DISTRICT_NAME
            if not getattr(district, "mailing_address_line1", None):
                district.mailing_address_line1 = "220 Main Street"
            if not getattr(district, "mailing_address_line2", None):
                district.mailing_address_line2 = "Hudson Falls, NY 12839"

        org = (
            db.query(WorkforceOrganization)
            .filter(WorkforceOrganization.org_code == NY_OWW)
            .one_or_none()
        )
        if not org:
            org = WorkforceOrganization(
                org_code=NY_OWW,
                name="NY Operator Workforce Works",
                org_type="state_program",
                is_active=True,
            )
            db.add(org)
        mem = (
            db.query(OrganizationDistrictMembership)
            .filter(
                OrganizationDistrictMembership.org_code == NY_OWW,
                OrganizationDistrictMembership.district_code == DISTRICT_CODE,
            )
            .one_or_none()
        )
        if not mem:
            db.add(
                OrganizationDistrictMembership(
                    id=str(uuid.uuid4()),
                    org_code=NY_OWW,
                    district_code=DISTRICT_CODE,
                )
            )

        admin = _upsert_user(
            db,
            username="hf-admin",
            email="admin@hudsonfalls-ny.gov",
            full_name="Patricia Chen",
            roles=["district_admin", "ceu_admin"],
            password=password,
        )
        manager = _upsert_user(
            db,
            username="hf-manager",
            email="manager@hudsonfalls-ny.gov",
            full_name="Marcus Webb",
            roles=["district_manager", "ceu_manager", "workforce_manager"],
            password=password,
        )
        op1 = _upsert_user(
            db,
            username="hf-operator-1",
            email="operator1@hudsonfalls-ny.gov",
            full_name="Jordan Ellis",
            roles=["ceu_user", "district_operator"],
            password=password,
        )
        op2 = _upsert_user(
            db,
            username="hf-operator-2",
            email="operator2@hudsonfalls-ny.gov",
            full_name="Sam Rivera",
            roles=["ceu_user", "district_operator"],
            password=password,
        )

        positions_spec = [
            ("CHIEF-OP", "Chief Operator", "Operations"),
            ("OP-IIA-1", "Grade IIA Operator", "Operations"),
            ("OP-IIA-2", "Grade IIA Operator", "Operations"),
            ("DIST-LEAD", "Distribution Lead", "Distribution"),
            ("LAB-TECH", "Lab Technician", "Laboratory"),
        ]
        pos_ids: dict[str, int] = {}
        for code, title, dept in positions_spec:
            row = (
                db.query(WorkforcePosition)
                .filter(
                    WorkforcePosition.district_code == DISTRICT_CODE,
                    WorkforcePosition.position_code == code,
                )
                .one_or_none()
            )
            if not row:
                row = WorkforcePosition(
                    district_code=DISTRICT_CODE,
                    position_code=code,
                    title=title,
                    department=dept,
                    fte_count=1,
                    is_funded=True,
                    is_vacant=False,
                )
                db.add(row)
                db.flush()
            pos_ids[code] = row.id

        today = date.today()
        employees_spec = [
            ("EMP-001", "Jordan Ellis", "OP-IIA-1", "IIA", op1.id, today - timedelta(days=2200)),
            ("EMP-002", "Sam Rivera", "OP-IIA-2", "IIA", op2.id, today - timedelta(days=1800)),
            ("EMP-003", "Marcus Webb", "CHIEF-OP", "IV", None, today - timedelta(days=4000)),
            ("EMP-004", "Avery Knox", "DIST-LEAD", "IIA", None, today - timedelta(days=1500)),
            ("EMP-005", "Riley Park", "LAB-TECH", None, None, today - timedelta(days=900)),
            ("EMP-006", "Casey Holt", "OP-IIA-1", "IIA", None, today - timedelta(days=600)),
        ]
        emp_ids: dict[str, int] = {}
        for ecode, name, pcode, grade, linked_uid, hire in employees_spec:
            row = (
                db.query(WorkforceEmployee)
                .filter(
                    WorkforceEmployee.district_code == DISTRICT_CODE,
                    WorkforceEmployee.employee_code == ecode,
                )
                .one_or_none()
            )
            if not row:
                row = WorkforceEmployee(
                    district_code=DISTRICT_CODE,
                    employee_code=ecode,
                    full_name=name,
                    position_code=pcode,
                    position_id=pos_ids.get(pcode),
                    operator_grade=grade,
                    linked_aquasafe_user_id=linked_uid,
                    hire_date=hire,
                    retirement_eligible_date=today + timedelta(days=800) if ecode == "EMP-003" else None,
                    planned_departure_date=today + timedelta(days=540) if ecode == "EMP-003" else None,
                    is_active=True,
                )
                db.add(row)
                db.flush()
            emp_ids[ecode] = row.id

        functions_spec = [
            ("FN-DIST-OPS", "Distribution system operations", "Distribution"),
            ("FN-CHLOR", "Chlorination & chemical feed", "Treatment"),
            ("FN-SAMPLE", "Regulatory sampling (coliform)", "Compliance"),
            ("FN-PUMP", "High-service pump maintenance", "Maintenance"),
        ]
        fn_ids: dict[str, int] = {}
        for fcode, fname, area in functions_spec:
            row = (
                db.query(WorkforceCriticalFunction)
                .filter(
                    WorkforceCriticalFunction.district_code == DISTRICT_CODE,
                    WorkforceCriticalFunction.function_code == fcode,
                )
                .one_or_none()
            )
            if not row:
                row = WorkforceCriticalFunction(
                    district_code=DISTRICT_CODE,
                    function_code=fcode,
                    function_name=fname,
                    function_area=area,
                )
                db.add(row)
                db.flush()
            fn_ids[fcode] = row.id

        coverage_spec = [
            ("FN-DIST-OPS", "EMP-001", "primary"),
            ("FN-DIST-OPS", "EMP-004", "backup"),
            ("FN-CHLOR", "EMP-002", "primary"),
            ("FN-CHLOR", "EMP-001", "backup"),
            ("FN-SAMPLE", "EMP-005", "primary"),
            ("FN-PUMP", "EMP-006", "trainee"),
        ]
        for fcode, ecode, role in coverage_spec:
            exists = (
                db.query(WorkforceRoleCoverage)
                .filter(
                    WorkforceRoleCoverage.district_code == DISTRICT_CODE,
                    WorkforceRoleCoverage.function_code == fcode,
                    WorkforceRoleCoverage.employee_code == ecode,
                    WorkforceRoleCoverage.coverage_role == role,
                )
                .one_or_none()
            )
            if not exists:
                db.add(
                    WorkforceRoleCoverage(
                        district_code=DISTRICT_CODE,
                        function_id=fn_ids[fcode],
                        function_code=fcode,
                        employee_id=emp_ids[ecode],
                        employee_code=ecode,
                        coverage_role=role,
                        proficiency_level="proficient" if role == "primary" else "developing",
                    )
                )

        for ecode, target, readiness in [
            ("EMP-006", "CHIEF-OP", "12-24mo"),
            ("EMP-004", "CHIEF-OP", "24-36mo"),
        ]:
            exists = (
                db.query(WorkforceSuccessionCandidate)
                .filter(
                    WorkforceSuccessionCandidate.district_code == DISTRICT_CODE,
                    WorkforceSuccessionCandidate.employee_code == ecode,
                    WorkforceSuccessionCandidate.target_position_code == target,
                )
                .one_or_none()
            )
            if not exists:
                db.add(
                    WorkforceSuccessionCandidate(
                        district_code=DISTRICT_CODE,
                        employee_code=ecode,
                        employee_id=emp_ids[ecode],
                        target_position_code=target,
                        target_position_id=pos_ids.get(target),
                        readiness_level=readiness,
                        notes="Capital Region bench candidate",
                    )
                )

        for ecode, hours in [("EMP-001", 18.0), ("EMP-002", 12.0)]:
            exists = (
                db.query(WorkforceCeuRecord)
                .filter(
                    WorkforceCeuRecord.district_code == DISTRICT_CODE,
                    WorkforceCeuRecord.employee_code == ecode,
                    WorkforceCeuRecord.course_title == "Distribution System Review",
                )
                .one_or_none()
            )
            if not exists:
                db.add(
                    WorkforceCeuRecord(
                        district_code=DISTRICT_CODE,
                        employee_code=ecode,
                        employee_id=emp_ids[ecode],
                        course_title="Distribution System Review",
                        provider="Learning Stream",
                        ceu_hours=hours,
                        completion_date=today - timedelta(days=45),
                        category="technical",
                    )
                )

        for ecode in ("EMP-001", "EMP-002"):
            exists = (
                db.query(WorkforceCertification)
                .filter(
                    WorkforceCertification.district_code == DISTRICT_CODE,
                    WorkforceCertification.employee_code == ecode,
                    WorkforceCertification.certification_type == "Operator",
                )
                .one_or_none()
            )
            if not exists:
                db.add(
                    WorkforceCertification(
                        district_code=DISTRICT_CODE,
                        employee_code=ecode,
                        employee_id=emp_ids[ecode],
                        certification_type="Operator",
                        certification_grade="IIA",
                        expiration_date=today + timedelta(days=120),
                        issued_date=today - timedelta(days=365 * 2),
                    )
                )

        db.commit()
        try:
            from app.services.workforce_succession.learning_stream_seed import (
                seed_learning_stream_catalog,
                seed_learning_stream_district_sessions,
            )

            seed_learning_stream_catalog(db)
            seed_learning_stream_district_sessions(db, district_code=DISTRICT_CODE)
            db.commit()
        except Exception as exc:
            print(f"Learning Stream seed skipped: {exc}")
        print(f"HFWD seed complete — password from WW360_SEED_DISTRICT_PASSWORD (default {DEFAULT_PASSWORD})")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
