"""District-scoped user management for utility managers/admins and elevated partners."""

from __future__ import annotations

from fastapi import HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.user import User
from app.tenant_auth import TenantContext

DISTRICT_MANAGER_ROLES = frozenset(
    {
        "district_admin",
        "district_manager",
        "ceu_admin",
        "workforce_manager",
        "ceu_manager",
    }
)

STATE_ADMIN_ROLES = frozenset({"state_admin", "oww_partner"})

PROTECTED_ROLES = frozenset(
    {
        "platform_admin",
        "state_admin",
        "oww_partner",
        "national_observer",
        "admin",
    }
)


class DistrictUserOut(BaseModel):
    id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    roles: list[str] = Field(default_factory=list)
    district_memberships: list[str] = Field(default_factory=list)
    is_active: bool = True
    has_recorder_grant: bool = False


class DistrictUserPatch(BaseModel):
    roles: list[str] | None = None
    is_active: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class DistrictUserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    full_name: str | None = Field(default=None, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    roles: list[str] = Field(default_factory=list)


def can_manage_district_users(context: TenantContext, district_code: str) -> bool:
    """True if actor may manage users for this utility (or any, if global)."""
    code = (district_code or "").upper()
    if context.is_global_admin:
        return True
    roles = set(context.roles)
    if roles & STATE_ADMIN_ROLES:
        # State partners may manage any utility in their active state surface.
        return True
    if not code:
        return False
    if not context.has_district_access(code):
        return False
    return bool(roles & DISTRICT_MANAGER_ROLES)


def require_district_user_manager(context: TenantContext, district_code: str) -> None:
    code = district_code.upper()
    if can_manage_district_users(context, code):
        if context.is_global_admin or set(context.roles) & STATE_ADMIN_ROLES:
            return
        if context.has_district_access(code):
            return
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        "Utility manager or admin role required to manage users",
    )


def _user_in_district(user: User, district_code: str) -> bool:
    memberships = [str(c).upper() for c in (user.district_memberships or [])]
    return district_code.upper() in memberships


def _assignable_for_district(db: Session, district_code: str) -> set[str]:
    from app.services.role_catalog_service import get_enabled_utility_roles

    return set(get_enabled_utility_roles(db, district_code))


def list_district_users(db: Session, district_code: str) -> list[User]:
    code = district_code.upper()
    rows = db.query(User).order_by(User.username).all()
    return [u for u in rows if _user_in_district(u, code)]


def create_district_user(
    db: Session,
    context: TenantContext,
    district_code: str,
    body: DistrictUserCreate,
) -> User:
    code = district_code.upper()
    require_district_user_manager(context, code)
    username = body.username.strip()
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already exists")
    if body.email:
        existing_email = db.query(User).filter(User.email == body.email.strip()).first()
        if existing_email:
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")

    assignable = _assignable_for_district(db, code)
    roles = sorted({r.strip() for r in body.roles if r.strip() in assignable})
    if not roles:
        roles = ["district_operator", "ceu_user"]
        roles = [r for r in roles if r in assignable] or sorted(assignable)[:1]

    user = User(
        username=username,
        email=(body.email or None),
        full_name=body.full_name,
        roles=roles,
        district_memberships=[code],
        is_active=True,
    )
    user.set_password(body.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def patch_district_user(
    db: Session,
    context: TenantContext,
    district_code: str,
    user_id: int,
    body: DistrictUserPatch,
) -> User:
    code = district_code.upper()
    require_district_user_manager(context, code)
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not _user_in_district(user, code):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found in this utility")

    if body.roles is not None:
        requested = {r.strip() for r in body.roles if r and str(r).strip()}
        current = set(user.roles or [])
        protected_kept = current & PROTECTED_ROLES
        if (requested & PROTECTED_ROLES) - protected_kept:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Cannot assign national or state roles from utility management",
            )
        assignable = _assignable_for_district(db, code)
        user.roles = sorted(protected_kept | (requested & assignable))

    if body.is_active is not None:
        if user.id == context.user_id and body.is_active is False:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot deactivate yourself")
        user.is_active = body.is_active
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        user.email = body.email
    if body.password:
        user.set_password(body.password)

    db.commit()
    db.refresh(user)
    return user
