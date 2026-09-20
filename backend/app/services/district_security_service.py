"""District access control for WW360."""

from __future__ import annotations

from typing import Set

from sqlalchemy.orm import Session

from app.tenant_auth import TenantContext


class DistrictSecurityService:
    def __init__(self, db: Session):
        self.db = db

    def get_authorized_districts(self, context: TenantContext) -> Set[str]:
        """Return district codes the user may access.

        - Platform / global admins: ``{"*"}`` (callers filter by active primacy).
        - OWW partners / state admins: every active district in their active
          primacy state (statewide Continuity master view).
        - Utility users: assigned + home district codes only.
        """
        if context.is_global_admin:
            return {"*"}

        # Section / state partners need the statewide utility catalog — not only
        # districts they happen to be assigned to.
        if context.is_state_exec():
            from app.models.water_district import WaterDistrict

            st = (context.active_state_code or "NY").upper()[:2]
            rows = (
                self.db.query(WaterDistrict.district_code)
                .filter(
                    WaterDistrict.is_active.is_(True),
                    WaterDistrict.state_code == st,
                )
                .all()
            )
            codes = {r[0] for r in rows if r[0]}
            if codes:
                return codes

        codes = set(context.assigned_districts or [])
        if context.district_code:
            codes.add(context.district_code)
        return codes
