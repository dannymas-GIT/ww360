"""WW360 authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api import deps
from app.core.security import verify_password
from app.db.database import get_db
from app.models.user import User
from app.services.auth_service import mint_ww360_token
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


@router.get("/me", response_model=UserOut)
def me(context: TenantContext = Depends(deps.get_current_tenant_user)):
    return UserOut(
        id=context.user_id,
        username=context.username,
        email=context.email,
        roles=context.roles,
        districts=context.assigned_districts,
    )
