"""District access control for WW360."""

from __future__ import annotations

from typing import Set

from sqlalchemy.orm import Session

from app.tenant_auth import TenantContext


class DistrictSecurityService:
    def __init__(self, db: Session):
        self.db = db

    def get_authorized_districts(self, context: TenantContext) -> Set[str]:
        if context.is_global_admin:
            return {"*"}
        codes = set(context.assigned_districts or [])
        if context.district_code:
            codes.add(context.district_code)

        # State / OWW partners: utilities linked to their state program org.
        if context.is_state_exec() and not codes:
            from app.models.workforce_organization import (
                OrganizationDistrictMembership,
                OrganizationUserMembership,
                WorkforceOrganization,
            )

            org_codes = [
                row.org_code
                for row in self.db.query(OrganizationUserMembership)
                .filter(OrganizationUserMembership.user_id == context.user_id)
                .all()
            ]
            if not org_codes:
                org_codes = [
                    o.org_code
                    for o in self.db.query(WorkforceOrganization)
                    .filter(
                        WorkforceOrganization.state_code == context.active_state_code,
                        WorkforceOrganization.is_active.is_(True),
                        WorkforceOrganization.org_type == "state_program",
                    )
                    .all()
                ]
            if org_codes:
                for (dc,) in (
                    self.db.query(OrganizationDistrictMembership.district_code)
                    .filter(OrganizationDistrictMembership.org_code.in_(org_codes))
                    .all()
                ):
                    if dc:
                        codes.add(dc)
        return codes
