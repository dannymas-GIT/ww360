"""SDWIS enforcement actions from EPA DFR."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, Index, UniqueConstraint

from app.db.base_class import Base


class SDWISEnforcementAction(Base):
    __tablename__ = "sdwis_enforcement_actions"
    __table_args__ = (
        UniqueConstraint(
            "pwsid",
            "enforcement_epa_id",
            name="uq_sdwis_enforcement_pwsid_epa_id",
        ),
        Index("ix_sdwis_enforcement_pwsid", "pwsid"),
    )

    id = Column(Integer, primary_key=True, index=True)
    pwsid = Column(String(12), nullable=False)
    enforcement_epa_id = Column(String(64), nullable=False)

    enforcement_type = Column(String(128), nullable=True)
    action_description = Column(Text, nullable=True)
    action_date = Column(String(64), nullable=True)
    agency = Column(String(32), nullable=True)

    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
