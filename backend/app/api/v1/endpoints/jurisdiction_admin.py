"""Platform admin: state primacy orgs and org user memberships."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.workforce_organization import OrganizationUserMembership, WorkforceOrganization
from app.tenant_auth import TenantContext

router = APIRouter()


class JurisdictionOut(BaseModel):
    org_code: str
    name: str
    state_code: str
    partner_label: str | None = None
    section_label: str | None = None
    logo_url: str | None = None
    content_pack_key: str
    website_url: str | None = None
    is_active: bool
    member_count: int = 0
    district_count: int = 0


class JurisdictionPatch(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    partner_label: str | None = Field(default=None, max_length=255)
    section_label: str | None = Field(default=None, max_length=255)
    logo_url: str | None = Field(default=None, max_length=500)
    website_url: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class OrgMemberOut(BaseModel):
    id: str
    user_id: int
    username: str
    org_code: str
    role: str


class OrgMemberCreate(BaseModel):
    user_id: int
    role: str = Field(default="state_admin", max_length=50)


@router.get("/admin/jurisdictions", response_model=list[JurisdictionOut])
def list_admin_jurisdictions(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    _ = context
    orgs = db.query(WorkforceOrganization).order_by(WorkforceOrganization.state_code).all()
    out: list[JurisdictionOut] = []
    for org in orgs:
        member_count = (
            db.query(OrganizationUserMembership)
            .filter(OrganizationUserMembership.org_code == org.org_code)
            .count()
        )
        district_count = len(org.memberships or [])
        out.append(
            JurisdictionOut(
                org_code=org.org_code,
                name=org.name,
                state_code=(org.state_code or "NY").upper(),
                partner_label=org.partner_label,
                section_label=org.section_label,
                logo_url=org.logo_url,
                content_pack_key=org.content_pack_key or org.state_code,
                website_url=org.website_url,
                is_active=bool(org.is_active),
                member_count=member_count,
                district_count=district_count,
            )
        )
    return out


@router.patch("/admin/jurisdictions/{org_code}", response_model=JurisdictionOut)
def patch_jurisdiction(
    org_code: str,
    body: JurisdictionPatch,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    _ = context
    org = db.query(WorkforceOrganization).filter(WorkforceOrganization.org_code == org_code).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if body.name is not None:
        org.name = body.name
    if body.partner_label is not None:
        org.partner_label = body.partner_label
    if body.section_label is not None:
        org.section_label = body.section_label
    if body.logo_url is not None:
        org.logo_url = body.logo_url
    if body.website_url is not None:
        org.website_url = body.website_url
    if body.is_active is not None:
        org.is_active = body.is_active
    db.commit()
    db.refresh(org)
    member_count = (
        db.query(OrganizationUserMembership)
        .filter(OrganizationUserMembership.org_code == org.org_code)
        .count()
    )
    return JurisdictionOut(
        org_code=org.org_code,
        name=org.name,
        state_code=(org.state_code or "NY").upper(),
        partner_label=org.partner_label,
        section_label=org.section_label,
        logo_url=org.logo_url,
        content_pack_key=org.content_pack_key or org.state_code,
        website_url=org.website_url,
        is_active=bool(org.is_active),
        member_count=member_count,
        district_count=len(org.memberships or []),
    )


@router.get("/admin/jurisdictions/{org_code}/members", response_model=list[OrgMemberOut])
def list_org_members(
    org_code: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    _ = context
    rows = (
        db.query(OrganizationUserMembership, User)
        .join(User, User.id == OrganizationUserMembership.user_id)
        .filter(OrganizationUserMembership.org_code == org_code)
        .all()
    )
    return [
        OrgMemberOut(
            id=mem.id,
            user_id=mem.user_id,
            username=user.username,
            org_code=mem.org_code,
            role=mem.role,
        )
        for mem, user in rows
    ]


@router.post("/admin/jurisdictions/{org_code}/members", response_model=OrgMemberOut)
def add_org_member(
    org_code: str,
    body: OrgMemberCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    _ = context
    org = db.query(WorkforceOrganization).filter(WorkforceOrganization.org_code == org_code).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    existing = (
        db.query(OrganizationUserMembership)
        .filter(
            OrganizationUserMembership.org_code == org_code,
            OrganizationUserMembership.user_id == body.user_id,
        )
        .first()
    )
    if existing:
        existing.role = body.role
        db.commit()
        db.refresh(existing)
        mem = existing
    else:
        mem = OrganizationUserMembership(
            id=str(uuid.uuid4()),
            org_code=org_code,
            user_id=body.user_id,
            role=body.role,
        )
        db.add(mem)
        db.commit()
        db.refresh(mem)
    roles = set(user.roles or [])
    if body.role == "state_admin":
        roles.add("state_admin")
    user.roles = sorted(roles)
    db.commit()
    return OrgMemberOut(
        id=mem.id,
        user_id=mem.user_id,
        username=user.username,
        org_code=mem.org_code,
        role=mem.role,
    )


@router.delete("/admin/jurisdictions/{org_code}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_org_member(
    org_code: str,
    user_id: int,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    _ = context
    mem = (
        db.query(OrganizationUserMembership)
        .filter(
            OrganizationUserMembership.org_code == org_code,
            OrganizationUserMembership.user_id == user_id,
        )
        .first()
    )
    if not mem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    db.delete(mem)
    db.commit()
