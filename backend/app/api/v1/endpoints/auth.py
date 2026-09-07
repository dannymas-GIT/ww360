"""WW360 authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.core.security import verify_password
from app.db.database import get_db
from app.models.user import User
from app.services.auth_service import mint_ww360_token
from app.services import sso_auth_service
from app.tenant_auth import TenantContext, build_user_token_payload

router = APIRouter()


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


class SsoCallbackBody(BaseModel):
    provider: str = Field(..., description="microsoft_graph or google_drive")
    code: str
    redirect_uri: str
    state: str | None = None


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(body.password, user.hashed_password or ""):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    payload = build_user_token_payload(user)
    token = mint_ww360_token(payload)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserOut(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            roles=list(user.roles or []),
            districts=payload.get("district_memberships") or [],
        ),
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
    roles = list(context.roles or [])
    districts = list(context.assigned_districts or [])
    if user:
        if not roles:
            roles = list(user.roles or [])
        if not districts:
            districts = list(user.district_memberships or [])
    return UserOut(
        id=context.user_id,
        username=context.username,
        email=context.email or (user.email if user else None),
        full_name=user.full_name if user else None,
        roles=roles,
        districts=districts,
    )
