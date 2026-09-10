"""Last captured PWSID per district for SDWIS link flow."""

from datetime import datetime

from sqlalchemy import Column, DateTime, String

from app.db.base_class import Base


class SDWISDistrictRememberedPwsid(Base):
    __tablename__ = "sdwis_district_remembered_pwsid"

    district_code = Column(String(64), primary_key=True, index=True)
    pwsid = Column(String(12), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
