"""Cached EPA ECHO state landscape (all active systems per state)."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint

from app.db.base_class import Base


class SDWISStateSystem(Base):
    __tablename__ = "sdwis_state_systems"
    __table_args__ = (
        UniqueConstraint("state_code", "pwsid", name="uq_sdwis_state_system"),
    )

    id = Column(Integer, primary_key=True, index=True)
    state_code = Column(String(2), nullable=False, index=True)
    pwsid = Column(String(12), nullable=False, index=True)
    pws_name = Column(String(500), nullable=True)
    county = Column(String(255), nullable=True)
    pws_type = Column(String(32), nullable=True)
    owner_type = Column(String(64), nullable=True)
    population_served = Column(Integer, nullable=True)
    serious_violator = Column(String(16), nullable=True)
    health_flag = Column(String(16), nullable=True)
    snc = Column(String(64), nullable=True)
    qtrs_with_vio = Column(Integer, nullable=True)
    qtrs_with_snc = Column(Integer, nullable=True)
    last_refreshed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
