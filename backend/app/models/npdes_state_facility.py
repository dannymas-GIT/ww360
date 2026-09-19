"""Cached EPA ECHO / ICIS-NPDES state landscape (POTWs and related permits)."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint

from app.db.base_class import Base


class NpdesStateFacility(Base):
    __tablename__ = "npdes_state_facilities"
    __table_args__ = (
        UniqueConstraint("state_code", "npdes_id", name="uq_npdes_state_facility"),
    )

    id = Column(Integer, primary_key=True, index=True)
    state_code = Column(String(2), nullable=False, index=True)
    npdes_id = Column(String(15), nullable=False, index=True)
    facility_name = Column(String(500), nullable=True)
    county = Column(String(255), nullable=True)
    facility_type_code = Column(String(32), nullable=True)  # POTW / NON-POTW
    permit_type = Column(String(64), nullable=True)
    major_minor = Column(String(16), nullable=True)
    sic_code = Column(String(16), nullable=True)
    design_flow_mgd = Column(Float, nullable=True)
    total_design_flow = Column(Float, nullable=True)
    permit_effective = Column(String(32), nullable=True)
    permit_expiration = Column(String(32), nullable=True)
    snc = Column(String(64), nullable=True)
    qtrs_with_nc = Column(Integer, nullable=True)
    owner_type = Column(String(64), nullable=True)
    # NY SPDES plant classification (1–4 / 1A–4A); nullable elsewhere
    plant_class = Column(String(16), nullable=True)
    last_refreshed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
