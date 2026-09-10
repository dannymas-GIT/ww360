"""Ensure National → State → Utility org hierarchy is present."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.workforce_organization import (
    NATIONAL_ORG_CODE,
    NATIONAL_STATE_CODE,
    WorkforceOrganization,
)

NATIONAL_ORG_NAME = "Water Workforce 360 National"


def ensure_national_org(db: Session) -> WorkforceOrganization:
    """Idempotently create the top-tier national organization."""
    org = (
        db.query(WorkforceOrganization)
        .filter(WorkforceOrganization.org_code == NATIONAL_ORG_CODE)
        .one_or_none()
    )
    if not org:
        org = WorkforceOrganization(
            org_code=NATIONAL_ORG_CODE,
            name=NATIONAL_ORG_NAME,
            org_type="national",
            state_code=NATIONAL_STATE_CODE,
            parent_org_code=None,
            partner_label="WW360",
            section_label="National platform",
            content_pack_key="US",
            is_active=True,
        )
        db.add(org)
        db.flush()
        return org

    org.name = NATIONAL_ORG_NAME
    org.org_type = "national"
    org.state_code = NATIONAL_STATE_CODE
    org.parent_org_code = None
    org.partner_label = org.partner_label or "WW360"
    org.section_label = org.section_label or "National platform"
    org.content_pack_key = "US"
    org.is_active = True
    return org


def link_state_programs_to_national(db: Session) -> int:
    """Set parent_org_code on state_program orgs that lack a parent."""
    ensure_national_org(db)
    updated = 0
    rows = (
        db.query(WorkforceOrganization)
        .filter(
            WorkforceOrganization.org_type == "state_program",
            WorkforceOrganization.org_code != NATIONAL_ORG_CODE,
        )
        .all()
    )
    for org in rows:
        if org.parent_org_code != NATIONAL_ORG_CODE:
            org.parent_org_code = NATIONAL_ORG_CODE
            updated += 1
    return updated


def ensure_national_hierarchy(db: Session) -> None:
    """Create national org and parent-link all state programs."""
    ensure_national_org(db)
    link_state_programs_to_national(db)
    db.commit()
