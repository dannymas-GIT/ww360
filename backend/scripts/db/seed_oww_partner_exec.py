#!/usr/bin/env python3
"""Seed a One Water Workforce platform-partner executive account.

Creates (or updates) the user, registers the ``oww_partner`` role definition,
and grants two global-scope roles:

* ``platform_admin`` — platform privileges (all modules / districts)
* ``oww_partner``    — routes the user to the OWW executive workspace

Idempotent: safe to re-run. Passwords are only changed when ``--password`` or
``--rotate-password`` is supplied.

Example (staging utility, inside the backend container)::

    python scripts/db/seed_oww_partner_exec.py --rotate-password
"""

from __future__ import annotations

import argparse
import secrets
import string
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from sqlalchemy import inspect, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

# Import the services package first: app.models.__init__ -> sampling_schedule ->
# app.services -> alert_service -> app.models.sampling_schedule is circular when
# a model module is the first thing imported.
import app.services  # noqa: E402,F401

from app.core.security import get_password_hash  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.role import RoleDefinition  # noqa: E402
from app.models.user import User  # noqa: E402
from app.tenant_auth import Roles  # noqa: E402

DEFAULT_USERNAME = "jenny-oww"
DEFAULT_EMAIL = "jingrao-aman@onewaterworkforce.org"
DEFAULT_FIRST = "Jenny"
DEFAULT_LAST = "Ingrao-Aman"
GRANT_ROLES = [Roles.PLATFORM_ADMIN, Roles.OWW_PARTNER]

ROLE_DEFINITIONS = [
    {
        "role_name": Roles.OWW_PARTNER,
        "display_name": "One Water Workforce partner",
        "description": (
            "Program-partner executive (NYSAWWA / One Water Workforce). Lands on the "
            "OWW executive workspace; pair with platform_admin for platform privileges. "
            "Utility-level detail follows each utility's data-sharing consent."
        ),
        "scope": "global",
    },
]


def generate_password(length: int = 18) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#%^*-_"
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in pw)
            and any(c.isupper() for c in pw)
            and any(c.isdigit() for c in pw)
            and any(c in "!@#%^*-_" for c in pw)
        ):
            return pw


def ensure_role_definitions(db: Session, dry_run: bool) -> None:
    # The role catalog is optional (some tenants never ran the role_definitions
    # migration). Role grants in user_roles work without it.
    if not inspect(db.get_bind()).has_table("role_definitions"):
        print("role_definitions: table not present on this database — skipping catalog row")
        return
    for spec in ROLE_DEFINITIONS:
        existing = (
            db.query(RoleDefinition)
            .filter(
                RoleDefinition.role_name == spec["role_name"],
                RoleDefinition.district_code.is_(None),
            )
            .first()
        )
        if existing:
            print(f"role_definitions: {spec['role_name']} already present")
            continue
        row = RoleDefinition(
            role_name=spec["role_name"],
            display_name=spec["display_name"],
            description=spec["description"],
            district_code=None,
            scope=spec["scope"],
            is_system_role=True,
            is_active=True,
        )
        if not dry_run:
            db.add(row)
        print(f"role_definitions: added {spec['role_name']} (scope={spec['scope']})")


def ensure_user(
    db: Session,
    *,
    username: str,
    email: str,
    first_name: str,
    last_name: str,
    password: str | None,
    dry_run: bool,
) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
    if user:
        user.username = username
        user.email = email
        user.first_name = first_name
        user.last_name = last_name
        user.is_active = True
        user.default_role = Roles.PLATFORM_ADMIN
        user.login_attempts = 0
        user.locked_until = None
        if password:
            user.hashed_password = get_password_hash(password)
        print(f"users: updated {username} (id={user.id})")
    else:
        if not password:
            raise SystemExit("New user requires a password (use --password or --rotate-password)")
        user = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_superuser=False,
            default_role=Roles.PLATFORM_ADMIN,
            primary_district=None,
        )
        if not dry_run:
            db.add(user)
            db.flush()
        print(f"users: created {username}")
    return user


def ensure_roles(db: Session, user_id: int, dry_run: bool) -> None:
    for role_name in GRANT_ROLES:
        exists = db.execute(
            text(
                """
                SELECT 1 FROM user_roles
                WHERE user_id = :uid AND role_name = :role AND district_code IS NULL
                """
            ),
            {"uid": user_id, "role": role_name},
        ).fetchone()
        if exists:
            db.execute(
                text(
                    """
                    UPDATE user_roles SET is_active = true
                    WHERE user_id = :uid AND role_name = :role AND district_code IS NULL
                    """
                ),
                {"uid": user_id, "role": role_name},
            )
            print(f"user_roles: {role_name} already granted (ensured active)")
            continue
        if not dry_run:
            db.execute(
                text(
                    """
                    INSERT INTO user_roles (user_id, role_name, district_code, is_active)
                    VALUES (:uid, :role, NULL, true)
                    """
                ),
                {"uid": user_id, "role": role_name},
            )
        print(f"user_roles: granted {role_name} (global scope)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--username", default=DEFAULT_USERNAME)
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--first-name", default=DEFAULT_FIRST)
    parser.add_argument("--last-name", default=DEFAULT_LAST)
    parser.add_argument("--password", help="Set this exact password")
    parser.add_argument(
        "--rotate-password",
        action="store_true",
        help="Generate a strong temporary password and print it",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    password = args.password
    if args.rotate_password and not password:
        password = generate_password()

    db = SessionLocal()
    try:
        ensure_role_definitions(db, args.dry_run)
        user = ensure_user(
            db,
            username=args.username,
            email=args.email,
            first_name=args.first_name,
            last_name=args.last_name,
            password=password,
            dry_run=args.dry_run,
        )
        if not args.dry_run:
            ensure_roles(db, user.id, args.dry_run)
            db.commit()
        else:
            print("dry-run: no changes committed")
    finally:
        db.close()

    print("")
    print(f"Login:    {args.username}")
    print(f"Roles:    {', '.join(GRANT_ROLES)}")
    if password:
        print(f"Password: {password}")
    print("Home:     /dashboard/oww (waterworkforce360.org)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
