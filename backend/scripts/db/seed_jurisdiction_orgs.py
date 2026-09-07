#!/usr/bin/env python3
"""Seed NY OWW + stub NJ org, org user memberships, and jurisdiction branding."""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))

from sqlalchemy.orm import Session  # noqa: E402

from app.db.database import init_db  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.workforce_organization import (  # noqa: E402
    OrganizationUserMembership,
    WorkforceOrganization,
)

NY_OWW_CODE = "NY_OWW"
NJ_OWW_CODE = "NJ_OWW"


def _upsert_org(
    db: Session,
    *,
    org_code: str,
    name: str,
    state_code: str,
    partner_label: str,
    section_label: str,
    website_url: str | None = None,
    dry_run: bool = False,
) -> WorkforceOrganization | None:
    org = db.query(WorkforceOrganization).filter(WorkforceOrganization.org_code == org_code).first()
    if org:
        org.state_code = state_code
        org.partner_label = partner_label
        org.section_label = section_label
        org.content_pack_key = state_code
        if website_url:
            org.website_url = website_url
        print(f"Updated organization {org_code}")
        return org
    org = WorkforceOrganization(
        org_code=org_code,
        name=name,
        org_type="state_program",
        state_code=state_code,
        partner_label=partner_label,
        section_label=section_label,
        content_pack_key=state_code,
        website_url=website_url,
        is_active=True,
    )
    if not dry_run:
        db.add(org)
    print(f"Created organization {org_code}")
    return org


def _ensure_membership(
    db: Session,
    *,
    user_id: int,
    org_code: str,
    role: str = "state_admin",
    dry_run: bool = False,
) -> None:  # noqa: PLR0913
    exists = (
        db.query(OrganizationUserMembership)
        .filter(
            OrganizationUserMembership.user_id == user_id,
            OrganizationUserMembership.org_code == org_code,
        )
        .first()
    )
    if exists:
        print(f"  Membership user {user_id} ↔ {org_code} already exists")
        return
    row = OrganizationUserMembership(
        id=str(uuid.uuid4()),
        user_id=user_id,
        org_code=org_code,
        role=role,
    )
    if not dry_run:
        db.add(row)
    print(f"  Linked user {user_id} → {org_code} ({role})")


def seed(db: Session, dry_run: bool = False) -> None:
    _upsert_org(
        db,
        org_code=NY_OWW_CODE,
        name="NY Operator Workforce Works",
        state_code="NY",
        partner_label="One Water Workforce",
        section_label="New York Section AWWA",
        website_url="https://www.health.ny.gov/environmental/water/drinking/oww/",
        dry_run=dry_run,
    )
    _upsert_org(
        db,
        org_code=NJ_OWW_CODE,
        name="NJ Water Workforce Coalition",
        state_code="NJ",
        partner_label="NJ Water Workforce Coalition",
        section_label="New Jersey Section AWWA",
        dry_run=dry_run,
    )

    jenny = db.query(User).filter(User.username == "jingrao-aman-OWW").first()
    if jenny:
        _ensure_membership(db, user_id=jenny.id, org_code=NY_OWW_CODE, dry_run=dry_run)

    demo = db.query(User).filter(User.username == "nj-state-admin").first()
    if not demo and not dry_run:
        demo = User(
            username="nj-state-admin",
            email="state-admin@njwaterworkforce.org",
            full_name="Elena Vasquez",
            roles=["state_admin"],
            is_active=True,
        )
        demo.set_password("ChangeMe-NJ!")
        db.add(demo)
        db.flush()
        print("Created demo user nj-state-admin")
    if demo:
        _ensure_membership(db, user_id=demo.id, org_code=NJ_OWW_CODE, dry_run=dry_run)

    national = db.query(User).filter(User.username == "ww360-national").first()
    if not national and not dry_run:
        national = User(
            username="ww360-national",
            email="national@waterworkforce360.org",
            full_name="Alex Morgan (National)",
            roles=["platform_admin"],
            is_active=True,
        )
        national.set_password("ChangeMe-National!")
        db.add(national)
        db.flush()
        print("Created demo user ww360-national")
    if national:
        _ensure_membership(db, user_id=national.id, org_code=NY_OWW_CODE, role="platform_observer", dry_run=dry_run)
        _ensure_membership(db, user_id=national.id, org_code=NJ_OWW_CODE, role="platform_observer", dry_run=dry_run)

    if not dry_run:
        db.commit()
    print("Done. For full NJ district sample data run: python scripts/seed_national_nj_demo.py")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    init_db()
    db = SessionLocal()
    try:
        seed(db, dry_run=args.dry_run)
    finally:
        db.close()


if __name__ == "__main__":
    main()
