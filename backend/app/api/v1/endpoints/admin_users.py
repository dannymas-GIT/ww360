"""Platform admin: list and update WW360 local users; utility administrator invites."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.db.database import get_db
from app.models.oww_integration import UserInvite
from app.models.user import User
from app.models.workforce_organization import OrganizationUserMembership
from app.tenant_auth import Roles, TenantContext

logger = logging.getLogger(__name__)

router = APIRouter()

INVITE_TTL_HOURS = 72
INVITABLE_ROLES = {
    Roles.DISTRICT_ADMIN,
    "district_manager",
    "district_viewer",
    "ceu_admin",
    "ceu_user",
    "workforce_operator",
    "workforce_manager",
}


class AdminUserOut(BaseModel):
    id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    roles: list[str] = []
    is_active: bool = True


class AdminUserPatch(BaseModel):
    roles: list[str] | None = None
    is_active: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)


class AdminPasswordReset(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class AdminPasswordResetOut(BaseModel):
    id: int
    username: str
    ok: bool = True


@router.get("/admin/users", response_model=list[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    _ = context
    rows = db.query(User).order_by(User.username).all()
    return [
        AdminUserOut(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            roles=list(u.roles or []),
            is_active=bool(u.is_active),
        )
        for u in rows
    ]


@router.get("/admin/users/org-members", response_model=list[AdminUserOut])
def list_org_members(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    """Utility administrator: list members of the active OWW-linked organization."""
    if not _can_invite(context):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed")
    org_code = context.active_org_code
    if context.is_global_admin and not org_code:
        # Platform admins without an org should use /admin/users
        rows = db.query(User).order_by(User.username).all()
        return [
            AdminUserOut(
                id=u.id,
                username=u.username,
                email=u.email,
                full_name=u.full_name,
                roles=list(u.roles or []),
                is_active=bool(u.is_active),
            )
            for u in rows
        ]
    if not org_code:
        return []
    memberships = (
        db.query(OrganizationUserMembership)
        .filter(OrganizationUserMembership.org_code == org_code)
        .all()
    )
    user_ids = [m.user_id for m in memberships]
    if not user_ids:
        return []
    rows = db.query(User).filter(User.id.in_(user_ids)).order_by(User.username).all()
    return [
        AdminUserOut(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            roles=list(u.roles or []),
            is_active=bool(u.is_active),
        )
        for u in rows
    ]


@router.patch("/admin/users/{user_id}", response_model=AdminUserOut)
def patch_user(
    user_id: int,
    body: AdminUserPatch,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    _ = context
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.roles is not None:
        user.roles = body.roles
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        user.email = body.email
    db.commit()
    db.refresh(user)
    return AdminUserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        roles=list(user.roles or []),
        is_active=bool(user.is_active),
    )


@router.post(
    "/admin/users/{user_id}/reset-password",
    response_model=AdminPasswordResetOut,
    status_code=status.HTTP_200_OK,
)
def reset_user_password(
    user_id: int,
    body: AdminPasswordReset,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    """Set a new password for a WW360 local account (platform admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    password = body.password.strip()
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters",
        )

    user.set_password(password)
    db.commit()
    logger.info(
        "platform_admin password reset user_id=%s username=%s by_user_id=%s by_username=%s",
        user.id,
        user.username,
        context.actor_user_id,
        context.username,
    )
    return AdminPasswordResetOut(id=user.id, username=user.username, ok=True)


class InviteCreateBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    full_name: str | None = Field(default=None, max_length=255)
    roles: list[str] = Field(default_factory=lambda: [Roles.DISTRICT_ADMIN])
    district_memberships: list[str] = Field(default_factory=list)
    org_code: str | None = Field(default=None, max_length=50)


class InviteCreateOut(BaseModel):
    id: str
    email: str
    invite_url: str
    expires_at: datetime


class InviteAcceptBody(BaseModel):
    token: str = Field(..., min_length=8)
    username: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


def _can_invite(context: TenantContext) -> bool:
    # TenantContext.has_any_role expects a single list argument.
    return context.is_global_admin or context.has_any_role(
        [Roles.DISTRICT_ADMIN, "district_manager", "oww_partner"]
    )


def _public_app_url() -> str:
    if settings.WW360_PUBLIC_APP_URL:
        return settings.WW360_PUBLIC_APP_URL.rstrip("/")
    domain = settings.APP_DOMAIN or "ww360.aquasafe-solutions.us"
    scheme = "http" if domain.startswith("localhost") or domain.startswith("127.") else "https"
    return f"{scheme}://{domain}"


@router.post("/admin/users/invite", response_model=InviteCreateOut)
def invite_user(
    body: InviteCreateBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if not _can_invite(context):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed to invite users")

    roles = [r for r in (body.roles or []) if r in INVITABLE_ROLES]
    if not roles:
        roles = [Roles.DISTRICT_ADMIN]

    org_code = body.org_code or context.active_org_code
    if not context.is_global_admin and org_code and context.active_org_code:
        if org_code != context.active_org_code:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Cannot invite outside your organization")

    email = str(body.email).lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A user with that email already exists")

    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=INVITE_TTL_HOURS)
    invite = UserInvite(
        token=token,
        email=email,
        full_name=body.full_name,
        roles=roles,
        district_memberships=list(body.district_memberships or []),
        org_code=org_code,
        invited_by_user_id=context.user_id,
        expires_at=expires,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    return InviteCreateOut(
        id=invite.id,
        email=invite.email,
        invite_url=f"{_public_app_url()}/invite/accept?token={token}",
        expires_at=expires,
    )


@router.post("/auth/invite/accept")
def accept_invite(body: InviteAcceptBody, db: Session = Depends(get_db)):
    invite = db.query(UserInvite).filter(UserInvite.token == body.token).first()
    if not invite or invite.accepted_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or used invite")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invite expired")

    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Username taken")
    if db.query(User).filter(User.email == invite.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        username=body.username.strip(),
        email=invite.email,
        full_name=body.full_name or invite.full_name,
        roles=list(invite.roles or []),
        district_memberships=list(invite.district_memberships or []),
        is_active=True,
    )
    user.set_password(body.password)
    db.add(user)
    db.flush()

    if invite.org_code:
        db.add(
            OrganizationUserMembership(
                user_id=user.id,
                org_code=invite.org_code,
                role=(invite.roles or [Roles.DISTRICT_ADMIN])[0],
            )
        )

    invite.accepted_at = datetime.utcnow()
    invite.created_user_id = user.id
    db.commit()

    from app.services.auth_service import mint_ww360_token
    from app.services.jurisdiction_context_service import build_session_payload

    payload = build_session_payload(db, user)
    token = mint_ww360_token(payload)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "roles": list(user.roles or []),
        },
    }
