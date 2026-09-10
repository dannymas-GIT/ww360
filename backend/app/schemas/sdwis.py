"""Pydantic schemas for SDWIS / ECHO integration API."""

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class SDWISWaterSystemOut(BaseModel):
    id: int
    pwsid: str
    district_code: Optional[str] = None
    pws_name: Optional[str] = None
    state_code: Optional[str] = None
    epa_region: Optional[str] = None
    registry_id: Optional[str] = None
    population_served: Optional[int] = None
    serious_violator: Optional[str] = None
    health_flag: Optional[str] = None
    snc: Optional[str] = None
    qtrs_with_vio: Optional[int] = None
    qtrs_with_snc: Optional[int] = None
    compliance_qtrs_history: Optional[str] = None
    contaminants_in_current_violation: Optional[str] = None
    violation_categories: Optional[str] = None
    dfr_url: Optional[str] = None
    facility_status: Optional[str] = None
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SDWISViolationOut(BaseModel):
    id: int
    pwsid: str
    violation_epa_id: str
    rule_name: Optional[str] = None
    contaminant_name: Optional[str] = None
    category_code: Optional[str] = None
    category_desc: Optional[str] = None
    violation_measure: Optional[str] = None
    state_mcl: Optional[str] = None
    federal_mcl: Optional[str] = None
    compliance_period_begin: Optional[str] = None
    compliance_period_end: Optional[str] = None
    non_compliance_begin: Optional[str] = None
    non_compliance_end: Optional[str] = None
    resolved_date: Optional[str] = None
    status: Optional[str] = None
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SDWISEnforcementOut(BaseModel):
    id: int
    pwsid: str
    enforcement_epa_id: str
    enforcement_type: Optional[str] = None
    action_description: Optional[str] = None
    action_date: Optional[str] = None
    agency: Optional[str] = None
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SDWISystemDetailOut(BaseModel):
    system: SDWISWaterSystemOut
    violation_count: int
    open_violation_count: int
    enforcement_count: int
    raw_compliance_status: Optional[dict[str, Any]] = None


class SDWISLinkRequest(BaseModel):
    pwsid: str = Field(..., min_length=7, max_length=12)
    district_code: Optional[str] = None


class SDWISLinkResponse(BaseModel):
    success: bool
    pwsid: str
    message: str
    violations_synced: int
    enforcement_synced: int


class SDWISComplianceSummaryOut(BaseModel):
    systems_linked: int
    total_open_violations: int
    systems_with_health_flag: int
    systems_in_snc: int
    systems: List[SDWISWaterSystemOut]


class SDWISLookupRow(BaseModel):
    pwsid: str
    pws_name: Optional[str] = None
    state_code: Optional[str] = None
    population_served: Optional[str] = None
    snc: Optional[str] = None
    """0–100 similarity when returned from fuzzy landscape match."""
    match_score: Optional[float] = None
    """Why this row matched (substring, acronym, similar spelling, …)."""
    match_reason: Optional[str] = None


class SDWISSyncResponse(BaseModel):
    success: bool
    pwsid: str
    violations_synced: int
    enforcement_synced: int
    last_synced_at: Optional[datetime] = None


class SDWISDistrictRememberedPwsidOut(BaseModel):
    district_code: str
    pwsid: str
    updated_at: datetime

    class Config:
        from_attributes = True


class SDWISDistrictRememberedPwsidPut(BaseModel):
    pwsid: str = Field(..., min_length=7, max_length=12)


class SDWISPreviewViolation(BaseModel):
    violation_epa_id: str
    rule_name: Optional[str] = None
    contaminant_name: Optional[str] = None
    category_code: Optional[str] = None
    category_desc: Optional[str] = None
    violation_measure: Optional[str] = None
    state_mcl: Optional[str] = None
    federal_mcl: Optional[str] = None
    compliance_period_begin: Optional[str] = None
    compliance_period_end: Optional[str] = None
    non_compliance_begin: Optional[str] = None
    non_compliance_end: Optional[str] = None
    resolved_date: Optional[str] = None
    status: Optional[str] = None


class SDWISPreviewEnforcement(BaseModel):
    enforcement_epa_id: str
    enforcement_type: Optional[str] = None
    action_description: Optional[str] = None
    action_date: Optional[str] = None
    agency: Optional[str] = None


class SDWISPreviewOut(BaseModel):
    pwsid: str
    pws_name: Optional[str] = None
    state_code: Optional[str] = None
    epa_region: Optional[str] = None
    facility_status: Optional[str] = None
    population_served: Optional[int] = None
    snc: Optional[str] = None
    health_flag: Optional[str] = None
    serious_violator: Optional[str] = None
    qtrs_with_vio: Optional[int] = None
    qtrs_with_snc: Optional[int] = None
    violation_count: int = 0
    open_violation_count: int = 0
    enforcement_count: int = 0
    violations: List[SDWISPreviewViolation] = Field(default_factory=list)
    enforcement_actions: List[SDWISPreviewEnforcement] = Field(default_factory=list)
    source: str = "landscape"
    preview_only: bool = True
    is_linked: bool = False


class SDWISAnalysisSetItemOut(BaseModel):
    id: int
    pwsid: str
    pws_name: Optional[str] = None
    state_code: Optional[str] = None
    population_served: Optional[int] = None
    snc: Optional[str] = None
    added_at: datetime
    open_violation_count: Optional[int] = None
    enforcement_count: Optional[int] = None

    class Config:
        from_attributes = True


class SDWISAnalysisSetOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    items: List[SDWISAnalysisSetItemOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class SDWISAnalysisSetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class SDWISAnalysisSetUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class SDWISAnalysisSetItemAdd(BaseModel):
    pwsid: str = Field(..., min_length=7, max_length=12)
    pws_name: Optional[str] = None
    state_code: Optional[str] = None
    population_served: Optional[int] = None
    snc: Optional[str] = None


class SDWISWorkforceInsightsOut(BaseModel):
    state_code: str
    active_cws_count: int
    total_population_served: int
    health_violation_systems: int
    serious_violator_count: int
    snc_count: int
    size_tiers: dict[str, int]
    grade_demand_estimate: dict[str, int]
    compliance_pressure_by_county: List[dict[str, Any]]
    member_watchlist: List[dict[str, Any]]
    coverage: dict[str, Any]
    last_refreshed: Optional[datetime] = None
