"""WW360 role catalog: National → State defaults, utility fine-tuning."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.db.base_class import Base
from app.tenant_auth import TenantContext

RoleTier = Literal["national", "state", "utility"]
UtilityRoleCategory = Literal["administration", "workforce", "ceu", "operator"]


class RoleCatalogEntry(BaseModel):
    key: str
    label: str
    tier: RoleTier
    description: str
    default_enabled: bool = True
    assignable_at_utility: bool = False
    category: UtilityRoleCategory | None = None


# Locked national/state templates. Utility managers fine-tune which utility-tier
# roles are offered in their district; they cannot invent national/state roles.
ROLE_CATALOG: list[RoleCatalogEntry] = [
    RoleCatalogEntry(
        key="platform_admin",
        label="Platform admin",
        tier="national",
        description="Full WW360 platform administration (EPA / national ops).",
    ),
    RoleCatalogEntry(
        key="national_observer",
        label="National observer",
        tier="national",
        description="Read national overviews and cross-state scorecards.",
    ),
    RoleCatalogEntry(
        key="state_admin",
        label="State admin",
        tier="state",
        description="State primacy / OWW program administration.",
    ),
    RoleCatalogEntry(
        key="oww_partner",
        label="OWW partner",
        tier="state",
        description="One Water Workforce partner (NY compat with state_admin).",
    ),
    RoleCatalogEntry(
        key="district_admin",
        label="Utility admin",
        tier="utility",
        description="Full utility administration including users and settings.",
        assignable_at_utility=True,
        category="administration",
    ),
    RoleCatalogEntry(
        key="district_manager",
        label="Utility manager",
        tier="utility",
        description="Manage workforce, documentation, and operator access.",
        assignable_at_utility=True,
        category="administration",
    ),
    RoleCatalogEntry(
        key="workforce_manager",
        label="Workforce manager",
        tier="utility",
        description="Continuity, succession, and documentation oversight.",
        assignable_at_utility=True,
        category="workforce",
    ),
    RoleCatalogEntry(
        key="ceu_admin",
        label="CEU admin",
        tier="utility",
        description="Administer CEU plans and training for the utility.",
        assignable_at_utility=True,
        category="ceu",
    ),
    RoleCatalogEntry(
        key="ceu_manager",
        label="CEU manager",
        tier="utility",
        description="Review CEU progress and renewals.",
        assignable_at_utility=True,
        category="ceu",
    ),
    RoleCatalogEntry(
        key="district_operator",
        label="Operator",
        tier="utility",
        description="Plant / field operator with documentation tasks.",
        assignable_at_utility=True,
        category="operator",
    ),
    RoleCatalogEntry(
        key="workforce_operator",
        label="Workforce operator",
        tier="utility",
        description="Operator focused on workforce continuity workflows.",
        assignable_at_utility=True,
        category="operator",
    ),
    RoleCatalogEntry(
        key="ceu_user",
        label="CEU learner",
        tier="utility",
        description="Track CEU hours and assigned training.",
        assignable_at_utility=True,
        category="ceu",
    ),
    RoleCatalogEntry(
        key="district_viewer",
        label="Utility viewer",
        tier="utility",
        description="Read-only access to utility workforce data.",
        assignable_at_utility=True,
        default_enabled=False,
        category="operator",
    ),
]

# Default utility pack applied when a district has no fine-tuning row yet.
DEFAULT_UTILITY_ENABLED = frozenset(
    e.key for e in ROLE_CATALOG if e.assignable_at_utility and e.default_enabled
)


class DistrictRoleSettings(Base):
    """Per-utility fine-tune of which catalog roles are offered for assignment."""

    __tablename__ = "district_role_settings"

    district_code = Column(String(50), primary_key=True)
    enabled_roles = Column(JSONB, nullable=False, default=list)
    notes = Column(Text, nullable=True)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


def ensure_role_catalog_schema(engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS district_role_settings (
                    district_code VARCHAR(50) PRIMARY KEY,
                    enabled_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
                    notes TEXT,
                    updated_by VARCHAR(255),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
        )


class RoleCatalogOut(BaseModel):
    hierarchy_note: str = "National → State → Utility"
    national: list[RoleCatalogEntry]
    state: list[RoleCatalogEntry]
    utility: list[RoleCatalogEntry]
    utility_enabled: list[str] = Field(default_factory=list)
    district_code: str | None = None
    can_fine_tune: bool = False


class DistrictRoleSettingsPatch(BaseModel):
    enabled_roles: list[str] = Field(min_length=1)
    notes: str | None = None


def catalog_by_tier() -> dict[str, list[RoleCatalogEntry]]:
    return {
        "national": [e for e in ROLE_CATALOG if e.tier == "national"],
        "state": [e for e in ROLE_CATALOG if e.tier == "state"],
        "utility": [e for e in ROLE_CATALOG if e.tier == "utility"],
    }


def utility_assignable_keys() -> set[str]:
    return {e.key for e in ROLE_CATALOG if e.assignable_at_utility}


def get_enabled_utility_roles(db: Session, district_code: str) -> list[str]:
    code = district_code.upper()
    row = db.query(DistrictRoleSettings).filter(DistrictRoleSettings.district_code == code).first()
    allowed = utility_assignable_keys()
    if not row or not isinstance(row.enabled_roles, list) or not row.enabled_roles:
        return sorted(DEFAULT_UTILITY_ENABLED & allowed)
    return sorted({str(r) for r in row.enabled_roles if str(r) in allowed})


def build_catalog_out(
    db: Session,
    context: TenantContext,
    district_code: str | None,
) -> RoleCatalogOut:
    tiers = catalog_by_tier()
    code = (district_code or "").upper() or None
    enabled: list[str] = []
    can_tune = False
    if code:
        from app.services.district_user_service import can_manage_district_users

        if can_manage_district_users(context, code):
            enabled = get_enabled_utility_roles(db, code)
            can_tune = True
    return RoleCatalogOut(
        national=tiers["national"],
        state=tiers["state"],
        utility=tiers["utility"],
        utility_enabled=enabled,
        district_code=code,
        can_fine_tune=can_tune,
    )


def patch_district_role_settings(
    db: Session,
    context: TenantContext,
    district_code: str,
    body: DistrictRoleSettingsPatch,
) -> RoleCatalogOut:
    from app.services.district_user_service import require_district_user_manager

    code = district_code.upper()
    require_district_user_manager(context, code)
    allowed = utility_assignable_keys()
    enabled = sorted({r.strip() for r in body.enabled_roles if r.strip() in allowed})
    if not enabled:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Select at least one utility role from the catalog",
        )
    row = db.query(DistrictRoleSettings).filter(DistrictRoleSettings.district_code == code).first()
    if not row:
        row = DistrictRoleSettings(district_code=code, enabled_roles=enabled)
        db.add(row)
    else:
        row.enabled_roles = enabled
    if body.notes is not None:
        row.notes = body.notes
    row.updated_by = context.username
    db.commit()
    return build_catalog_out(db, context, code)
