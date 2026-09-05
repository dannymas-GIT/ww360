"""Cached SDWIS / ECHO public water system summary (per PWSID)."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, JSON

from app.db.base_class import Base


class SDWISWaterSystem(Base):
    __tablename__ = "sdwis_water_systems"

    id = Column(Integer, primary_key=True, index=True)
    pwsid = Column(String(12), unique=True, nullable=False, index=True)
    district_code = Column(String(64), nullable=True, index=True)

    pws_name = Column(String(500), nullable=True)
    state_code = Column(String(2), nullable=True, index=True)
    epa_region = Column(String(32), nullable=True)
    registry_id = Column(String(64), nullable=True)

    pws_type_code = Column(String(32), nullable=True)
    pws_type_desc = Column(String(750), nullable=True)
    primary_source_code = Column(String(16), nullable=True)
    primary_source_desc = Column(String(750), nullable=True)
    owner_type_code = Column(String(8), nullable=True)
    owner_desc = Column(String(750), nullable=True)

    population_served = Column(Integer, nullable=True)
    counties_served = Column(Text, nullable=True)
    cities_served = Column(Text, nullable=True)

    serious_violator = Column(String(16), nullable=True)
    health_flag = Column(String(16), nullable=True)
    snc = Column(String(64), nullable=True)
    qtrs_with_vio = Column(Integer, nullable=True)
    qtrs_with_snc = Column(Integer, nullable=True)

    compliance_qtrs_history = Column(Text, nullable=True)
    contaminants_in_current_violation = Column(Text, nullable=True)
    violation_categories = Column(Text, nullable=True)
    dfr_url = Column(Text, nullable=True)

    facility_status = Column(String(64), nullable=True)
    universe_summary = Column(Text, nullable=True)
    areas_summary = Column(Text, nullable=True)

    raw_compliance_status_json = Column(JSON, nullable=True)

    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
