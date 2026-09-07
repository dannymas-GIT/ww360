"""Jurisdiction content packs and org listing."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.workforce_organization import WorkforceOrganization
from app.services.jurisdiction_service import JurisdictionPack, list_pack_states, load_pack, pack_summary
from app.tenant_auth import TenantContext

router = APIRouter()


class OrgSummary(BaseModel):
    org_code: str
    name: str
    state_code: str
    partner_label: str | None = None
    section_label: str | None = None
    content_pack_key: str
    is_active: bool


class JurisdictionListOut(BaseModel):
    states: list[str]
    organizations: list[OrgSummary]


@router.get("/jurisdictions", response_model=JurisdictionListOut)
def list_jurisdictions(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _ = context
    orgs = (
        db.query(WorkforceOrganization)
        .filter(WorkforceOrganization.is_active.is_(True))
        .order_by(WorkforceOrganization.state_code)
        .all()
    )
    return JurisdictionListOut(
        states=list_pack_states(),
        organizations=[
            OrgSummary(
                org_code=o.org_code,
                name=o.name,
                state_code=(o.state_code or "NY").upper(),
                partner_label=o.partner_label,
                section_label=o.section_label,
                content_pack_key=o.content_pack_key or o.state_code,
                is_active=bool(o.is_active),
            )
            for o in orgs
        ],
    )


@router.get("/jurisdictions/{state_code}/pack", response_model=JurisdictionPack)
def get_jurisdiction_pack(
    state_code: str,
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _ = context
    return load_pack(state_code)


@router.get("/jurisdictions/{state_code}/summary")
def get_jurisdiction_summary(
    state_code: str,
    context: TenantContext = Depends(deps.get_current_tenant_user),
) -> dict[str, Any]:
    _ = context
    return pack_summary(state_code)
