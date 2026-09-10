"""Workforce program organizations (e.g. NY OWW) and district memberships."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# Canonical national org for EPA / federal agency tier.
NATIONAL_ORG_CODE = "US_PLATFORM"
NATIONAL_STATE_CODE = "US"


class WorkforceOrganization(Base):
    """National, state, or regional workforce program in the jurisdiction hierarchy.

    Hierarchy: National (US_PLATFORM) → State program (NY_OWW, …) → Utility (via
    OrganizationDistrictMembership).
    """

    __tablename__ = "workforce_organizations"

    org_code = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    org_type = Column(String(50), nullable=False, default="state_program")
    state_code = Column(String(2), nullable=False, default="NY", index=True)
    parent_org_code = Column(
        String(50),
        ForeignKey("workforce_organizations.org_code", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    partner_label = Column(String(255), nullable=True)
    section_label = Column(String(255), nullable=True)
    logo_url = Column(String(500), nullable=True)
    content_pack_key = Column(String(10), nullable=False, default="NY")
    contact_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    website_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    memberships = relationship(
        "OrganizationDistrictMembership",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    user_memberships = relationship(
        "OrganizationUserMembership",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    parent = relationship(
        "WorkforceOrganization",
        remote_side=[org_code],
        foreign_keys=[parent_org_code],
    )


class OrganizationDistrictMembership(Base):
    """Links a water district to a workforce program organization."""

    __tablename__ = "organization_district_memberships"
    __table_args__ = (
        UniqueConstraint(
            "org_code",
            "district_code",
            name="uq_org_district_membership",
        ),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    org_code = Column(
        String(50),
        ForeignKey("workforce_organizations.org_code", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    workforce_package_enabled = Column(Boolean, nullable=False, default=True, server_default="true")

    organization = relationship("WorkforceOrganization", back_populates="memberships")


class OrganizationUserMembership(Base):
    """Binds a user to a state primacy org with an org-scoped role."""

    __tablename__ = "organization_user_memberships"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "org_code",
            name="uq_org_user_membership",
        ),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_code = Column(
        String(50),
        ForeignKey("workforce_organizations.org_code", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(50), nullable=False, default="state_admin")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    organization = relationship("WorkforceOrganization", back_populates="user_memberships")


def ensure_workforce_organization_schema(engine) -> None:
    """Idempotently add national/state-primacy columns and membership table."""
    from sqlalchemy import text

    statements = [
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS state_code VARCHAR(2) NOT NULL DEFAULT 'NY'",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS partner_label VARCHAR(255)",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS section_label VARCHAR(255)",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS content_pack_key VARCHAR(10) NOT NULL DEFAULT 'NY'",
        "ALTER TABLE workforce_organizations ADD COLUMN IF NOT EXISTS parent_org_code VARCHAR(50)",
        """
        CREATE TABLE IF NOT EXISTS organization_user_memberships (
            id VARCHAR(36) PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            org_code VARCHAR(50) NOT NULL REFERENCES workforce_organizations(org_code) ON DELETE CASCADE,
            role VARCHAR(50) NOT NULL DEFAULT 'state_admin',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_org_user_membership UNIQUE (user_id, org_code)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_org_user_memberships_user_id ON organization_user_memberships(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_org_user_memberships_org_code ON organization_user_memberships(org_code)",
        "CREATE INDEX IF NOT EXISTS ix_workforce_organizations_parent ON workforce_organizations(parent_org_code)",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
