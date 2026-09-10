"""External metric snapshots, roster aggregates, and KPI definitions."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.base_class import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class ExternalMetricSnapshot(Base):
    __tablename__ = "external_metric_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "source",
            "scope_type",
            "scope_code",
            "metric_key",
            "as_of",
            name="uq_external_metric_snapshot",
        ),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    source = Column(String(64), nullable=False, index=True)
    scope_type = Column(String(16), nullable=False, index=True)  # us | region | state | county
    scope_code = Column(String(16), nullable=False, index=True)
    metric_key = Column(String(128), nullable=False, index=True)
    value_numeric = Column(Float, nullable=True)
    value_json = Column(JSONB, nullable=True)
    as_of = Column(String(32), nullable=False)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    provenance_url = Column(String(512), nullable=True)
    license_note = Column(Text, nullable=True)


class StateOperatorCertAggregate(Base):
    """Aggregate certified operator counts — no PII."""

    __tablename__ = "state_operator_cert_aggregates"
    __table_args__ = (
        UniqueConstraint(
            "state_code",
            "county",
            "grade_code",
            "expiration_month",
            name="uq_state_opcert_aggregate",
        ),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    state_code = Column(String(2), nullable=False, index=True)
    county = Column(String(64), nullable=True, index=True)
    grade_code = Column(String(32), nullable=False, index=True)
    expiration_month = Column(String(7), nullable=True, index=True)  # YYYY-MM
    operator_count = Column(Integer, nullable=False, default=0)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class KpiDefinition(Base):
    __tablename__ = "kpi_definitions"

    id = Column(String(36), primary_key=True, default=_uuid)
    owner_scope = Column(String(16), nullable=False, index=True)
    owner_code = Column(String(64), nullable=False, index=True)
    metric_key = Column(String(128), nullable=False)
    label = Column(String(255), nullable=False)
    target_value = Column(Float, nullable=True)
    direction = Column(String(16), nullable=False, default="higher_better")
    warn_threshold = Column(Float, nullable=True)
    critical_threshold = Column(Float, nullable=True)
    cadence = Column(String(16), nullable=False, default="monthly")
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class KpiSnapshot(Base):
    __tablename__ = "kpi_snapshots"

    id = Column(String(36), primary_key=True, default=_uuid)
    definition_id = Column(String(36), nullable=False, index=True)
    as_of = Column(String(32), nullable=False)
    value = Column(Float, nullable=True)
    computed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


def ensure_national_schema(engine) -> None:
    from sqlalchemy import inspect

    insp = inspect(engine)
    for table in (
        ExternalMetricSnapshot,
        StateOperatorCertAggregate,
        KpiDefinition,
        KpiSnapshot,
    ):
        if not insp.has_table(table.__tablename__):
            table.__table__.create(bind=engine, checkfirst=True)
