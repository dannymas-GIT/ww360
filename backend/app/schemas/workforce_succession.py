"""Pydantic schemas for workforce succession planning endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.doc_studio import DocDocumentRead


# ---------------------------------------------------------------------------
# Position
# ---------------------------------------------------------------------------


class WorkforcePositionBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    position_code: Optional[str] = Field(None, max_length=50)
    title: str = Field(..., min_length=1, max_length=255)
    civil_service_classification: Optional[str] = Field(None, max_length=100)
    civil_service_grade: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    reports_to_position_code: Optional[str] = Field(None, max_length=50)
    reports_to_position_id: Optional[int] = None
    fte_count: Optional[int] = 1
    is_funded: bool = True
    is_vacant: bool = False
    vacancy_since: Optional[date] = None
    notes: Optional[str] = None


class WorkforcePositionCreate(WorkforcePositionBase):
    pass


class WorkforcePositionUpdate(BaseModel):
    position_code: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    civil_service_classification: Optional[str] = Field(None, max_length=100)
    civil_service_grade: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    reports_to_position_code: Optional[str] = Field(None, max_length=50)
    reports_to_position_id: Optional[int] = None
    fte_count: Optional[int] = None
    is_funded: Optional[bool] = None
    is_vacant: Optional[bool] = None
    vacancy_since: Optional[date] = None
    notes: Optional[str] = None
    record_status: Optional[str] = None


class WorkforcePositionRead(WorkforcePositionBase):
    id: int
    record_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Employee
# ---------------------------------------------------------------------------


class WorkforceEmployeeBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    employee_code: Optional[str] = Field(None, max_length=50)
    full_name: str = Field(..., min_length=1, max_length=255)
    work_email: Optional[str] = Field(None, max_length=255)
    work_phone: Optional[str] = Field(None, max_length=50)
    home_phone: Optional[str] = Field(None, max_length=50)
    home_email: Optional[str] = Field(None, max_length=255)
    home_address_line1: Optional[str] = Field(None, max_length=255)
    home_address_line2: Optional[str] = Field(None, max_length=255)
    home_city: Optional[str] = Field(None, max_length=100)
    home_state: Optional[str] = Field(None, max_length=10)
    home_zip: Optional[str] = Field(None, max_length=20)
    county_of_employment: Optional[str] = Field(None, max_length=100)
    is_veteran: Optional[bool] = None
    is_contract_operator: Optional[bool] = None
    operator_grade: Optional[str] = Field(None, max_length=50)
    position_code: Optional[str] = Field(None, max_length=50)
    position_id: Optional[int] = None
    hire_date: Optional[date] = None
    retirement_eligible_date: Optional[date] = None
    planned_departure_date: Optional[date] = None
    linked_aquasafe_user_id: Optional[int] = None
    is_active: bool = True
    notes: Optional[str] = None


class WorkforceEmployeeCreate(WorkforceEmployeeBase):
    pass


class WorkforceEmployeeUpdate(BaseModel):
    employee_code: Optional[str] = Field(None, max_length=50)
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    work_email: Optional[str] = Field(None, max_length=255)
    work_phone: Optional[str] = Field(None, max_length=50)
    home_phone: Optional[str] = Field(None, max_length=50)
    home_email: Optional[str] = Field(None, max_length=255)
    home_address_line1: Optional[str] = Field(None, max_length=255)
    home_address_line2: Optional[str] = Field(None, max_length=255)
    home_city: Optional[str] = Field(None, max_length=100)
    home_state: Optional[str] = Field(None, max_length=10)
    home_zip: Optional[str] = Field(None, max_length=20)
    county_of_employment: Optional[str] = Field(None, max_length=100)
    is_veteran: Optional[bool] = None
    is_contract_operator: Optional[bool] = None
    operator_grade: Optional[str] = Field(None, max_length=50)
    position_code: Optional[str] = Field(None, max_length=50)
    position_id: Optional[int] = None
    hire_date: Optional[date] = None
    retirement_eligible_date: Optional[date] = None
    planned_departure_date: Optional[date] = None
    linked_aquasafe_user_id: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    record_status: Optional[str] = None


class WorkforceEmployeeRead(WorkforceEmployeeBase):
    id: int
    record_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Certification
# ---------------------------------------------------------------------------


class WorkforceCertificationBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    employee_id: Optional[int] = None
    employee_code: Optional[str] = Field(None, max_length=50)
    certification_type: str = Field(..., min_length=1, max_length=100)
    certification_grade: Optional[str] = Field(None, max_length=50)
    issuing_authority: Optional[str] = Field(None, max_length=100)
    credential_id: Optional[str] = Field(None, max_length=100)
    issued_date: Optional[date] = None
    expiration_date: Optional[date] = None
    is_required_for_role: bool = False
    notes: Optional[str] = None


class WorkforceCertificationCreate(WorkforceCertificationBase):
    pass


class WorkforceCertificationUpdate(BaseModel):
    employee_id: Optional[int] = None
    employee_code: Optional[str] = Field(None, max_length=50)
    certification_type: Optional[str] = Field(None, min_length=1, max_length=100)
    certification_grade: Optional[str] = Field(None, max_length=50)
    issuing_authority: Optional[str] = Field(None, max_length=100)
    credential_id: Optional[str] = Field(None, max_length=100)
    issued_date: Optional[date] = None
    expiration_date: Optional[date] = None
    is_required_for_role: Optional[bool] = None
    notes: Optional[str] = None
    record_status: Optional[str] = None


class WorkforceCertificationRead(WorkforceCertificationBase):
    id: int
    employee_id: Optional[int]
    record_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Critical function
# ---------------------------------------------------------------------------


class WorkforceCriticalFunctionBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    function_code: Optional[str] = Field(None, max_length=50)
    function_name: str = Field(..., min_length=1, max_length=255)
    function_area: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    linked_facility_id: Optional[int] = None
    linked_schedule_id: Optional[int] = None
    linked_program: Optional[str] = Field(None, max_length=100)
    required_certification_type: Optional[str] = Field(None, max_length=100)
    required_certification_grade: Optional[str] = Field(None, max_length=50)


class WorkforceCriticalFunctionCreate(WorkforceCriticalFunctionBase):
    pass


class WorkforceCriticalFunctionUpdate(BaseModel):
    function_code: Optional[str] = Field(None, max_length=50)
    function_name: Optional[str] = Field(None, min_length=1, max_length=255)
    function_area: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    linked_facility_id: Optional[int] = None
    linked_schedule_id: Optional[int] = None
    linked_program: Optional[str] = Field(None, max_length=100)
    required_certification_type: Optional[str] = Field(None, max_length=100)
    required_certification_grade: Optional[str] = Field(None, max_length=50)
    record_status: Optional[str] = None


class WorkforceCriticalFunctionRead(WorkforceCriticalFunctionBase):
    id: int
    record_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Role coverage
# ---------------------------------------------------------------------------


class WorkforceRoleCoverageBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    function_id: Optional[int] = None
    function_code: Optional[str] = Field(None, max_length=50)
    employee_id: Optional[int] = None
    employee_code: Optional[str] = Field(None, max_length=50)
    coverage_role: str = Field("primary", max_length=20)
    proficiency_level: Optional[str] = Field(None, max_length=20)
    last_performed_date: Optional[date] = None
    notes: Optional[str] = None


class WorkforceRoleCoverageCreate(WorkforceRoleCoverageBase):
    pass


class WorkforceRoleCoverageUpdate(BaseModel):
    function_id: Optional[int] = None
    function_code: Optional[str] = Field(None, max_length=50)
    employee_id: Optional[int] = None
    employee_code: Optional[str] = Field(None, max_length=50)
    coverage_role: Optional[str] = Field(None, max_length=20)
    proficiency_level: Optional[str] = Field(None, max_length=20)
    last_performed_date: Optional[date] = None
    notes: Optional[str] = None
    record_status: Optional[str] = None


class WorkforceRoleCoverageRead(WorkforceRoleCoverageBase):
    id: int
    function_id: Optional[int]
    employee_id: Optional[int]
    record_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Succession candidate
# ---------------------------------------------------------------------------


class WorkforceSuccessionCandidateBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    employee_id: Optional[int] = None
    employee_code: Optional[str] = Field(None, max_length=50)
    target_position_id: Optional[int] = None
    target_position_code: Optional[str] = Field(None, max_length=50)
    readiness_level: Optional[str] = Field(None, max_length=20)
    readiness_target_date: Optional[date] = None
    training_plan_summary: Optional[str] = None
    mentor_employee_id: Optional[int] = None
    mentor_employee_code: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class WorkforceSuccessionCandidateCreate(WorkforceSuccessionCandidateBase):
    pass


class WorkforceSuccessionCandidateUpdate(BaseModel):
    employee_id: Optional[int] = None
    employee_code: Optional[str] = Field(None, max_length=50)
    target_position_id: Optional[int] = None
    target_position_code: Optional[str] = Field(None, max_length=50)
    readiness_level: Optional[str] = Field(None, max_length=20)
    readiness_target_date: Optional[date] = None
    training_plan_summary: Optional[str] = None
    mentor_employee_id: Optional[int] = None
    mentor_employee_code: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None
    record_status: Optional[str] = None


class WorkforceSuccessionCandidateRead(WorkforceSuccessionCandidateBase):
    id: int
    employee_id: Optional[int]
    target_position_id: Optional[int]
    mentor_employee_id: Optional[int]
    record_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Knowledge artifact
# ---------------------------------------------------------------------------


class WorkforceKnowledgeArtifactBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    function_id: Optional[int] = None
    function_code: Optional[str] = Field(None, max_length=50)
    artifact_type: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=255)
    summary: Optional[str] = None
    source_employee_id: Optional[int] = None
    source_employee_code: Optional[str] = Field(None, max_length=50)
    captured_by: Optional[str] = Field(None, max_length=255)
    captured_date: Optional[date] = None
    verified_by: Optional[str] = Field(None, max_length=255)
    verified_date: Optional[date] = None
    storage_uri: Optional[str] = Field(None, max_length=500)
    document_id: Optional[str] = Field(None, max_length=36)
    notes: Optional[str] = None


class WorkforceKnowledgeArtifactCreate(WorkforceKnowledgeArtifactBase):
    pass


class WorkforceKnowledgeArtifactUpdate(BaseModel):
    function_id: Optional[int] = None
    function_code: Optional[str] = Field(None, max_length=50)
    artifact_type: Optional[str] = Field(None, min_length=1, max_length=50)
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    summary: Optional[str] = None
    source_employee_id: Optional[int] = None
    source_employee_code: Optional[str] = Field(None, max_length=50)
    captured_by: Optional[str] = Field(None, max_length=255)
    captured_date: Optional[date] = None
    verified_by: Optional[str] = Field(None, max_length=255)
    verified_date: Optional[date] = None
    storage_uri: Optional[str] = Field(None, max_length=500)
    document_id: Optional[str] = Field(None, max_length=36)
    notes: Optional[str] = None
    record_status: Optional[str] = None


class WorkforceKnowledgeArtifactRead(WorkforceKnowledgeArtifactBase):
    id: int
    function_id: Optional[int]
    record_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Transition milestone
# ---------------------------------------------------------------------------


class WorkforceTransitionMilestoneBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    position_id: Optional[int] = None
    position_code: Optional[str] = Field(None, max_length=50)
    milestone_type: str = Field(..., min_length=1, max_length=40)
    title: str = Field(..., min_length=1, max_length=255)
    owner_employee_id: Optional[int] = None
    owner_employee_code: Optional[str] = Field(None, max_length=50)
    target_date: Optional[date] = None
    completed_date: Optional[date] = None
    status: str = Field("planned", max_length=20)
    toolkit_phase: str = Field("plan", max_length=20)
    notes: Optional[str] = None


class WorkforceTransitionMilestoneCreate(WorkforceTransitionMilestoneBase):
    pass


class WorkforceTransitionMilestoneUpdate(BaseModel):
    position_id: Optional[int] = None
    position_code: Optional[str] = Field(None, max_length=50)
    milestone_type: Optional[str] = Field(None, min_length=1, max_length=40)
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    owner_employee_id: Optional[int] = None
    owner_employee_code: Optional[str] = Field(None, max_length=50)
    target_date: Optional[date] = None
    completed_date: Optional[date] = None
    status: Optional[str] = Field(None, max_length=20)
    toolkit_phase: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
    record_status: Optional[str] = None


class WorkforceTransitionMilestoneRead(WorkforceTransitionMilestoneBase):
    id: int
    record_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Import / staging
# ---------------------------------------------------------------------------


class ImportRowIssue(BaseModel):
    row_index: int
    field: Optional[str] = None
    message: str


class ImportPreview(BaseModel):
    entity_type: str
    district_code: Optional[str] = None
    total_rows: int
    valid_rows: int
    invalid_rows: int
    sample_rows: List[dict[str, Any]] = Field(default_factory=list)
    issues: List[ImportRowIssue] = Field(default_factory=list)


class ImportResult(BaseModel):
    batch_id: int
    entity_type: str
    district_code: str
    status: str
    total_rows: int
    rows_valid: int
    rows_invalid: int
    rows_promoted: int
    issues: List[ImportRowIssue] = Field(default_factory=list)


class WorkforceImportBatchRead(BaseModel):
    id: int
    district_code: str
    entity_type: str
    original_filename: Optional[str]
    status: str
    total_rows: int
    rows_valid: int
    rows_invalid: int
    rows_promoted: int
    validation_summary: Optional[str]
    review_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Continuity analytics
# ---------------------------------------------------------------------------


class CriticalFunctionCoverage(BaseModel):
    function_id: int
    function_code: str
    function_name: str
    function_area: Optional[str]
    primary_employee_codes: List[str] = Field(default_factory=list)
    backup_employee_codes: List[str] = Field(default_factory=list)
    trainee_employee_codes: List[str] = Field(default_factory=list)
    backup_count: int = 0
    has_qualified_backup: bool = False
    risk_level: str = "ok"


class CertificationCliffEntry(BaseModel):
    certification_id: int
    employee_code: str
    employee_name: Optional[str]
    certification_type: str
    certification_grade: Optional[str]
    expiration_date: Optional[date]
    days_until_expiration: Optional[int]
    is_required_for_role: bool


class RetirementHorizonEntry(BaseModel):
    employee_id: int
    employee_code: str
    employee_name: str
    position_code: Optional[str]
    retirement_eligible_date: Optional[date]
    months_until_eligible: Optional[int]


class TransitionMilestoneSummary(BaseModel):
    milestone_id: int
    position_code: str
    title: str
    milestone_type: str
    toolkit_phase: str
    target_date: Optional[date]
    status: str
    is_overdue: bool


class WorkforceContinuityScorecard(BaseModel):
    district_code: str
    as_of: datetime
    total_positions: int
    funded_positions: int
    vacant_positions: int
    total_employees: int
    total_critical_functions: int
    functions_with_qualified_backup: int
    functions_without_backup: int
    coverage_pct: float = Field(0.0, ge=0.0, le=100.0)
    cert_cliff_30d: int = 0
    cert_cliff_90d: int = 0
    cert_cliff_365d: int = 0
    employees_retirement_eligible_24mo: int = 0
    overdue_milestones: int = 0
    readiness_score: float = Field(0.0, ge=0.0, le=100.0)
    ceu_shortfall_count: int = 0
    ceu_avg_completion_pct: float = Field(0.0, ge=0.0, le=100.0)
    doh352_ready_count: int = 0


class WorkforceContinuityResponse(BaseModel):
    scorecard: WorkforceContinuityScorecard
    coverage: List[CriticalFunctionCoverage] = Field(default_factory=list)
    cert_cliff: List[CertificationCliffEntry] = Field(default_factory=list)
    retirement_horizon: List[RetirementHorizonEntry] = Field(default_factory=list)
    upcoming_milestones: List[TransitionMilestoneSummary] = Field(default_factory=list)
    data_mode: Literal["live", "sample"] = "live"
    sample_notice: Optional[str] = None
    sample_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Planning session (wizard draft / publish)
# ---------------------------------------------------------------------------


class WorkforcePlanningSessionCreate(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    title: Optional[str] = Field(None, max_length=255)


class WorkforcePlanningSessionUpdate(BaseModel):
    """Partial update: only sent fields are merged into the stored payload."""

    payload: Optional[dict[str, Any]] = None
    current_step: Optional[str] = Field(None, max_length=50)
    completed_steps: Optional[List[str]] = None
    title: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, max_length=20)


class WorkforcePlanningSessionRead(BaseModel):
    id: int
    district_code: str
    created_by_user_id: Optional[int]
    title: Optional[str]
    current_step: str
    completed_steps: List[str] = Field(default_factory=list)
    status: str
    payload: dict[str, Any] = Field(default_factory=dict)
    validation_summary: Optional[dict[str, Any]] = None
    last_saved_at: datetime
    submitted_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    published_batch_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkforcePlanningSessionEnsureResponse(BaseModel):
    session: WorkforcePlanningSessionRead
    created: bool


class WorkforcePlanningSessionValidateResponse(BaseModel):
    ok: bool
    entities: dict[str, Any] = Field(default_factory=dict)
    issues: List[dict[str, Any]] = Field(default_factory=list)


class WorkforceDistrictValidateResponse(BaseModel):
    ok: bool
    district_code: str
    entities: dict[str, Any] = Field(default_factory=dict)
    issues: List[dict[str, Any]] = Field(default_factory=list)


class WorkforcePlanningSessionPublishResponse(BaseModel):
    session_id: int
    district_code: str
    status: str
    batch_ids: List[int] = Field(default_factory=list)
    published_batch_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Alert scanner
# ---------------------------------------------------------------------------


class WorkforceAlertScanResult(BaseModel):
    district_code: str
    created: int
    skipped_duplicate: int
    summary: List[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# CEU records & vouchers
# ---------------------------------------------------------------------------


class WorkforceCeuRecordBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    external_id: Optional[str] = Field(None, max_length=100)
    employee_code: str = Field(..., min_length=1, max_length=50)
    certification_id: Optional[int] = None
    certification_grade: Optional[str] = Field(None, max_length=50)
    course_title: str = Field(..., min_length=1, max_length=255)
    provider: Optional[str] = Field(None, max_length=255)
    approval_number: Optional[str] = Field(None, max_length=100)
    ceu_hours: float = Field(..., ge=0)
    contact_hours: Optional[float] = Field(None, ge=0)
    completion_date: date
    category: Optional[str] = Field(None, max_length=100)
    renewal_cycle_start: Optional[date] = None
    renewal_cycle_end: Optional[date] = None
    notes: Optional[str] = None


class WorkforceCeuRecordCreate(WorkforceCeuRecordBase):
    pass


class WorkforceCeuRecordUpdate(BaseModel):
    employee_code: Optional[str] = Field(None, min_length=1, max_length=50)
    certification_id: Optional[int] = None
    certification_grade: Optional[str] = Field(None, max_length=50)
    course_title: Optional[str] = Field(None, min_length=1, max_length=255)
    provider: Optional[str] = Field(None, max_length=255)
    approval_number: Optional[str] = Field(None, max_length=100)
    ceu_hours: Optional[float] = Field(None, ge=0)
    contact_hours: Optional[float] = Field(None, ge=0)
    completion_date: Optional[date] = None
    category: Optional[str] = Field(None, max_length=100)
    renewal_cycle_start: Optional[date] = None
    renewal_cycle_end: Optional[date] = None
    notes: Optional[str] = None
    record_status: Optional[str] = None


class WorkforceCeuRecordRead(WorkforceCeuRecordBase):
    id: int
    employee_id: Optional[int]
    record_status: str
    voucher_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkforceCeuVoucherRead(BaseModel):
    id: int
    district_code: str
    ceu_record_id: int
    filename: str
    content_type: Optional[str]
    file_extension: str
    size_bytes: int
    description: Optional[str]
    storage_kind: str
    uploaded_by_user_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class WorkforceCeuOperatorSummary(BaseModel):
    employee_code: str
    employee_name: str
    certification_grade: Optional[str]
    certification_id: Optional[int]
    expiration_date: Optional[date]
    renewal_cycle_start: date
    renewal_cycle_end: date
    required_hours: float
    earned_hours: float
    remaining_hours: float
    percent_complete: float
    is_shortfall: bool
    days_until_cycle_end: int
    record_count: int
    needs_ceu_alert: bool = False
    voucher_count: int = 0
    records_missing_vouchers: int = 0
    earned_contact_hours: float = 0.0
    required_contact_hours: float = 0.0


class WorkforceCeuSummaryResponse(BaseModel):
    district_code: str
    operators: List[WorkforceCeuOperatorSummary] = Field(default_factory=list)
    total_shortfall: int = 0
    total_operators: int = 0


class WorkforceAlertSettingsSchema(BaseModel):
    enabled: bool = True
    cert_expiry_horizon_days: List[int] = Field(default_factory=lambda: [30, 90, 180])
    retirement_horizon_months: List[int] = Field(default_factory=lambda: [12, 24])
    ceu_shortfall_lead_days: int = 90
    ceu_requirements_by_grade: Dict[str, float] = Field(default_factory=dict)
    notification_channels: List[str] = Field(default_factory=lambda: ["in_app"])
    recipient_emails: List[str] = Field(default_factory=list)
    scan_daily: bool = True


class WorkforceTrainingSettingsSchema(BaseModel):
    operator_self_enroll_enabled: bool = False


class Doh352PreviewResponse(BaseModel):
    fields: Dict[str, Any]
    missing_fields: List[str] = Field(default_factory=list)
    fill_method: Optional[str] = None
    voucher_count: int = 0
    voucher_manifest: List[Dict[str, Any]] = Field(default_factory=list)


class WorkforceDistrictEmployerProfileRead(BaseModel):
    district_code: str
    district_name: Optional[str] = None
    mailing_address_line1: Optional[str] = None
    mailing_address_line2: Optional[str] = None

    class Config:
        from_attributes = True


class WorkforceDistrictEmployerProfileUpdate(BaseModel):
    mailing_address_line1: Optional[str] = Field(None, max_length=255)
    mailing_address_line2: Optional[str] = Field(None, max_length=255)


class WorkforceTrainingCourseRead(BaseModel):
    id: int
    state: str
    source: str
    cert_program: str
    cert_type: str
    course_category: str
    sponsor: str
    course_name: str
    grade: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    cost_text: Optional[str]
    cost_amount: Optional[float]
    contact_name: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    county: Optional[str] = None
    city: Optional[str] = None
    location_text: Optional[str] = None
    delivery_mode: Optional[str] = None
    delivery_type_label: Optional[str] = None
    contact_hours: Optional[float] = None
    description: Optional[str] = None
    source_url: Optional[str]
    source_anchor: Optional[str]
    is_active: bool
    last_seen_at: datetime

    class Config:
        from_attributes = True


class WorkforceTrainingScrapeResult(BaseModel):
    source_url: str
    page_content_hash: str
    courses_parsed: int
    courses_added: int
    courses_updated: int
    courses_deactivated: int
    skipped_unchanged: bool
    last_synced_at: str


class WorkforceTrainingCourseListResponse(BaseModel):
    courses: List[WorkforceTrainingCourseRead] = Field(default_factory=list)
    total: int = 0
    last_synced_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# CEU requirements reference taxonomy
# ---------------------------------------------------------------------------


class CeuMandatoryCategoryRule(BaseModel):
    category: str
    minimum_ceu: float
    notes: Optional[str] = None


class CeuGradeRequirement(BaseModel):
    grade: str
    role_title: str
    cert_type: str
    cert_program: str
    required_ceu: float
    renewal_cycle_years: int
    mandatory_categories: List[CeuMandatoryCategoryRule] = Field(default_factory=list)
    acceptable_categories: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class CeuRoleRequirement(BaseModel):
    role_key: str
    role_title: str
    description: str
    issuing_authority: str
    cert_program: str
    federal_citation: str
    state_citation: str
    grades: List[CeuGradeRequirement] = Field(default_factory=list)


class CeuRequirementsResponse(BaseModel):
    renewal_cycle_years: int
    federal_citation: str
    state_citation: str
    regulation_sources: Dict[str, str] = Field(default_factory=dict)
    scope_notes: List[str] = Field(default_factory=list)
    default_ceu_by_grade: Dict[str, float] = Field(default_factory=dict)
    roles: List[CeuRoleRequirement] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# District scheduled training events
# ---------------------------------------------------------------------------


class WorkforceScheduledTrainingBase(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=500)
    provider: str = Field(..., min_length=1, max_length=255)
    location: Optional[str] = Field(None, max_length=500)
    delivery_mode: str = Field(default="in_person", max_length=20)
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    ceu_hours: Optional[float] = Field(None, ge=0)
    cert_program: str = Field(default="drinking_water", max_length=50)
    cert_type: str = Field(..., min_length=1, max_length=50)
    target_grades: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    cost_text: Optional[str] = Field(None, max_length=100)
    registration_url: Optional[str] = Field(None, max_length=1000)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)
    capacity: Optional[int] = Field(None, ge=1)
    source_course_id: Optional[int] = None
    status: str = Field(default="scheduled", max_length=20)
    notes: Optional[str] = None


class WorkforceScheduledTrainingCreate(WorkforceScheduledTrainingBase):
    pass


class WorkforceScheduledTrainingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    provider: Optional[str] = Field(None, min_length=1, max_length=255)
    location: Optional[str] = Field(None, max_length=500)
    delivery_mode: Optional[str] = Field(None, max_length=20)
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    ceu_hours: Optional[float] = Field(None, ge=0)
    cert_program: Optional[str] = Field(None, max_length=50)
    cert_type: Optional[str] = Field(None, max_length=50)
    target_grades: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    cost_text: Optional[str] = Field(None, max_length=100)
    registration_url: Optional[str] = Field(None, max_length=1000)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)
    capacity: Optional[int] = Field(None, ge=1)
    status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
    record_status: Optional[str] = None


class WorkforceScheduledTrainingRead(WorkforceScheduledTrainingBase):
    id: int
    record_status: str
    created_at: datetime
    updated_at: datetime
    enrollment_count: int = 0
    is_enrolled: bool = False
    spots_remaining: Optional[int] = None
    catalog_source: Optional[str] = None

    class Config:
        from_attributes = True


class WorkforceTrainingEnrollmentRead(BaseModel):
    id: int
    district_code: str
    scheduled_training_id: int
    employee_code: str
    status: str
    enrolled_at: datetime
    training: Optional[WorkforceScheduledTrainingRead] = None

    class Config:
        from_attributes = True


class WorkforceTrainingEnrollmentListResponse(BaseModel):
    enrollments: List[WorkforceTrainingEnrollmentRead] = Field(default_factory=list)
    total: int = 0


class LearningStreamSeedResult(BaseModel):
    catalog_added: int
    catalog_updated: int
    district_sessions_created: int = 0


class WorkforceScheduledTrainingListResponse(BaseModel):
    trainings: List[WorkforceScheduledTrainingRead] = Field(default_factory=list)
    total: int = 0


class RecommendedTrainingSummary(BaseModel):
    id: int
    title: str
    provider: str
    location: Optional[str] = None
    delivery_mode: str
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    ceu_hours: Optional[float] = None
    cert_type: str
    target_grades: Optional[str] = None
    category: Optional[str] = None
    registration_url: Optional[str] = None
    cost_text: Optional[str] = None


class GenerateWorkforceDocPackRequest(BaseModel):
    pack_type: Literal["succession_binder", "ceu_tracker_pack"] = "succession_binder"
    profile: Literal["small_system", "multi_plant", "district_trainees"] = "small_system"
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    use_live_data: bool = True


class WorkforceDocPackResponse(BaseModel):
    pack_type: str
    profile: Optional[str] = None
    folder_id: str
    cover_document_id: Optional[str] = None
    document_count: int
    documents: List[DocDocumentRead] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Binder intake wizard
# ---------------------------------------------------------------------------


class WorkforceBinderIntakeCreate(BaseModel):
    district_code: str = Field(..., min_length=1, max_length=50)


class WorkforceBinderIntakeUpdate(BaseModel):
    answers: Optional[dict[str, Any]] = None
    current_step: Optional[str] = Field(None, max_length=50)
    completed_steps: Optional[List[str]] = None


class WorkforceBinderIntakeRead(BaseModel):
    id: int
    district_code: str
    created_by_user_id: Optional[int]
    current_step: str
    completed_steps: List[str] = Field(default_factory=list)
    status: str
    answers: dict[str, Any] = Field(default_factory=dict)
    binder_folder_id: Optional[str] = None
    last_saved_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkforceBinderIntakeEnsureResponse(BaseModel):
    session: WorkforceBinderIntakeRead
    created: bool


class WorkforceBinderIntakeCompleteResponse(BaseModel):
    session: WorkforceBinderIntakeRead
    pack: WorkforceDocPackResponse
