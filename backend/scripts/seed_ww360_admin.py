#!/usr/bin/env python3
"""Seed WW360 state-partner admin (Jenny) and WW360 district."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.user import User
from app.models.water_district import WaterDistrict

# State / section partner — not platform (national) admin.
JENNY_ROLES = ["state_admin", "oww_partner"]


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

        user = (
            db.query(User)
            .filter(User.username.in_(["jenny-oww", "jingrao-aman-OWW"]))
            .one_or_none()
        )
        if not user:
            user = User(
                username="jenny-oww",
                email="jingrao@onewaterworkforce.org",
                full_name="Jenny Ingrao",
                roles=list(JENNY_ROLES),
                is_active=True,
            )
            user.set_password(password)
            db.add(user)
        else:
            user.username = "jenny-oww"
            user.roles = list(JENNY_ROLES)
            if password and password != "ChangeMe-WW360!":
                user.hashed_password = get_password_hash(password)

        db.commit()
        print(f"Seeded jenny-oww with {' + '.join(JENNY_ROLES)} (state-level, not platform_admin)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
