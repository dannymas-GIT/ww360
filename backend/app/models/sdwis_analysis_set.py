"""Per-user saved PWSID sets for national/state review and comparison."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class SDWISAnalysisSet(Base):
    __tablename__ = "sdwis_analysis_sets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    items = relationship(
        "SDWISAnalysisSetItem",
        back_populates="analysis_set",
        cascade="all, delete-orphan",
        order_by="SDWISAnalysisSetItem.id",
    )


class SDWISAnalysisSetItem(Base):
    __tablename__ = "sdwis_analysis_set_items"
    __table_args__ = (
        UniqueConstraint("set_id", "pwsid", name="uq_sdwis_analysis_set_item"),
    )

    id = Column(Integer, primary_key=True, index=True)
    set_id = Column(Integer, ForeignKey("sdwis_analysis_sets.id", ondelete="CASCADE"), nullable=False)
    pwsid = Column(String(12), nullable=False, index=True)
    pws_name = Column(String(500), nullable=True)
    state_code = Column(String(2), nullable=True)
    population_served = Column(Integer, nullable=True)
    snc = Column(String(64), nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    analysis_set = relationship("SDWISAnalysisSet", back_populates="items")
