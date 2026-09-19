"""Models synced from AquaSafe (read-only mirrors) + sync inbox."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.base_class import Base


class ExtUser(Base):
    """Mirror of AquaSafe users table (subset)."""

    __tablename__ = "ext_users"

    id = Column(Integer, primary_key=True)
    username = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    roles = Column(JSONB, nullable=False, default=list)
    version = Column(Integer, nullable=False, default=1)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ExtDistrict(Base):
    """Mirror of AquaSafe water_districts (subset for workforce FK compatibility)."""

    __tablename__ = "ext_districts"

    id = Column(Integer, primary_key=True)
    district_code = Column(String(50), nullable=False, unique=True, index=True)
    district_name = Column(String(255), nullable=False)
    state_code = Column(String(2), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ExtDistrictMembership(Base):
    __tablename__ = "ext_district_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "district_code", name="uq_ext_membership_user_district"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    district_code = Column(String(50), nullable=False, index=True)
    roles = Column(JSONB, nullable=False, default=list)
    version = Column(Integer, nullable=False, default=1)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ExtModuleFlag(Base):
    __tablename__ = "ext_module_flags"
    __table_args__ = (
        UniqueConstraint("district_code", "module_key", name="uq_ext_module_district"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    district_code = Column(String(50), nullable=False, index=True)
    module_key = Column(String(64), nullable=False)
    enabled = Column(Boolean, nullable=False, default=False)
    version = Column(Integer, nullable=False, default=1)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SyncInbox(Base):
    """Idempotent event log from AquaSafe outbox."""

    __tablename__ = "sync_inbox"

    event_id = Column(String(64), primary_key=True)
    aggregate = Column(String(64), nullable=False, index=True)
    aggregate_id = Column(String(64), nullable=False)
    event_type = Column(String(64), nullable=False)
    payload = Column(JSONB, nullable=False)
    version = Column(Integer, nullable=False)
    received_at = Column(DateTime, server_default=func.now(), nullable=False)
    processed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)


class SyncCursor(Base):
    __tablename__ = "sync_cursor"

    entity = Column(String(64), primary_key=True)
    last_version = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ExtFacility(Base):
    """Facility registry mirrored from AquaSafe (PWS) and wastewater app (WWTP)."""

    __tablename__ = "ext_facilities"
    __table_args__ = (
        UniqueConstraint("publisher", "facility_id", name="uq_ext_facility_publisher_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    publisher = Column(String(64), nullable=False, index=True)  # aquasafe | aquasafe-wastewater
    facility_id = Column(String(128), nullable=False, index=True)
    district_code = Column(String(50), nullable=False, index=True)
    facility_type = Column(String(32), nullable=False, index=True)  # pws | wwtp | collection_system
    name = Column(String(255), nullable=False)
    state_code = Column(String(2), nullable=True, index=True)
    pwsid = Column(String(12), nullable=True, index=True)
    npdes_id = Column(String(15), nullable=True, index=True)
    spdes_id = Column(String(15), nullable=True)
    plant_class = Column(String(16), nullable=True)
    design_flow_mgd = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    synced_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
