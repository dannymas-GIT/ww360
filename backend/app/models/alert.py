from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Boolean,
    Enum,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.db.base_class import Base


class AlertSeverity(str, enum.Enum):
    """Alert severity levels based on threshold percentages of MCL."""

    WARNING = "warning"  # > 50% of MCL
    CRITICAL = "critical"  # > 80% of MCL
    VIOLATION = "violation"  # > 100% of MCL


class AlertStatus(str, enum.Enum):
    """Alert status progression."""

    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SCHEDULED = "scheduled"
    GROUPED = "grouped"  # Alert grouped with other related alerts


class ResolutionCategory(str, enum.Enum):
    """Categories for how alerts were resolved for analytics."""

    FALSE_POSITIVE = "false_positive"
    EQUIPMENT_MALFUNCTION = "equipment_malfunction"
    CONTAMINATION_CONFIRMED = "contamination_confirmed"
    REMEDIATION_COMPLETED = "remediation_completed"
    MONITORING_INCREASED = "monitoring_increased"
    REGULATORY_NOTIFICATION = "regulatory_notification"
    OTHER = "other"


class AlertType(str, enum.Enum):
    """Types of alerts in the system."""

    WATER_QUALITY = "water_quality"  # Traditional water quality threshold alerts
    SAMPLE_DUE = "sample_due"  # Alerts when samples are due but not completed
    MAINTENANCE_DUE = "maintenance_due"  # Alerts when maintenance tasks are due or overdue
    SCHEDULE_CHANGE = "schedule_change"  # Alerts when schedules are changed
    # Legacy alert types (existing in database)
    MCL_EXCEEDANCE = "mcl_exceedance"  # Legacy: MCL exceedance alerts
    QC_FAILURE = "qc_failure"  # Legacy: Quality control failure alerts
    HIGH_UNCERTAINTY = "high_uncertainty"  # Legacy: High uncertainty alerts
    COMBINED = "combined"  # Legacy: Combined alert types
    # Authoritative regulatory monitoring (structured parsers)
    REGULATORY_CHANGE = "regulatory_change"
    HAL_CHANGE = "hal_change"
    NEW_CONSTITUENT = "new_constituent"
    FIRST_DETECT = "first_detect"
    DRASTIC_CHANGE = "drastic_change"
    REGULATORY_PAGE_DRIFT = "regulatory_page_drift"
    BASELINE_MISMATCH = "baseline_mismatch"
    REGULATORY_REVIEW_DUE = "regulatory_review_due"
    # Workforce succession planning (Plan / Hire / Transition / Sustain)
    WORKFORCE_CERT_EXPIRING = "workforce_cert_expiring"
    WORKFORCE_COVERAGE_GAP = "workforce_coverage_gap"
    WORKFORCE_RETIREMENT_HORIZON = "workforce_retirement_horizon"
    WORKFORCE_MILESTONE_OVERDUE = "workforce_milestone_overdue"
    WORKFORCE_CHECKIN_DUE = "workforce_checkin_due"
    WORKFORCE_CEU_SHORTFALL = "workforce_ceu_shortfall"


class Alert(Base):
    """Alert model for water quality threshold exceedances."""

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)

    # Alert type - distinguishes between water quality, sample due, and schedule change alerts
    alert_type = Column(
        Enum(
            AlertType,
            name="alerttype",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=AlertType.WATER_QUALITY,
        nullable=False,
        index=True,
    )

    # Water quality alert fields (nullable for schedule alerts)
    well_id = Column(
        Integer, ForeignKey("wells.id"), nullable=True
    )  # Nullable for schedule alerts
    reading_id = Column(
        Integer, ForeignKey("readings.id"), nullable=True
    )  # Nullable for schedule alerts
    contaminant_name = Column(
        String, index=True, nullable=True
    )  # Nullable for schedule alerts
    result_value = Column(Float, nullable=True)  # Nullable for schedule alerts
    mcl_value = Column(Float, nullable=True)  # Nullable for schedule alerts
    percentage_of_mcl = Column(Float, nullable=True)  # Nullable for schedule alerts
    severity = Column(
        Enum(
            AlertSeverity,
            name="alertseverity",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=True,
    )  # Nullable for schedule alerts

    # Schedule-related alert fields
    schedule_id = Column(
        Integer,
        ForeignKey("sampling_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )  # Set to NULL when schedule is deleted for audit preservation
    event_id = Column(
        Integer, ForeignKey("sampling_events.id"), nullable=True, index=True
    )
    maintenance_schedule_id = Column(
        Integer,
        ForeignKey("maintenance_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    maintenance_task_id = Column(
        Integer,
        ForeignKey("maintenance_tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    alert_config_id = Column(
        Integer, ForeignKey("schedule_alert_configs.id"), nullable=True, index=True
    )

    status = Column(
        Enum(
            AlertStatus,
            name="alertstatus",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=AlertStatus.NEW,
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Basic notes field (existing)
    notes = Column(Text, nullable=True)

    # Enhanced resolution tracking fields
    resolution_notes = Column(Text, nullable=True)  # Detailed resolution notes
    resolution_category = Column(
        Enum(
            ResolutionCategory,
            name="resolutioncategory",
            values_callable=lambda obj: [e.name for e in obj],
        ),
        nullable=True,
    )
    resolved_by = Column(String, nullable=True)  # User who resolved the alert
    resolved_at = Column(DateTime(timezone=True), nullable=True)  # When it was resolved

    # Schedule impact tracking fields
    schedules_affected = Column(Integer, default=0, nullable=False)
    schedule_actions_status = Column(
        String(20), default="none", nullable=False
    )  # none, pending, confirmed, overridden
    regulatory_response_required = Column(Boolean, default=False, nullable=False)
    workflow_group = Column(
        String(50), nullable=True, index=True
    )  # perchlorate, batch_processing, etc.
    processor_type = Column(
        String(50), nullable=True
    )  # Which processor handled this alert

    regulatory_change_id = Column(
        Integer,
        ForeignKey("regulatory_changes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # District decision-routing config version active when this alert was created.
    config_version_at_creation = Column(Integer, nullable=True)

    # Resolved delivery channels from trigger rules (popup/email/sms/recipients/roles).
    delivery_plan = Column(JSON, nullable=True)

    # Escalation chain state (see alert_escalation_policies).
    escalation_tier = Column(Integer, nullable=True)
    next_escalation_at = Column(DateTime(timezone=True), nullable=True)

    # Haunt reminder state (re-notify original recipients until ack/resolve).
    haunt_count = Column(Integer, nullable=True)
    next_haunt_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    well = relationship("Well", back_populates="alerts")
    reading = relationship("Reading")
    schedule_actions = relationship(
        "AlertScheduleAction", back_populates="alert", cascade="all, delete-orphan"
    )
    schedule_changes = relationship(
        "ScheduleChangeHistory", back_populates="alert", cascade="all, delete-orphan"
    )

    # New traceability relationships
    schedule_links = relationship(
        "AlertScheduleLink", back_populates="alert", cascade="all, delete-orphan"
    )
    resolution_summary = relationship(
        "AlertResolutionSummary",
        back_populates="alert",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # Schedule-related relationships
    schedule = relationship("SamplingSchedule", foreign_keys=[schedule_id])
    event = relationship("SamplingEvent", foreign_keys=[event_id])
    maintenance_schedule = relationship(
        "MaintenanceSchedule", foreign_keys=[maintenance_schedule_id]
    )
    maintenance_task = relationship(
        "MaintenanceTask", foreign_keys=[maintenance_task_id]
    )
    alert_config = relationship("ScheduleAlertConfig", foreign_keys=[alert_config_id])
    regulatory_change = relationship(
        "RegulatoryChange", back_populates="linked_alerts", foreign_keys=[regulatory_change_id]
    )
