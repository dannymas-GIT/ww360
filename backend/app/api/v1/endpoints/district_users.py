"""Utility-scoped user list, role assignment, and role catalog fine-tuning."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.documentation_task import DocumentationGrant
from app.services.district_user_service import (
    DistrictUserCreate,
    DistrictUserOut,
    DistrictUserPatch,
    create_district_user,
    list_district_users,
    patch_district_user,
    require_district_user_manager,
)
from app.services.role_catalog_service import (
    DistrictRoleSettingsPatch,
    RoleCatalogOut,
    build_catalog_out,
    get_enabled_utility_roles,
    patch_district_role_settings,
)
from app.tenant_auth import TenantContext

router = APIRouter()


def _grant_user_ids(db: Session, district_code: str) -> set[int]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    rows = (
        db.query(DocumentationGrant.user_id)
        .filter(
            DocumentationGrant.district_code == district_code.upper(),
            or_(DocumentationGrant.expires_at.is_(None), DocumentationGrant.expires_at >= now),
        )
        .all()
    )
    return {r[0] for r in rows}


def _to_out(u, grant_ids: set[int]) -> DistrictUserOut:
    return DistrictUserOut(
        id=u.id,
        username=u.username,
        email=u.email,
        full_name=u.full_name,
        roles=list(u.roles or []),
        district_memberships=list(u.district_memberships or []),
        is_active=bool(u.is_active),
        has_recorder_grant=u.id in grant_ids,
    )


@router.get("/districts/{district_code}/users", response_model=list[DistrictUserOut])
def get_district_users(
    district_code: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    code = district_code.upper()
    require_district_user_manager(context, code)
    grant_ids = _grant_user_ids(db, code)
    return [_to_out(u, grant_ids) for u in list_district_users(db, code)]


@router.post(
    "/districts/{district_code}/users",
    response_model=DistrictUserOut,
    status_code=201,
)
def post_district_user(
    district_code: str,
    body: DistrictUserCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    code = district_code.upper()
    user = create_district_user(db, context, code, body)
    return _to_out(user, set())


@router.patch("/districts/{district_code}/users/{user_id}", response_model=DistrictUserOut)
def update_district_user(
    district_code: str,
    user_id: int,
    body: DistrictUserPatch,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    code = district_code.upper()
    user = patch_district_user(db, context, code, user_id, body)
    grant_ids = _grant_user_ids(db, code)
    return _to_out(user, grant_ids)


@router.get("/districts/{district_code}/assignable-roles", response_model=list[str])
def get_assignable_roles(
    district_code: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    code = district_code.upper()
    require_district_user_manager(context, code)
    return get_enabled_utility_roles(db, code)


@router.get("/role-catalog", response_model=RoleCatalogOut)
def get_role_catalog(
    district_code: str | None = Query(None),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return build_catalog_out(db, context, district_code)


@router.patch("/districts/{district_code}/role-settings", response_model=RoleCatalogOut)
def update_role_settings(
    district_code: str,
    body: DistrictRoleSettingsPatch,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return patch_district_role_settings(db, context, district_code, body)
