"""SDWIS violation rows synced from EPA DFR."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Index, UniqueConstraint

from app.db.base_class import Base


class SDWISViolation(Base):
    __tablename__ = "sdwis_violations"
    __table_args__ = (
        UniqueConstraint("pwsid", "violation_epa_id", name="uq_sdwis_violation_pwsid_epa_id"),
        Index("ix_sdwis_violations_pwsid", "pwsid"),
    )

    id = Column(Integer, primary_key=True, index=True)
    pwsid = Column(String(12), nullable=False)
    violation_epa_id = Column(String(64), nullable=False)

    rule_name = Column(String(500), nullable=True)
    contaminant_name = Column(String(500), nullable=True)
    category_code = Column(String(32), nullable=True)
    category_desc = Column(String(500), nullable=True)
    violation_measure = Column(String(255), nullable=True)
    state_mcl = Column(String(128), nullable=True)
    federal_mcl = Column(String(128), nullable=True)

    compliance_period_begin = Column(String(64), nullable=True)
    compliance_period_end = Column(String(64), nullable=True)
    non_compliance_begin = Column(String(64), nullable=True)
    non_compliance_end = Column(String(64), nullable=True)
    resolved_date = Column(String(64), nullable=True)
    status = Column(String(64), nullable=True)

    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
