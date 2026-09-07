"""WW360 authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.core.security import verify_password
from app.db.database import get_db
from app.models.user import User
from app.services.auth_service import mint_ww360_token
from app.services import sso_auth_service
from app.services.jurisdiction_context_service import build_session_payload
from app.tenant_auth import TenantContext

router = APIRouter()


class OrgMembershipOut(BaseModel):
    org_code: str
    state_code: str
    name: str
    role: str
    content_pack_key: str | None = None


class LoginBody(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    roles: list[str] = []
    districts: list[str] = []
    active_state_code: str = "NY"
    active_org_code: str | None = None
    is_national_admin: bool = False
    orgs: list[OrgMembershipOut] = []


class ActiveStateBody(BaseModel):
    state_code: str = Field(..., min_length=2, max_length=2)


class SsoCallbackBody(BaseModel):
    provider: str = Field(..., description="microsoft_graph or google_drive")
    code: str
    redirect_uri: str
    state: str | None = None


def _user_out(user: User, payload: dict) -> UserOut:
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
    )


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(body.password, user.hashed_password or ""):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    payload = build_session_payload(db, user)
    token = mint_ww360_token(payload)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_out(user, payload),
    }


@router.get("/sso/providers")
def sso_providers():
    """Which Microsoft/Google SSO buttons the login page should show."""
    return {"providers": sso_auth_service.list_configured_providers()}


@router.get("/sso/auth-url")
def sso_auth_url(
    provider: str = Query(..., description="microsoft_graph or google_drive"),
    redirect_uri: str = Query(...),
    state: str | None = Query(None),
):
    st = state or f"sso|{provider}"
    url = sso_auth_service.build_sso_auth_url(provider, redirect_uri, st)
    return {"auth_url": url, "provider": provider, "redirect_uri": redirect_uri}


@router.post("/sso/callback")
async def sso_callback(body: SsoCallbackBody, db: Session = Depends(get_db)):
    """Exchange IdP code → WW360 JWT and seed Document Studio library connection."""
    return await sso_auth_service.complete_sso_login(
        db,
        provider=body.provider,
        code=body.code,
        redirect_uri=body.redirect_uri,
    )


@router.get("/me", response_model=UserOut)
def me(
    context: TenantContext = Depends(deps.get_current_tenant_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == context.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    payload = build_session_payload(db, user, requested_state=context.active_state_code)
    return _user_out(user, payload)


@router.post("/active-state")
def set_active_state(
    body: ActiveStateBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    user = db.query(User).filter(User.id == context.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    payload = build_session_payload(db, user, requested_state=body.state_code)
    if payload["active_state_code"] != body.state_code.upper()[:2]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for that state",
        )
    token = mint_ww360_token(payload)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_out(user, payload),
    }
