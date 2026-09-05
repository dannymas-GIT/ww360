"""
Workforce succession planning models.

Tightly scoped, planning-grade workforce dataset that operationalizes the
*One Water Workforce Succession Planning Toolkit*. Intentionally narrow:
no payroll, benefits, performance reviews, or demographic data. Sensitive
records inherit the same district-scoped tenancy boundary as lab data.

See ``docs/workforce_succession/DATA_STRATEGY.md`` for the design rationale
and the cross-domain insight patterns that connect these tables to AquaSafe's
existing operational data.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


# District-scoped status string used by the staging-and-review intake (mirrors
# the lab-data flow: "staged" then either "active" or "rejected").
WORKFORCE_RECORD_STATES = ("staged", "active", "rejected", "archived")


class WorkforcePosition(Base):
    """A funded or planned position within a district org structure."""

    __tablename__ = "workforce_positions"
    __table_args__ = (
        UniqueConstraint(
            "district_code", "position_code", name="uq_workforce_positions_district_code"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(100), nullable=True, index=True)

    position_code = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    civil_service_classification = Column(String(100), nullable=True)
    civil_service_grade = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True, index=True)
    reports_to_position_code = Column(String(50), nullable=True)
    reports_to_position_id = Column(
        Integer,
        ForeignKey("workforce_positions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    fte_count = Column(Integer, nullable=True, default=1)
    is_funded = Column(Boolean, nullable=False, default=True)
    is_vacant = Column(Boolean, nullable=False, default=False, index=True)
    vacancy_since = Column(Date, nullable=True)

    notes = Column(Text, nullable=True)
    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    employees = relationship(
        "WorkforceEmployee",
        primaryjoin=(
            "and_(WorkforcePosition.district_code == foreign(WorkforceEmployee.district_code), "
            "WorkforcePosition.position_code == foreign(WorkforceEmployee.position_code))"
        ),
        viewonly=True,
    )


class WorkforceEmployee(Base):
    """A role-holder. Planning-grade only, never an HRIS substitute."""

    __tablename__ = "workforce_employees"
    __table_args__ = (
        UniqueConstraint(
            "district_code", "employee_code", name="uq_workforce_employees_district_code"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(100), nullable=True, index=True)
    employee_code = Column(String(50), nullable=False, index=True)

    full_name = Column(String(255), nullable=False)
    work_email = Column(String(255), nullable=True)
    work_phone = Column(String(50), nullable=True)
    home_phone = Column(String(50), nullable=True)
    home_email = Column(String(255), nullable=True)
    home_address_line1 = Column(String(255), nullable=True)
    home_address_line2 = Column(String(255), nullable=True)
    home_city = Column(String(100), nullable=True)
    home_state = Column(String(10), nullable=True)
    home_zip = Column(String(20), nullable=True)
    county_of_employment = Column(String(100), nullable=True)
    is_veteran = Column(Boolean, nullable=True)
    is_contract_operator = Column(Boolean, nullable=True)
    operator_grade = Column(String(50), nullable=True, index=True)

    position_code = Column(String(50), nullable=True, index=True)
    position_id = Column(
        Integer,
        ForeignKey("workforce_positions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    hire_date = Column(Date, nullable=True)
    retirement_eligible_date = Column(Date, nullable=True, index=True)
    planned_departure_date = Column(Date, nullable=True, index=True)

    linked_aquasafe_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    is_active = Column(Boolean, nullable=False, default=True, index=True)
    notes = Column(Text, nullable=True)
    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    linked_user = relationship("User", foreign_keys=[linked_aquasafe_user_id])
    certifications = relationship(
        "WorkforceCertification",
        back_populates="employee",
        cascade="all, delete-orphan",
    )


class WorkforceCertification(Base):
    """Operator licenses, CDL, OSHA, confined space, lab certs, etc."""

    __tablename__ = "workforce_certifications"
    __table_args__ = (
        UniqueConstraint(
            "district_code",
            "employee_code",
            "certification_type",
            "certification_grade",
            "credential_id",
            name="uq_workforce_certifications_unique",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(100), nullable=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("workforce_employees.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    employee_code = Column(String(50), nullable=False, index=True)

    certification_type = Column(String(100), nullable=False, index=True)
    certification_grade = Column(String(50), nullable=True)
    issuing_authority = Column(String(100), nullable=True)
    credential_id = Column(String(100), nullable=True)

    issued_date = Column(Date, nullable=True)
    expiration_date = Column(Date, nullable=True, index=True)

    is_required_for_role = Column(Boolean, nullable=False, default=False)
    notes = Column(Text, nullable=True)
    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    employee = relationship("WorkforceEmployee", back_populates="certifications")


class WorkforceCriticalFunction(Base):
    """A discrete operational responsibility that must always have coverage.

    Bridges workforce planning to AquaSafe operational entities via the
    optional ``linked_*`` columns (facility, sampling schedule, regulatory
    program). The continuity dashboard uses these links to compute backup
    depth and risk overlays.
    """

    __tablename__ = "workforce_critical_functions"
    __table_args__ = (
        UniqueConstraint(
            "district_code", "function_code", name="uq_workforce_functions_district_code"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(100), nullable=True, index=True)

    function_code = Column(String(50), nullable=False, index=True)
    function_name = Column(String(255), nullable=False)
    function_area = Column(String(100), nullable=True, index=True)
    description = Column(Text, nullable=True)

    linked_facility_id = Column(Integer, nullable=True, index=True)
    linked_schedule_id = Column(Integer, nullable=True, index=True)
    linked_program = Column(String(100), nullable=True, index=True)

    required_certification_type = Column(String(100), nullable=True)
    required_certification_grade = Column(String(50), nullable=True)

    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    coverage = relationship(
        "WorkforceRoleCoverage",
        back_populates="function",
        cascade="all, delete-orphan",
    )


class WorkforceRoleCoverage(Base):
    """Primary / backup / trainee assignment per critical function."""

    __tablename__ = "workforce_role_coverage"
    __table_args__ = (
        UniqueConstraint(
            "district_code",
            "function_code",
            "employee_code",
            "coverage_role",
            name="uq_workforce_role_coverage_unique",
        ),
    )

    COVERAGE_ROLES = ("primary", "backup", "trainee", "interim")
    PROFICIENCY_LEVELS = ("trainee", "developing", "proficient", "expert")

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(100), nullable=True, index=True)

    function_id = Column(
        Integer,
        ForeignKey("workforce_critical_functions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    function_code = Column(String(50), nullable=False, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("workforce_employees.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    employee_code = Column(String(50), nullable=False, index=True)

    coverage_role = Column(String(20), nullable=False, default="primary", index=True)
    proficiency_level = Column(String(20), nullable=True)
    last_performed_date = Column(Date, nullable=True)

    notes = Column(Text, nullable=True)
    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    function = relationship("WorkforceCriticalFunction", back_populates="coverage")


class WorkforceSuccessionCandidate(Base):
    """Internal candidate identified for an upstream role with readiness data."""

    __tablename__ = "workforce_succession_candidates"
    __table_args__ = (
        UniqueConstraint(
            "district_code",
            "employee_code",
            "target_position_code",
            name="uq_workforce_succession_unique",
        ),
    )

    READINESS_LEVELS = ("now", "0-12mo", "12-24mo", "24-36mo", "longer")

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(100), nullable=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("workforce_employees.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    employee_code = Column(String(50), nullable=False, index=True)

    target_position_code = Column(String(50), nullable=False, index=True)
    target_position_id = Column(
        Integer,
        ForeignKey("workforce_positions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    readiness_level = Column(String(20), nullable=True)
    readiness_target_date = Column(Date, nullable=True)

    training_plan_summary = Column(Text, nullable=True)
    mentor_employee_code = Column(String(50), nullable=True)
    mentor_employee_id = Column(
        Integer,
        ForeignKey("workforce_employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    notes = Column(Text, nullable=True)
    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkforceKnowledgeArtifact(Base):
    """A captured SOP, decision-history, vendor-contact, or troubleshooting record."""

    __tablename__ = "workforce_knowledge_artifacts"
    __table_args__ = (
        UniqueConstraint(
            "district_code", "external_id", name="uq_workforce_knowledge_external"
        ),
    )

    ARTIFACT_TYPES = (
        "sop",
        "decision_history",
        "troubleshooting",
        "vendor_contact",
        "interview_transcript",
        "training_note",
    )

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(100), nullable=True, index=True)

    function_id = Column(
        Integer,
        ForeignKey("workforce_critical_functions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    function_code = Column(String(50), nullable=True, index=True)

    artifact_type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)

    source_employee_code = Column(String(50), nullable=True, index=True)
    source_employee_id = Column(
        Integer,
        ForeignKey("workforce_employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    captured_by = Column(String(255), nullable=True)
    captured_date = Column(Date, nullable=True, index=True)

    verified_by = Column(String(255), nullable=True)
    verified_date = Column(Date, nullable=True)

    storage_uri = Column(String(500), nullable=True)
    document_id = Column(
        String(36),
        ForeignKey("doc_documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    notes = Column(Text, nullable=True)
    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkforceTransitionMilestone(Base):
    """Plan / Hire / Transition / Sustain milestone for a position transition."""

    __tablename__ = "workforce_transition_milestones"
    __table_args__ = (
        UniqueConstraint(
            "district_code",
            "position_code",
            "milestone_type",
            "external_id",
            name="uq_workforce_transition_milestones_unique",
        ),
    )

    MILESTONE_TYPES = (
        "announcement",
        "knowledge_capture",
        "search_committee",
        "posting",
        "interview",
        "offer",
        "handoff",
        "checkin_30",
        "checkin_60",
        "checkin_90",
        "checkin_180",
        "review",
    )

    STATUS_VALUES = ("planned", "in_progress", "complete", "blocked", "skipped")

    TOOLKIT_PHASES = ("plan", "hire", "transition", "sustain")

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(100), nullable=True, index=True)

    position_code = Column(String(50), nullable=False, index=True)
    position_id = Column(
        Integer,
        ForeignKey("workforce_positions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    milestone_type = Column(String(40), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    owner_employee_code = Column(String(50), nullable=True, index=True)
    owner_employee_id = Column(
        Integer,
        ForeignKey("workforce_employees.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    target_date = Column(Date, nullable=True, index=True)
    completed_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="planned", index=True)
    toolkit_phase = Column(String(20), nullable=False, default="plan", index=True)

    notes = Column(Text, nullable=True)
    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkforcePlanningSession(Base):
    """Resumable wizard session for guided workforce succession data entry.

    Acts as a draft store so a user can fill out the multi-step succession
    questionnaire over multiple sittings without writing partial rows into
    the planning tables. The full payload (positions, employees, certs,
    etc.) is held as JSON until the user explicitly publishes the session,
    at which point the same validation and upsert pipeline used by the CSV
    importer is applied.

    One open (``status='draft'``) session per ``(district_code, user)`` keeps
    the resume UX simple. Published sessions are kept for audit.
    """

    __tablename__ = "workforce_planning_sessions"

    STATUS_VALUES = ("draft", "ready", "publishing", "published", "abandoned")

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    created_by_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title = Column(String(255), nullable=True)
    current_step = Column(String(50), nullable=False, default="welcome")
    completed_steps = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="draft", index=True)
    payload_json = Column(Text, nullable=False, default="{}")
    validation_summary = Column(Text, nullable=True)

    last_saved_at = Column(DateTime, server_default=func.now(), nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    published_batch_id = Column(
        Integer,
        ForeignKey("workforce_import_batches.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    created_by = relationship("User", foreign_keys=[created_by_user_id])


class WorkforceImportBatch(Base):
    """Header for a workforce CSV intake (one entity_type per upload).

    Mirrors the staging-then-promote shape used by lab data so reviewers can
    see what was loaded, accept it, or reject it before it becomes active.
    """

    __tablename__ = "workforce_import_batches"

    STATUS_VALUES = ("staged", "promoted", "rejected", "partial")

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    entity_type = Column(String(50), nullable=False, index=True)
    original_filename = Column(String(255), nullable=True)

    submitted_by_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    total_rows = Column(Integer, nullable=False, default=0)
    rows_valid = Column(Integer, nullable=False, default=0)
    rows_invalid = Column(Integer, nullable=False, default=0)
    rows_promoted = Column(Integer, nullable=False, default=0)

    status = Column(String(20), nullable=False, default="staged", index=True)
    validation_summary = Column(Text, nullable=True)

    reviewer_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    submitted_by = relationship("User", foreign_keys=[submitted_by_user_id])
    reviewer = relationship("User", foreign_keys=[reviewer_user_id])


class WorkforceCeuRecord(Base):
    """Continuing education unit (CEU) completion for operator recertification."""

    __tablename__ = "workforce_ceu_records"
    __table_args__ = (
        UniqueConstraint(
            "district_code",
            "employee_code",
            "course_title",
            "completion_date",
            name="uq_workforce_ceu_records_unique",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    external_id = Column(String(100), nullable=True, index=True)
    employee_id = Column(
        Integer,
        ForeignKey("workforce_employees.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    employee_code = Column(String(50), nullable=False, index=True)
    certification_id = Column(
        Integer,
        ForeignKey("workforce_certifications.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    certification_grade = Column(String(50), nullable=True, index=True)

    course_title = Column(String(255), nullable=False)
    provider = Column(String(255), nullable=True)
    approval_number = Column(String(100), nullable=True)
    ceu_hours = Column(Float, nullable=False, default=0.0)
    contact_hours = Column(Float, nullable=True)
    completion_date = Column(Date, nullable=False, index=True)
    category = Column(String(100), nullable=True, index=True)
    renewal_cycle_start = Column(Date, nullable=True, index=True)
    renewal_cycle_end = Column(Date, nullable=True, index=True)
    notes = Column(Text, nullable=True)
    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    employee = relationship("WorkforceEmployee", foreign_keys=[employee_id])
    certification = relationship("WorkforceCertification", foreign_keys=[certification_id])
    vouchers = relationship(
        "WorkforceCeuVoucher",
        back_populates="ceu_record",
        cascade="all, delete-orphan",
    )


class WorkforceCeuVoucher(Base):
    """Signed voucher document attached to a CEU record."""

    __tablename__ = "workforce_ceu_vouchers"

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    ceu_record_id = Column(
        Integer,
        ForeignKey("workforce_ceu_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename = Column(String(512), nullable=False)
    content_type = Column(String(255), nullable=True)
    file_extension = Column(String(16), nullable=False)
    size_bytes = Column(Integer, nullable=False, default=0)
    description = Column(Text, nullable=True)
    storage_kind = Column(String(16), nullable=False, default="local")
    blob_name = Column(String(1024), nullable=True)
    file_path = Column(String(1024), nullable=True)
    uploaded_by_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    ceu_record = relationship("WorkforceCeuRecord", back_populates="vouchers")


class WorkforceTrainingCourse(Base):
    """Statewide NYS DOH operator training course catalog (scraped reference data)."""

    __tablename__ = "workforce_training_courses"
    __table_args__ = (
        UniqueConstraint("natural_key_hash", name="uq_workforce_training_courses_natural_key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(2), nullable=False, default="NY", index=True)
    source = Column(String(50), nullable=False, default="NYSDOH", index=True)
    cert_program = Column(String(50), nullable=False, default="drinking_water", index=True)
    cert_type = Column(String(50), nullable=False, index=True)
    course_category = Column(String(20), nullable=False, index=True)
    sponsor = Column(String(255), nullable=False)
    course_name = Column(String(500), nullable=False)
    grade = Column(String(50), nullable=True, index=True)
    start_date = Column(Date, nullable=True, index=True)
    end_date = Column(Date, nullable=True, index=True)
    cost_text = Column(String(100), nullable=True)
    cost_amount = Column(Float, nullable=True)
    contact_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    county = Column(String(100), nullable=True, index=True)
    city = Column(String(100), nullable=True, index=True)
    location_text = Column(String(500), nullable=True)
    delivery_mode = Column(String(20), nullable=True, index=True)
    delivery_type_label = Column(String(50), nullable=True)
    contact_hours = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    source_url = Column(String(1000), nullable=True)
    source_anchor = Column(String(100), nullable=True)
    natural_key_hash = Column(String(64), nullable=False, index=True)
    content_hash = Column(String(64), nullable=True)
    first_seen_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_seen_at = Column(DateTime, server_default=func.now(), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkforceScheduledTraining(Base):
    """District-managed upcoming training event (distinct from statewide catalog)."""

    __tablename__ = "workforce_scheduled_trainings"

    DELIVERY_MODES = ("in_person", "virtual", "hybrid")
    STATUS_VALUES = ("scheduled", "completed", "cancelled")

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    title = Column(String(500), nullable=False)
    provider = Column(String(255), nullable=False)
    location = Column(String(500), nullable=True)
    delivery_mode = Column(String(20), nullable=False, default="in_person", index=True)
    start_datetime = Column(DateTime, nullable=False, index=True)
    end_datetime = Column(DateTime, nullable=True, index=True)
    ceu_hours = Column(Float, nullable=True)
    cert_program = Column(String(50), nullable=False, default="drinking_water", index=True)
    cert_type = Column(String(50), nullable=False, index=True)
    target_grades = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True, index=True)
    cost_text = Column(String(100), nullable=True)
    registration_url = Column(String(1000), nullable=True)
    contact_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    capacity = Column(Integer, nullable=True)
    source_course_id = Column(
        Integer,
        ForeignKey("workforce_training_courses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(String(20), nullable=False, default="scheduled", index=True)
    notes = Column(Text, nullable=True)
    record_status = Column(String(20), nullable=False, default="active", index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    source_course = relationship("WorkforceTrainingCourse", foreign_keys=[source_course_id])
    enrollments = relationship(
        "WorkforceTrainingEnrollment",
        back_populates="scheduled_training",
        cascade="all, delete-orphan",
    )


class WorkforceTrainingEnrollment(Base):
    """Operator sign-up for a district scheduled training session."""

    __tablename__ = "workforce_training_enrollments"
    __table_args__ = (
        UniqueConstraint(
            "scheduled_training_id",
            "employee_code",
            name="uq_workforce_training_enrollments_training_employee",
        ),
    )

    STATUS_VALUES = ("enrolled", "cancelled")

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(
        String(50),
        ForeignKey("water_districts.district_code"),
        nullable=False,
        index=True,
    )
    scheduled_training_id = Column(
        Integer,
        ForeignKey("workforce_scheduled_trainings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_code = Column(String(50), nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    status = Column(String(20), nullable=False, default="enrolled", index=True)
    enrolled_at = Column(DateTime, server_default=func.now(), nullable=False)
    cancelled_at = Column(DateTime, nullable=True)

    scheduled_training = relationship(
        "WorkforceScheduledTraining",
        back_populates="enrollments",
    )


class WorkforceTrainingSyncLog(Base):
    """Audit log for DOH training page scrape runs."""

    __tablename__ = "workforce_training_sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    source_url = Column(String(1000), nullable=False)
    page_content_hash = Column(String(64), nullable=False)
    synced_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    courses_parsed = Column(Integer, nullable=False, default=0)
    courses_added = Column(Integer, nullable=False, default=0)
    courses_updated = Column(Integer, nullable=False, default=0)
    courses_deactivated = Column(Integer, nullable=False, default=0)
    skipped_unchanged = Column(Boolean, nullable=False, default=False)

