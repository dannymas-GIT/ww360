"""Workspace customization API — module foundry + saved layouts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.workspace_customization import WorkspaceCustomization
from app.services.workspace_module_foundry import (
    default_layout_for_profile,
    modules_for_profile,
    validate_layout,
)
from app.tenant_auth import TenantContext

router = APIRouter()

VALID_PROFILES = {"national", "regional", "state_partner", "regulator", "utility"}


class LayoutItem(BaseModel):
    module_id: str
    visible: bool = True
    size: str = Field(default="full", pattern="^(full|half)$")


class LayoutBody(BaseModel):
    workspace_profile: str
    persona_key: str | None = None
    layout: list[LayoutItem]


def _actor_id(context: TenantContext) -> int:
    # Persist against the real actor so preview doesn't overwrite Jenny's layout
    return int(context.actor_user_id or context.user_id)


def _persona_key(raw: str | None) -> str:
    return (raw or "").strip()[:80]


@router.get("/modules")
def list_modules(
    workspace_profile: str = "state_partner",
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    del context
    profile = workspace_profile if workspace_profile in VALID_PROFILES else "state_partner"
    return {
        "workspace_profile": profile,
        "modules": modules_for_profile(profile),
        "default_layout": default_layout_for_profile(profile),
    }


@router.get("/layout")
def get_layout(
    workspace_profile: str = "state_partner",
    persona_key: str | None = None,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    profile = workspace_profile if workspace_profile in VALID_PROFILES else "state_partner"
    pk = _persona_key(persona_key)
    user_id = _actor_id(context)
    row = (
        db.query(WorkspaceCustomization)
        .filter(
            WorkspaceCustomization.user_id == user_id,
            WorkspaceCustomization.workspace_profile == profile,
            WorkspaceCustomization.persona_key == pk,
        )
        .one_or_none()
    )
    if row:
        layout = validate_layout(list(row.layout or []), profile)
        return {
            "workspace_profile": profile,
            "persona_key": pk or None,
            "layout": layout,
            "is_default": False,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
    return {
        "workspace_profile": profile,
        "persona_key": pk or None,
        "layout": default_layout_for_profile(profile),
        "is_default": True,
        "updated_at": None,
    }


@router.put("/layout")
def put_layout(
    body: LayoutBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if context.is_impersonating and context.impersonation_mode == "preview":
        raise HTTPException(
            status_code=403,
            detail="Exit preview (or use Act as) before saving home customizations",
        )
    profile = body.workspace_profile if body.workspace_profile in VALID_PROFILES else "state_partner"
    pk = _persona_key(body.persona_key)
    user_id = _actor_id(context)
    layout = validate_layout([i.model_dump() for i in body.layout], profile)

    row = (
        db.query(WorkspaceCustomization)
        .filter(
            WorkspaceCustomization.user_id == user_id,
            WorkspaceCustomization.workspace_profile == profile,
            WorkspaceCustomization.persona_key == pk,
        )
        .one_or_none()
    )
    if not row:
        row = WorkspaceCustomization(
            user_id=user_id,
            workspace_profile=profile,
            persona_key=pk,
            layout=layout,
        )
        db.add(row)
    else:
        row.layout = layout
    db.commit()
    db.refresh(row)
    return {
        "workspace_profile": profile,
        "persona_key": pk or None,
        "layout": layout,
        "is_default": False,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.delete("/layout")
def reset_layout(
    workspace_profile: str = "state_partner",
    persona_key: str | None = None,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if context.is_impersonating and context.impersonation_mode == "preview":
        raise HTTPException(
            status_code=403,
            detail="Exit preview before resetting home customizations",
        )
    profile = workspace_profile if workspace_profile in VALID_PROFILES else "state_partner"
    pk = _persona_key(persona_key)
    user_id = _actor_id(context)
    db.query(WorkspaceCustomization).filter(
        WorkspaceCustomization.user_id == user_id,
        WorkspaceCustomization.workspace_profile == profile,
        WorkspaceCustomization.persona_key == pk,
    ).delete(synchronize_session=False)
    db.commit()
    return {
        "workspace_profile": profile,
        "persona_key": pk or None,
        "layout": default_layout_for_profile(profile),
        "is_default": True,
        "updated_at": None,
    }
