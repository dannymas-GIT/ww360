"""Platform admin: list and update WW360 local users."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.tenant_auth import TenantContext

router = APIRouter()


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
