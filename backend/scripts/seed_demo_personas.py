#!/usr/bin/env python3
"""Seed demo personas for impersonation switcher and national/state role UX."""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.db.database import SessionLocal, init_db  # noqa: E402
from app.models.impersonation import DemoPersona  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.water_district import WaterDistrict  # noqa: E402
from app.models.workforce_organization import (  # noqa: E402
    OrganizationDistrictMembership,
    OrganizationUserMembership,
    WorkforceOrganization,
)

DEFAULT_PASSWORD = os.environ.get("WW360_SEED_DEMO_PASSWORD", "ChangeMe-Demo!")
NY_OWW = "NY_OWW"
NJ_OWW = "NJ_OWW"
NY_DOH = "NY_DOH_BWSP"
US_PLATFORM = "US_PLATFORM"
MCWA = "MCWA"


def _upsert_user(
    db,
    *,
    username: str,
    email: str,
    full_name: str,
    roles: list[str],
    password: str,
    districts: list[str] | None = None,
) -> User:
    user = db.query(User).filter(User.username == username).one_or_none()
    if not user:
        user = User(
            username=username,
            email=email,
            full_name=full_name,
            roles=roles,
            district_memberships=districts or [],
            is_active=True,
        )
        user.set_password(password)
        db.add(user)
        db.flush()
        print(f"  created user {username}")
    else:
        user.roles = roles
        user.district_memberships = districts or []
        user.full_name = full_name
        user.email = email
        user.is_active = True
        if password:
            user.set_password(password)
        print(f"  updated user {username}")
    return user


def _ensure_org(db, **kwargs) -> None:
    org = db.query(WorkforceOrganization).filter(
        WorkforceOrganization.org_code == kwargs["org_code"]
    ).one_or_none()
    if not org:
        org = WorkforceOrganization(**kwargs, is_active=True)
        db.add(org)
        print(f"  created org {kwargs['org_code']}")
    else:
        for k, v in kwargs.items():
            setattr(org, k, v)
        org.is_active = True
        print(f"  updated org {kwargs['org_code']}")


def _ensure_org_user(db, user_id: int, org_code: str, role: str) -> None:
    row = (
        db.query(OrganizationUserMembership)
        .filter(
            OrganizationUserMembership.user_id == user_id,
            OrganizationUserMembership.org_code == org_code,
        )
        .one_or_none()
    )
    if not row:
        db.add(OrganizationUserMembership(user_id=user_id, org_code=org_code, role=role))


def _ensure_district(db, code: str, name: str, state: str = "NY") -> None:
    d = db.query(WaterDistrict).filter(WaterDistrict.district_code == code).one_or_none()
    if not d:
        d = WaterDistrict(
            district_code=code,
            district_name=name,
            state_code=state,
            is_active=True,
        )
        db.add(d)
        print(f"  created district {code}")
    else:
        d.district_name = name
        d.state_code = state
        d.is_active = True


def _ensure_org_district(db, org_code: str, district_code: str) -> None:
    row = (
        db.query(OrganizationDistrictMembership)
        .filter(
            OrganizationDistrictMembership.org_code == org_code,
            OrganizationDistrictMembership.district_code == district_code,
        )
        .one_or_none()
    )
    if not row:
        db.add(
            OrganizationDistrictMembership(
                org_code=org_code,
                district_code=district_code,
                workforce_package_enabled=True,
            )
        )


def _upsert_persona(db, **kwargs) -> None:
    p = db.query(DemoPersona).filter(DemoPersona.persona_key == kwargs["persona_key"]).one_or_none()
    if not p:
        p = DemoPersona(**kwargs, is_active=1)
        db.add(p)
    else:
        for k, v in kwargs.items():
            setattr(p, k, v)
        p.is_active = 1


PERSONAS: list[dict] = []


def main() -> int:
    init_db()
    db = SessionLocal()
    pwd = DEFAULT_PASSWORD
    try:
        _ensure_org(
            db,
            org_code=NY_DOH,
            name="NYSDOH Bureau of Water Supply Protection",
            org_type="regulator",
            state_code="NY",
            partner_label="NYSDOH",
            section_label="Operator Certification",
            content_pack_key="NY",
        )
        _ensure_org(
            db,
            org_code=US_PLATFORM,
            name="Water Workforce 360 National",
            org_type="national",
            state_code="US",
            parent_org_code=None,
            partner_label="WW360",
            section_label="National platform",
            content_pack_key="US",
        )
        from app.services.national_hierarchy_service import link_state_programs_to_national

        link_state_programs_to_national(db)
        _ensure_district(
            db,
            MCWA,
            "Monroe County Water Authority",
            "NY",
        )
        _ensure_org_district(db, NY_OWW, MCWA)

        national = _upsert_user(
            db,
            username="aquasafe-admin",
            email="national@aquasafe-solutions.us",
            full_name="AquaSafe Platform Admin",
            roles=["platform_admin"],
            password=pwd,
        )
        _ensure_org_user(db, national.id, NY_OWW, "platform_observer")
        _ensure_org_user(db, national.id, NJ_OWW, "platform_observer")
        _ensure_org_user(db, national.id, US_PLATFORM, "platform_observer")

        epa_lead = _upsert_user(
            db,
            username="us-epa-workforce-lead",
            email="workforce@epa.gov",
            full_name="EPA Water Workforce Lead",
            roles=["national_observer"],
            password=pwd,
        )
        _ensure_org_user(db, epa_lead.id, US_PLATFORM, "platform_observer")

        asdwa = _upsert_user(
            db,
            username="us-asdwa-program-director",
            email="programs@asdwa.org",
            full_name="ASDWA Program Director",
            roles=["national_observer"],
            password=pwd,
        )
        _ensure_org_user(db, asdwa.id, US_PLATFORM, "platform_observer")

        awwa_hq = _upsert_user(
            db,
            username="us-awwa-workforce-director",
            email="workforce@awwa.org",
            full_name="AWWA Workforce Director",
            roles=["national_observer"],
            password=pwd,
        )
        _ensure_org_user(db, awwa_hq.id, US_PLATFORM, "platform_observer")

        epa_r2 = _upsert_user(
            db,
            username="epa-r2-opcert-coordinator",
            email="opcert-r2@epa.gov",
            full_name="EPA Region 2 OpCert Coordinator",
            roles=["national_observer"],
            password=pwd,
        )
        _ensure_org_user(db, epa_r2.id, US_PLATFORM, "platform_observer")

        doh_mgr = _upsert_user(
            db,
            username="ny-doh-opcert-manager",
            email="h2ocert@health.ny.gov",
            full_name="NYSDOH OpCert Program Manager",
            roles=["state_admin"],
            password=pwd,
        )
        _ensure_org_user(db, doh_mgr.id, NY_DOH, "state_admin")

        mcwa_super = _upsert_user(
            db,
            username="mcwa-superintendent",
            email="superintendent@mcwa.us",
            full_name="MCWA Superintendent",
            roles=["district_admin", "ceu_admin"],
            password=pwd,
            districts=[MCWA],
        )
        mcwa_mgr = _upsert_user(
            db,
            username="mcwa-chief-operator",
            email="chief@mcwa.us",
            full_name="MCWA Chief Operator",
            roles=["district_manager", "ceu_manager", "workforce_manager"],
            password=pwd,
            districts=[MCWA],
        )
        mcwa_op = _upsert_user(
            db,
            username="mcwa-operator-1",
            email="operator1@mcwa.us",
            full_name="MCWA Plant Operator",
            roles=["ceu_user", "district_operator", "workforce_operator"],
            password=pwd,
            districts=[MCWA],
        )

        db.flush()

        def link(
            user: User | None,
            persona_key: str,
            tier: str,
            label: str,
            subtitle: str,
            bullets: list,
            sort_order: int,
            state_code: str | None = None,
            scopes: list | None = None,
            catalog_group: str | None = None,
        ):
            if not user:
                print(f"  skip persona {persona_key} — user missing")
                return
            _upsert_persona(
                db,
                persona_key=persona_key,
                user_id=user.id,
                tier=tier,
                label=label,
                subtitle=subtitle,
                narrative_bullets=bullets,
                sort_order=sort_order,
                state_code=state_code,
                visible_to_scopes=scopes or ["platform_admin", "state_admin", "oww_partner"],
                catalog_group=catalog_group,
            )

        jenny = (
            db.query(User)
            .filter(User.username.in_(["jenny-oww", "jingrao-aman-OWW"]))
            .one_or_none()
        )
        nj_admin = db.query(User).filter(User.username == "nj-state-admin").one_or_none()
        hf_admin = db.query(User).filter(User.username == "hf-admin").one_or_none()
        hf_mgr = db.query(User).filter(User.username == "hf-manager").one_or_none()
        hf_op = db.query(User).filter(User.username == "hf-operator-1").one_or_none()
        wb_admin = db.query(User).filter(User.username == "wb-admin").one_or_none()
        wb_mgr = db.query(User).filter(User.username == "wb-manager").one_or_none()
        wb_op = db.query(User).filter(User.username == "wb-operator-1").one_or_none()
        ww360_nat = db.query(User).filter(User.username == "ww360-national").one_or_none()

        link(
            national,
            "aquasafe-admin",
            "national",
            "AquaSafe platform admin",
            "Full national + all states",
            ["All jurisdictions and admin tools", "Primacy state switcher", "Persona switcher"],
            1,
            scopes=["platform_admin"],
        )
        link(
            ww360_nat or national,
            "ww360-national",
            "national",
            "WW360 national admin",
            "Cross-state platform view",
            ["Executive overview for any state", "Jurisdiction admin", "SDWIS refresh"],
            2,
            scopes=["platform_admin"],
        )
        link(
            epa_lead,
            "us-epa-workforce-lead",
            "national",
            "EPA Water Workforce Initiative",
            "Office of Water — national workforce",
            ["US headline KPIs", "State comparison", "Funding pipeline"],
            10,
            state_code="US",
            scopes=["platform_admin", "national_observer", "state_admin", "oww_partner"],
        )
        link(
            asdwa,
            "us-asdwa-program-director",
            "national",
            "ASDWA program director",
            "State primacy comparison",
            ["OpCert coverage by state", "Compliance pressure map", "Section adoption"],
            11,
            state_code="US",
            scopes=["platform_admin", "national_observer", "state_admin", "oww_partner"],
        )
        link(
            awwa_hq,
            "us-awwa-workforce-director",
            "national",
            "AWWA HQ workforce director",
            "Sections roll-up + digital reach",
            ["National workforce gap", "Digital reach analytics", "Section benchmarks"],
            12,
            state_code="US",
            scopes=["platform_admin", "national_observer", "state_admin", "oww_partner"],
        )
        link(
            epa_r2,
            "epa-r2-opcert-coordinator",
            "regional",
            "EPA Region 2 OpCert",
            "NY, NJ, PR, VI primacy view",
            ["Regional compliance backdrop", "State scorecards", "OpCert program metrics"],
            20,
            state_code="NY",
            scopes=["platform_admin", "national_observer", "state_admin", "oww_partner"],
        )
        link(
            jenny,
            "ny-nysawwa-executive",
            "state",
            "NYS AWWA Executive Director",
            "Jenny Ingrao-Aman — section executive",
            ["NY executive dashboard", "Water system landscape", "Digital reach teaser"],
            30,
            state_code="NY",
        )
        link(
            doh_mgr,
            "ny-doh-opcert-manager",
            "state",
            "NYSDOH OpCert manager",
            "Primacy operator certification program",
            ["OpCert coverage panel", "Renewal cliff by grade", "EPA annual report template"],
            31,
            state_code="NY",
        )
        link(
            nj_admin,
            "nj-state-admin",
            "state",
            "NJ state program admin",
            "New Jersey One Water Workforce",
            ["NJ executive overview", "program:NJ Document Studio", "State landscape"],
            32,
            state_code="NJ",
        )
        link(
            mcwa_super,
            "mcwa-superintendent",
            "utility",
            "Superintendent (district admin)",
            "Monroe County Water Authority · Sets policy, users, and document approvals",
            [
                "District dashboard and continuity oversight",
                "Add users and approve published docs",
                "Create or open Succession Binder with the manager",
            ],
            1,
            state_code="NY",
            catalog_group="utility_walkthrough",
        )
        link(
            mcwa_mgr,
            "mcwa-chief-operator",
            "utility",
            "Workforce manager",
            "Reports to Superintendent · Authors binders and day-to-day Continuity",
            [
                "Create Succession Binder and refresh CEU Tracker packs",
                "Maintain roster, coverage, and succession bench",
                "Transfer custody to utility cloud when ready",
            ],
            2,
            state_code="NY",
            catalog_group="utility_walkthrough",
        )
        link(
            mcwa_op,
            "mcwa-operator-1",
            "utility",
            "Plant operator",
            "Reports to Manager · Personal CEU, training, and assigned tasks",
            [
                "Operator home — CEU hours and training signups",
                "CEU & Training workspace only (no binder authoring)",
                "Complete documentation tasks assigned by manager",
            ],
            3,
            state_code="NY",
            catalog_group="utility_walkthrough",
        )
        link(
            hf_admin,
            "hf-admin",
            "utility",
            "Small utility — Superintendent",
            "Hudson Falls (Grade C/D)",
            ["District home", "Vacancy alerts", "Admin notifications"],
            50,
            state_code="NY",
        )
        link(
            hf_mgr,
            "hf-manager",
            "utility",
            "Small utility — Manager",
            "Hudson Falls continuity manager",
            ["Succession planning", "Tutorial review queue", "CEU tracking"],
            51,
            state_code="NY",
        )
        link(
            hf_op,
            "hf-operator-1",
            "utility",
            "Small utility — Operator",
            "Hudson Falls operator",
            ["Operator home", "Submit tutorials", "CEU log"],
            52,
            state_code="NY",
        )
        link(
            wb_admin,
            "wb-admin",
            "utility",
            "NJ utility — District admin",
            "Woodbridge Water Department",
            ["NJ district dashboard", "Continuity vacancy", "Admin alerts"],
            60,
            state_code="NJ",
        )
        link(
            wb_mgr,
            "wb-manager",
            "utility",
            "NJ utility — Manager",
            "Woodbridge workforce manager",
            ["Succession board", "Review queue", "CE renewals"],
            61,
            state_code="NJ",
        )
        link(
            wb_op,
            "wb-operator-1",
            "utility",
            "NJ utility — Operator",
            "Woodbridge operator",
            ["Operator tasks", "CEU log", "Training signups"],
            62,
            state_code="NJ",
        )

        db.commit()
        print("Demo personas seeded successfully.")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Seed failed: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
