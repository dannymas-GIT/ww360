#!/usr/bin/env python3
"""Seed NY Operator Workforce Works (NY OWW) organization and sample district memberships."""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))

from sqlalchemy.orm import Session  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models.workforce_organization import (  # noqa: E402
    OrganizationDistrictMembership,
    WorkforceOrganization,
)

NY_OWW_CODE = "NY_OWW"
DEFAULT_DISTRICTS = ["WHWD", "FSWD"]


def seed(db: Session, district_codes: list[str], dry_run: bool = False) -> None:
    org = db.query(WorkforceOrganization).filter(
        WorkforceOrganization.org_code == NY_OWW_CODE
    ).first()
    if not org:
        org = WorkforceOrganization(
            org_code=NY_OWW_CODE,
            name="NY Operator Workforce Works",
            org_type="state_program",
            state_code="NY",
            partner_label="One Water Workforce",
            section_label="New York Section AWWA",
            content_pack_key="NY",
            contact_name="NY OWW Program Office",
            contact_email="oww@health.ny.gov",
            website_url="https://www.health.ny.gov/environmental/water/drinking/oww/",
            notes="Pilot partner — free AquaSafe workforce continuity tooling.",
            is_active=True,
        )
        if not dry_run:
            db.add(org)
        print(f"Created organization {NY_OWW_CODE}")
    else:
        print(f"Organization {NY_OWW_CODE} already exists")

    for code in district_codes:
        exists = (
            db.query(OrganizationDistrictMembership)
            .filter(
                OrganizationDistrictMembership.org_code == NY_OWW_CODE,
                OrganizationDistrictMembership.district_code == code,
            )
            .first()
        )
        if exists:
            print(f"  Membership {NY_OWW_CODE} ↔ {code} already exists")
            continue
        row = OrganizationDistrictMembership(
            id=str(uuid.uuid4()),
            org_code=NY_OWW_CODE,
            district_code=code,
        )
        if not dry_run:
            db.add(row)
        print(f"  Linked district {code}")

    if not dry_run:
        db.commit()
    print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--districts",
        nargs="*",
        default=DEFAULT_DISTRICTS,
        help="District codes to link to NY OWW",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    db = SessionLocal()
    try:
        seed(db, [d.upper() for d in args.districts], dry_run=args.dry_run)
    finally:
        db.close()


if __name__ == "__main__":
    main()
