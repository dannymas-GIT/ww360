"""Impersonation eligibility, session lifecycle, and persona catalog."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.impersonation import DemoPersona, ImpersonationEvent, ImpersonationSession
from app.models.user import User
from app.models.water_district import WaterDistrict
from app.models.workforce_organization import OrganizationUserMembership, WorkforceOrganization
from app.services.jurisdiction_context_service import build_session_payload, orgs_payload
from app.tenant_auth import GLOBAL_ADMIN_ROLES, Roles, STATE_EXEC_ROLES

IMPERSONATION_TTL_MINUTES = 60
PREVIEW_ALLOWED_ROLES = {Roles.PLATFORM_ADMIN, Roles.STATE_ADMIN, Roles.OWW_PARTNER}
ACT_ALLOWED_ROLES = {Roles.PLATFORM_ADMIN}
BLOCKED_TARGET_ROLES = {Roles.PLATFORM_ADMIN}


def _actor_states(db: Session, actor: User) -> set[str]:
    states: set[str] = set()
    for row in db.query(OrganizationUserMembership).filter(
        OrganizationUserMembership.user_id == actor.id
    ):
        org = (
            db.query(WorkforceOrganization)
            .filter(WorkforceOrganization.org_code == row.org_code)
            .first()
        )
        if org and org.state_code:
            states.add(org.state_code.upper()[:2])
    districts = list(actor.district_memberships or [])
    if districts:
        for sc in (
            db.query(WaterDistrict.state_code)
            .filter(WaterDistrict.district_code.in_(districts))
            .all()
        ):
            if sc[0]:
                states.add(str(sc[0]).upper()[:2])
    if any(r in GLOBAL_ADMIN_ROLES for r in (actor.roles or [])):
        states.add("*")
    return states


def _target_state_codes(db: Session, target: User) -> set[str]:
    states: set[str] = set()
    for o in orgs_payload(db, target):
        states.add(str(o.get("state_code", "NY")).upper()[:2])
    districts = list(target.district_memberships or [])
    if districts:
        for sc in (
            db.query(WaterDistrict.state_code)
            .filter(WaterDistrict.district_code.in_(districts))
            .all()
        ):
            if sc[0]:
                states.add(str(sc[0]).upper()[:2])
    return states or {"NY"}


def _can_actor_impersonate_target(
    db: Session,
    actor: User,
    target: User,
    *,
    mode: str,
) -> None:
    actor_roles = set(actor.roles or [])
    target_roles = set(target.roles or [])

    if not target.is_active:
        raise HTTPException(status_code=400, detail="Target user is inactive")
    if target_roles & BLOCKED_TARGET_ROLES:
        raise HTTPException(status_code=403, detail="Cannot impersonate platform administrators")
    if actor.id == target.id:
        raise HTTPException(status_code=400, detail="Cannot impersonate yourself")

    if mode == "act":
        if not (actor_roles & ACT_ALLOWED_ROLES):
            raise HTTPException(status_code=403, detail="Act-as mode requires platform_admin")
        return

    if not (actor_roles & PREVIEW_ALLOWED_ROLES):
        raise HTTPException(status_code=403, detail="Preview mode requires platform or state admin")

    actor_states = _actor_states(db, actor)
    if "*" in actor_states:
        return

    target_states = _target_state_codes(db, target)
    if "national_observer" in target_roles:
        return
    if not target_states.issubset(actor_states) and not actor_states.intersection(target_states):
        # Allow if any target state matches actor scope
        if not actor_states.intersection(target_states):
            raise HTTPException(
                status_code=403,
                detail="Target persona is outside your state scope",
            )


def _active_session_for_actor(db: Session, actor_id: int) -> ImpersonationSession | None:
    now = datetime.now(timezone.utc)
    return (
        db.query(ImpersonationSession)
        .filter(
            ImpersonationSession.actor_user_id == actor_id,
            ImpersonationSession.ended_at.is_(None),
            ImpersonationSession.expires_at > now,
        )
        .order_by(ImpersonationSession.started_at.desc())
        .first()
    )


def build_act_as_claim(
    db: Session,
    target: User,
    *,
    session_id: str,
    mode: str,
    persona_key: str | None = None,
) -> dict[str, Any]:
    payload = build_session_payload(db, target)
    return {
        "session_id": session_id,
        "target_user_id": target.id,
        "target_username": target.username,
        "persona_key": persona_key,
        "mode": mode,
        "roles": payload.get("roles") or [],
        "districts": payload.get("district_memberships") or [],
        "active_state_code": payload.get("active_state_code") or "NY",
        "active_org_code": payload.get("active_org_code"),
        "is_national_admin": bool(payload.get("is_national_admin")),
        "orgs": payload.get("orgs") or [],
    }


def start_impersonation(
    db: Session,
    *,
    actor: User,
    target: User,
    mode: str,
    reason: str | None,
    persona_key: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> ImpersonationSession:
    if mode not in ("preview", "act"):
        raise HTTPException(status_code=400, detail="mode must be preview or act")
    if mode == "act" and not (reason or "").strip():
        raise HTTPException(status_code=400, detail="reason is required for act-as mode")

    existing = _active_session_for_actor(db, actor.id)
    if existing:
        existing.ended_at = datetime.now(timezone.utc)
        db.add(existing)

    _can_actor_impersonate_target(db, actor, target, mode=mode)

    now = datetime.now(timezone.utc)
    session = ImpersonationSession(
        actor_user_id=actor.id,
        target_user_id=target.id,
        persona_key=persona_key,
        mode=mode,
        reason=(reason or "").strip() or None,
        started_at=now,
        expires_at=now + timedelta(minutes=IMPERSONATION_TTL_MINUTES),
        ip_address=ip_address,
        user_agent=(user_agent or "")[:512] or None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def stop_impersonation(db: Session, *, actor_id: int, session_id: str | None = None) -> None:
    q = db.query(ImpersonationSession).filter(
        ImpersonationSession.actor_user_id == actor_id,
        ImpersonationSession.ended_at.is_(None),
    )
    if session_id:
        q = q.filter(ImpersonationSession.id == session_id)
    row = q.order_by(ImpersonationSession.started_at.desc()).first()
    if row:
        row.ended_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()


def log_impersonation_event(
    db: Session,
    *,
    session_id: str,
    method: str,
    path: str,
    status_code: int,
) -> None:
    db.add(
        ImpersonationEvent(
            session_id=session_id,
            method=method.upper(),
            path=path[:512],
            status_code=status_code,
        )
    )
    db.commit()


def list_personas_for_actor(db: Session, actor: User) -> list[dict[str, Any]]:
    actor_roles = set(actor.roles or [])
    actor_states = _actor_states(db, actor)
    is_platform = bool(actor_roles & set(GLOBAL_ADMIN_ROLES))
    is_state_exec = bool(actor_roles & (PREVIEW_ALLOWED_ROLES - {Roles.PLATFORM_ADMIN}))

    rows = (
        db.query(DemoPersona, User)
        .join(User, User.id == DemoPersona.user_id)
        .filter(DemoPersona.is_active == 1, User.is_active.is_(True))
        .order_by(DemoPersona.sort_order, DemoPersona.label)
        .all()
    )
    out: list[dict[str, Any]] = []
    for persona, user in rows:
        # Never offer self or platform admins as preview targets.
        if user.id == actor.id:
            continue
        if set(user.roles or []) & BLOCKED_TARGET_ROLES:
            continue

        scopes = set(persona.visible_to_scopes or [])
        # Platform-only personas stay hidden from state partners.
        if scopes and scopes <= {"platform_admin"} and not is_platform:
            continue
        if scopes and "platform_admin" in scopes and not is_platform:
            if not is_state_exec:
                continue
            # State execs may preview national_observer / state personas whose
            # scopes also list national_observer, state_admin, or oww_partner.
            if not scopes.intersection({"national_observer", "state_admin", "oww_partner", "*"}):
                if persona.tier not in ("state", "utility", "regional"):
                    continue

        if persona.tier == "national" and not is_platform:
            # National observer demos are available to state partners for View as role.
            if not is_state_exec:
                if "*" not in actor_states:
                    continue
            elif "national_observer" not in scopes and "*" not in scopes:
                # Allow if scopes explicitly include state partner roles.
                if not scopes.intersection({"state_admin", "oww_partner"}):
                    if "*" not in actor_states:
                        continue

        if persona.state_code and "*" not in actor_states:
            st = persona.state_code.upper()[:2]
            # National / US personas are not limited by actor state membership.
            if persona.tier not in ("national",) and st not in actor_states and st != "US":
                continue

        payload = build_session_payload(db, user)
        out.append(
            {
                "persona_key": persona.persona_key,
                "tier": persona.tier,
                "label": persona.label,
                "subtitle": persona.subtitle,
                "narrative_bullets": persona.narrative_bullets or [],
                "catalog_group": persona.catalog_group,
                "target_user_id": user.id,
                "username": user.username,
                "roles": payload.get("roles") or [],
                "districts": payload.get("district_memberships") or [],
                "state_code": persona.state_code or payload.get("active_state_code"),
                "org_code": payload.get("active_org_code"),
            }
        )
    return out


def list_sessions(
    db: Session,
    *,
    actor_id: int | None = None,
    target_id: int | None = None,
    limit: int = 100,
) -> list[ImpersonationSession]:
    q = db.query(ImpersonationSession).order_by(ImpersonationSession.started_at.desc())
    if actor_id:
        q = q.filter(ImpersonationSession.actor_user_id == actor_id)
    if target_id:
        q = q.filter(ImpersonationSession.target_user_id == target_id)
    return q.limit(limit).all()
