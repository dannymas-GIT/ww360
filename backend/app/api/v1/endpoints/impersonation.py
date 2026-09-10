"""Persona preview and act-as impersonation for platform and state admins."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.auth import ImpersonationOut, OrgMembershipOut, UserOut
from app.db.database import get_db
from app.models.impersonation import DemoPersona
from app.models.user import User
from app.services.auth_service import mint_ww360_token
from app.services.jurisdiction_context_service import build_session_payload
from app.services.impersonation_service import (
    IMPERSONATION_TTL_MINUTES,
    build_act_as_claim,
    list_personas_for_actor,
    list_sessions,
    start_impersonation,
    stop_impersonation,
)
from app.tenant_auth import TenantContext

router = APIRouter()


class PersonaOut(BaseModel):
    persona_key: str
    tier: str
    label: str
    subtitle: str | None = None
    narrative_bullets: list[str] = []
    target_user_id: int
    username: str
    roles: list[str] = []
    districts: list[str] = []
    state_code: str | None = None
    org_code: str | None = None
    catalog_group: str | None = None


class StartImpersonationBody(BaseModel):
    persona_key: str | None = None
    target_user_id: int | None = None
    mode: str = Field(default="preview", pattern="^(preview|act)$")
    reason: str | None = None


class SessionOut(BaseModel):
    id: str
    actor_user_id: int
    target_user_id: int
    persona_key: str | None
    mode: str
    reason: str | None
    started_at: str
    ended_at: str | None
    expires_at: str


def _user_out_from_payload(user: User, payload: dict, impersonation: ImpersonationOut | None) -> UserOut:
    orgs_raw = payload.get("orgs") or []
    orgs = [
        OrgMembershipOut(
            org_code=o["org_code"],
            state_code=o["state_code"],
            name=o.get("name") or o["org_code"],
            role=o.get("role") or "state_admin",
            content_pack_key=o.get("content_pack_key"),
        )
        for o in orgs_raw
        if isinstance(o, dict)
    ]
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        roles=list(payload.get("roles") or user.roles or []),
        districts=list(payload.get("district_memberships") or user.district_memberships or []),
        active_state_code=str(payload.get("active_state_code") or "NY").upper()[:2],
        active_org_code=payload.get("active_org_code"),
        is_national_admin=bool(payload.get("is_national_admin")),
        orgs=orgs,
        impersonation=impersonation,
    )


@router.get("/personas", response_model=list[PersonaOut])
def get_personas(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if context.is_impersonating:
        raise HTTPException(status_code=400, detail="End impersonation before starting another")
    actor = db.query(User).filter(User.id == context.actor_user_id).first()
    if not actor:
        raise HTTPException(status_code=404, detail="Actor not found")
    return list_personas_for_actor(db, actor)


@router.post("/start")
def impersonation_start(
    body: StartImpersonationBody,
    request: Request,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if context.is_impersonating:
        raise HTTPException(status_code=400, detail="Nested impersonation is not allowed")

    actor = db.query(User).filter(User.id == context.actor_user_id).first()
    if not actor:
        raise HTTPException(status_code=404, detail="Actor not found")

    target: User | None = None
    persona_key = body.persona_key
    if body.persona_key:
        persona = (
            db.query(DemoPersona)
            .filter(DemoPersona.persona_key == body.persona_key, DemoPersona.is_active == 1)
            .first()
        )
        if not persona:
            raise HTTPException(status_code=404, detail="Persona not found")
        target = db.query(User).filter(User.id == persona.user_id).first()
    elif body.target_user_id:
        target = db.query(User).filter(User.id == body.target_user_id).first()
    else:
        raise HTTPException(status_code=400, detail="persona_key or target_user_id required")

    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    session = start_impersonation(
        db,
        actor=actor,
        target=target,
        mode=body.mode,
        reason=body.reason,
        persona_key=persona_key,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    actor_payload = build_session_payload(db, actor)
    act_as = build_act_as_claim(
        db,
        target,
        session_id=session.id,
        mode=body.mode,
        persona_key=persona_key,
    )
    token = mint_ww360_token(actor_payload, act_as=act_as, expire_minutes=IMPERSONATION_TTL_MINUTES)
    target_payload = build_session_payload(db, target)
    imp = ImpersonationOut(
        active=True,
        mode=body.mode,
        persona_key=persona_key,
        target_username=target.username,
        session_id=session.id,
        expires_at=session.expires_at.isoformat() if session.expires_at else None,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_out_from_payload(target, target_payload, imp),
    }


@router.post("/stop")
def impersonation_stop(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if not context.is_impersonating:
        raise HTTPException(status_code=400, detail="Not impersonating")

    stop_impersonation(
        db,
        actor_id=context.actor_user_id,
        session_id=context.impersonation_session_id,
    )
    actor = db.query(User).filter(User.id == context.actor_user_id).first()
    if not actor:
        raise HTTPException(status_code=404, detail="Actor not found")
    payload = build_session_payload(db, actor)
    token = mint_ww360_token(payload)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_out_from_payload(actor, payload, ImpersonationOut(active=False)),
    }


@router.get("/sessions", response_model=list[SessionOut])
def impersonation_sessions(
    actor_id: int | None = None,
    target_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    rows = list_sessions(db, actor_id=actor_id, target_id=target_id, limit=min(limit, 500))
    return [
        SessionOut(
            id=r.id,
            actor_user_id=r.actor_user_id,
            target_user_id=r.target_user_id,
            persona_key=r.persona_key,
            mode=r.mode,
            reason=r.reason,
            started_at=r.started_at.isoformat() if r.started_at else "",
            ended_at=r.ended_at.isoformat() if r.ended_at else None,
            expires_at=r.expires_at.isoformat() if r.expires_at else "",
        )
        for r in rows
    ]
