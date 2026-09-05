"""Workforce program organizations (e.g. NY OWW) and district memberships."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class WorkforceOrganization(Base):
    """State or regional workforce program that may own document custody."""

    __tablename__ = "workforce_organizations"

    org_code = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    org_type = Column(String(50), nullable=False, default="state_program")
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
