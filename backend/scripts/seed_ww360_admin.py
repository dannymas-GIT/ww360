#!/usr/bin/env python3
"""Seed WW360 admin user (Jenny) and WW360 district."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.security import get_password_hash
from app.db.database import SessionLocal, init_db
from app.models.user import User
from app.models.water_district import WaterDistrict


def main() -> None:
    password = os.environ.get("WW360_SEED_ADMIN_PASSWORD", "ChangeMe-WW360!")
    db = SessionLocal()
    try:
        district = db.query(WaterDistrict).filter(WaterDistrict.district_code == "WW360").one_or_none()
        if not district:
            district = WaterDistrict(
                district_code="WW360",
                district_name="One Water Workforce Program",
                state_code="NY",
                is_active=True,
            )
            db.add(district)

        user = db.query(User).filter(User.username == "jingrao-aman-OWW").one_or_none()
        if not user:
            user = User(
                username="jingrao-aman-OWW",
                email="jingrao@onewaterworkforce.org",
                full_name="Jenny Ingrao",
                roles=["platform_admin", "oww_partner"],
                is_active=True,
            )
            user.set_password(password)
            db.add(user)
        else:
            user.roles = ["platform_admin", "oww_partner"]
            if password and password != "ChangeMe-WW360!":
                user.hashed_password = get_password_hash(password)

        db.commit()
        print("Seeded jingrao-aman-OWW with platform_admin + oww_partner")
    finally:
        db.close()


if __name__ == "__main__":
    main()
