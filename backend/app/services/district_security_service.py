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
        return codes
