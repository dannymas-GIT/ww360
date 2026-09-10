"""Workforce succession planning endpoints.

Implements:

- CSV intake with district-aligned staging-then-promote flow.
- Read access for the planning entities (positions, employees, certifications,
  critical functions, role coverage, succession candidates, knowledge artifacts,
  transition milestones).
- Continuity analytics for the dashboard and the executive scorecard.
- Tier 1 deliverable: download the canonical CSV intake templates.

Authorization mirrors the lab/compliance pattern: only district admins,
district managers, global admins, and system admins can manage workforce data.
The continuity overlay can later be exposed to operators read-only without
employee detail.
"""
from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.models.workforce_succession import (
    WorkforceCertification,
    WorkforceCriticalFunction,
    WorkforceEmployee,
    WorkforceImportBatch,
    WorkforceKnowledgeArtifact,
    WorkforcePlanningSession,
    WorkforcePosition,
    WorkforceRoleCoverage,
    WorkforceSuccessionCandidate,
    WorkforceTransitionMilestone,
)
from app.schemas.workforce_succession import (
    ImportPreview,
    ImportResult,
    WorkforceAlertScanResult,
    WorkforceCertificationRead,
    WorkforceContinuityResponse,
    WorkforceCriticalFunctionRead,
    WorkforceDistrictValidateResponse,
    WorkforceEmployeeRead,
    WorkforceImportBatchRead,
    WorkforceKnowledgeArtifactRead,
    WorkforcePlanningSessionCreate,
    WorkforcePlanningSessionEnsureResponse,
    WorkforcePlanningSessionPublishResponse,
    WorkforcePlanningSessionRead,
    WorkforcePlanningSessionUpdate,
    WorkforcePlanningSessionValidateResponse,
    WorkforcePositionRead,
    WorkforceRoleCoverageRead,
    WorkforceSuccessionCandidateRead,
    WorkforceTransitionMilestoneRead,
    GenerateWorkforceDocPackRequest,
    WorkforceDocPackResponse,
    WorkforceBinderIntakeCreate,
    WorkforceBinderIntakeEnsureResponse,
    WorkforceBinderIntakeRead,
    WorkforceBinderIntakeUpdate,
    WorkforceBinderIntakeCompleteResponse,
)
from app.services.district_security_service import DistrictSecurityService
from app.services.workforce_succession import (
    ENTITY_TYPES,
    WorkforceImportError,
    PlanningSessionConflict,
    PlanningSessionNotFound,
    abandon_planning_session,
    compute_continuity_response,
    get_active_draft,
    get_or_create_planning_session,
    get_planning_session,
    import_workforce_csv,
    parse_session_payload,
    preview_workforce_csv,
    publish_planning_session,
    scan_district,
    update_planning_session,
    validate_planning_session,
)
from app.services.workforce_succession.crud_service import (
    list_entities,
    validate_district_workforce_data,
)
from app.services.workforce_doc_pack_service import WorkforceDocPackService
from app.services.workforce_succession.binder_intake_service import (
    BinderIntakeConflict,
    BinderIntakeNotFound,
    abandon_binder_intake_session,
    ensure_binder_intake_session,
    get_active_binder_intake,
    session_to_dict,
    update_binder_intake_session,
)
from app.services.workforce_succession.operator_scope import (
    deny_operator_district_wide,
    is_operator_self_scoped,
    operator_missing_workforce_profile,
    resolve_operator_employee_code,
)
from app.services.workforce_succession.sample_continuity import (
    build_sample_continuity_response,
)
from app.services.workforce_package_service import require_workforce_package_enabled
from app.schemas.doc_studio import DocDocumentRead
from app.services.doc_studio_service import DocStudioService
from app.tenant_auth import TenantContext

logger = logging.getLogger(__name__)

router = APIRouter()

# Admin tier: full module control (employer profile, alert settings, user-facing config)
WORKFORCE_ADMIN_ROLES = [
    "district_admin",
    "district_manager",
    "global_admin",
    "system_admin",
    "ceu_admin",
]
# Manager tier: CRUD, imports, planning
WORKFORCE_MANAGER_ROLES = WORKFORCE_ADMIN_ROLES + [
    "ceu_manager",
    "workforce_manager",
]
# Viewer tier: read-only access
WORKFORCE_VIEWER_ROLES = WORKFORCE_MANAGER_ROLES + [
    "district_operator",
    "lead_engineer",
    "field_engineer",
    "ceu_user",
]

require_workforce_admin = deps.require_tenant_roles(
    WORKFORCE_ADMIN_ROLES, require_any=True
)
require_workforce_manager = deps.require_tenant_roles(
    WORKFORCE_MANAGER_ROLES, require_any=True
)
require_workforce_viewer = deps.require_tenant_roles(
    WORKFORCE_VIEWER_ROLES, require_any=True
)

UTILITY_WORKFORCE_AUTHOR_ROLES = [
    "district_admin",
    "district_manager",
    "workforce_manager",
    "ceu_manager",
    "ceu_admin",
    "admin",
]


def _require_utility_workforce_author(context: TenantContext) -> None:
    """Utility binders are authored by district roles — not bare platform/section partners."""
    if any(role in context.roles for role in UTILITY_WORKFORCE_AUTHOR_ROLES):
        return
    raise HTTPException(
        status_code=403,
        detail=(
            "Succession Binders are created by utility superintendents or workforce managers. "
            "Use Act as (audited) to write on behalf of a utility, or ask the utility to sign in."
        ),
    )


CSV_TEMPLATE_DIR = (
    Path(__file__).resolve().parents[4]
    / "docs"
    / "workforce_succession"
    / "csv_templates"
)

ENTITY_TO_TEMPLATE_FILE = {
    "positions": "workforce_positions.csv",
    "employees": "workforce_employees.csv",
    "certifications": "workforce_certifications.csv",
    "critical_functions": "workforce_critical_functions.csv",
    "role_coverage": "workforce_role_coverage.csv",
    "succession_candidates": "workforce_succession_candidates.csv",
    "knowledge_artifacts": "workforce_knowledge_artifacts.csv",
    "transition_milestones": "workforce_transition_milestones.csv",
}


def _authorized_districts(db: Session, context: TenantContext) -> Set[str]:
    return DistrictSecurityService(db).get_authorized_districts(context)


def _require_district_auth(
    db: Session, context: TenantContext, district_code: str
) -> str:
    code = (district_code or "").strip()
    if not code:
        raise HTTPException(
            status_code=400, detail="district_code is required"
        )
    auth = _authorized_districts(db, context)
    if "*" not in auth and code not in auth:
        raise HTTPException(
            status_code=403, detail="Not authorized for this district"
        )
    return code


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------


@router.get("/templates", response_model=List[str])
async def list_templates(
    context: TenantContext = Depends(require_workforce_viewer),
):
    """Return the names of available CSV intake templates."""
    return sorted(ENTITY_TO_TEMPLATE_FILE.keys())


@router.get("/templates/{entity_type}", response_class=PlainTextResponse)
async def download_template(
    entity_type: str,
    context: TenantContext = Depends(require_workforce_viewer),
):
    """Stream the canonical CSV template for an entity type."""
    name = ENTITY_TO_TEMPLATE_FILE.get(entity_type)
    if not name:
        raise HTTPException(
            status_code=404,
            detail=f"unknown entity_type '{entity_type}', expected one of {list(ENTITY_TO_TEMPLATE_FILE.keys())}",
        )
    path = CSV_TEMPLATE_DIR / name
    if not path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"template file missing on server: {name}",
        )
    return PlainTextResponse(content=path.read_text(), media_type="text/csv")


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


@router.post("/import/preview", response_model=ImportPreview)
async def preview_import(
    entity_type: str = Query(..., description="One of: " + ", ".join(ENTITY_TYPES)),
    target_district: Optional[str] = Query(
        None, description="Override or supply the district when CSV omits it"
    ),
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    """Validate a workforce CSV without writing anything."""
    if target_district:
        _require_district_auth(db, context, target_district)
    content = await file.read()
    try:
        return preview_workforce_csv(
            db,
            entity_type=entity_type,
            content=content,
            target_district=target_district,
        )
    except WorkforceImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/import", response_model=ImportResult)
async def commit_import(
    entity_type: str = Query(..., description="One of: " + ", ".join(ENTITY_TYPES)),
    target_district: Optional[str] = Query(
        None, description="Override or supply the district when CSV omits it"
    ),
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    """Stage and commit a workforce CSV upload (upsert by natural key)."""
    if target_district:
        _require_district_auth(db, context, target_district)
    content = await file.read()
    try:
        result = import_workforce_csv(
            db,
            entity_type=entity_type,
            content=content,
            filename=file.filename,
            target_district=target_district,
            submitted_by_user_id=context.user_id,
            commit=True,
        )
    except WorkforceImportError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    _require_district_auth(db, context, result["district_code"])
    return result


@router.get(
    "/import/batches",
    response_model=List[WorkforceImportBatchRead],
)
async def list_import_batches(
    district_code: str = Query(..., min_length=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    return (
        db.query(WorkforceImportBatch)
        .filter(WorkforceImportBatch.district_code == code)
        .order_by(WorkforceImportBatch.created_at.desc())
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------------------
# Data quality (live district rows)
# ---------------------------------------------------------------------------


@router.get(
    "/data-quality",
    response_model=WorkforceDistrictValidateResponse,
)
async def district_data_quality(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    """Validate live workforce rows using the same rules as CSV import."""
    code = _require_district_auth(db, context, district_code)
    return validate_district_workforce_data(db, district_code=code)


# ---------------------------------------------------------------------------
# Read endpoints (one per entity)
# ---------------------------------------------------------------------------


def _list_entity(db, model, district_code, limit, **filters):
    entity_map = {
        WorkforcePosition: "positions",
        WorkforceEmployee: "employees",
        WorkforceCertification: "certifications",
        WorkforceCriticalFunction: "critical_functions",
        WorkforceRoleCoverage: "role_coverage",
        WorkforceSuccessionCandidate: "succession_candidates",
        WorkforceKnowledgeArtifact: "knowledge_artifacts",
        WorkforceTransitionMilestone: "transition_milestones",
    }
    entity_type = entity_map.get(model)
    if entity_type:
        return list_entities(
            db,
            entity_type=entity_type,
            district_code=district_code,
            limit=limit,
            record_status=filters.get("record_status"),
            q=filters.get("q"),
            department=filters.get("department"),
            position_code=filters.get("position_code"),
            employee_code=filters.get("employee_code"),
            function_code=filters.get("function_code"),
            expiring_within_days=filters.get("expiring_within_days"),
            upcoming_only=filters.get("upcoming_only"),
        )
    return (
        db.query(model)
        .filter(model.district_code == district_code)
        .order_by(model.id.asc())
        .limit(limit)
        .all()
    )


@router.get("/positions", response_model=List[WorkforcePositionRead])
async def list_positions(
    district_code: str = Query(..., min_length=1),
    limit: int = Query(500, ge=1, le=2000),
    record_status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    deny_operator_district_wide(context, "positions")
    return _list_entity(
        db, WorkforcePosition, code, limit,
        record_status=record_status, q=q, department=department,
    )


@router.get("/employees", response_model=List[WorkforceEmployeeRead])
async def list_employees(
    district_code: str = Query(..., min_length=1),
    limit: int = Query(500, ge=1, le=2000),
    record_status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    position_code: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    if operator_missing_workforce_profile(db, context, code):
        return []
    own = resolve_operator_employee_code(db, context, code, missing_ok=True)
    return _list_entity(
        db, WorkforceEmployee, code, limit,
        record_status=record_status, q=q, position_code=position_code,
        employee_code=own,
    )


@router.get(
    "/certifications", response_model=List[WorkforceCertificationRead]
)
async def list_certifications(
    district_code: str = Query(..., min_length=1),
    expiring_within_days: Optional[int] = Query(None, ge=0, le=730),
    record_status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    employee_code: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    if operator_missing_workforce_profile(db, context, code):
        return []
    own = resolve_operator_employee_code(
        db, context, code, requested_employee_code=employee_code, missing_ok=True
    )
    return _list_entity(
        db, WorkforceCertification, code, limit,
        record_status=record_status, q=q, employee_code=own,
        expiring_within_days=expiring_within_days,
    )


@router.get(
    "/critical-functions",
    response_model=List[WorkforceCriticalFunctionRead],
)
async def list_critical_functions(
    district_code: str = Query(..., min_length=1),
    limit: int = Query(500, ge=1, le=2000),
    record_status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    function_code: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    deny_operator_district_wide(context, "critical functions")
    return _list_entity(
        db, WorkforceCriticalFunction, code, limit,
        record_status=record_status, q=q, function_code=function_code,
    )


@router.get(
    "/role-coverage", response_model=List[WorkforceRoleCoverageRead]
)
async def list_role_coverage(
    district_code: str = Query(..., min_length=1),
    function_code: Optional[str] = Query(None),
    employee_code: Optional[str] = Query(None),
    record_status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(1000, ge=1, le=5000),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    if operator_missing_workforce_profile(db, context, code):
        return []
    own = resolve_operator_employee_code(
        db, context, code, requested_employee_code=employee_code, missing_ok=True
    )
    return _list_entity(
        db, WorkforceRoleCoverage, code, limit,
        record_status=record_status, q=q,
        function_code=function_code, employee_code=own,
    )


@router.get(
    "/succession-candidates",
    response_model=List[WorkforceSuccessionCandidateRead],
)
async def list_succession_candidates(
    district_code: str = Query(..., min_length=1),
    limit: int = Query(500, ge=1, le=2000),
    record_status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    employee_code: Optional[str] = Query(None),
    position_code: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    if operator_missing_workforce_profile(db, context, code):
        return []
    own = resolve_operator_employee_code(
        db, context, code, requested_employee_code=employee_code, missing_ok=True
    )
    return _list_entity(
        db, WorkforceSuccessionCandidate, code, limit,
        record_status=record_status, q=q,
        employee_code=own, position_code=position_code,
    )


@router.get(
    "/knowledge-artifacts",
    response_model=List[WorkforceKnowledgeArtifactRead],
)
async def list_knowledge_artifacts(
    district_code: str = Query(..., min_length=1),
    function_code: Optional[str] = Query(None),
    record_status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    deny_operator_district_wide(context, "knowledge artifacts")
    return _list_entity(
        db, WorkforceKnowledgeArtifact, code, limit,
        record_status=record_status, q=q, function_code=function_code,
    )


@router.get(
    "/transition-milestones",
    response_model=List[WorkforceTransitionMilestoneRead],
)
async def list_transition_milestones(
    district_code: str = Query(..., min_length=1),
    position_code: Optional[str] = Query(None),
    upcoming_only: bool = Query(False),
    record_status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    deny_operator_district_wide(context, "transition milestones")
    return _list_entity(
        db, WorkforceTransitionMilestone, code, limit,
        record_status=record_status, q=q,
        position_code=position_code, upcoming_only=upcoming_only,
    )


# ---------------------------------------------------------------------------
# Continuity analytics
# ---------------------------------------------------------------------------


@router.get("/continuity", response_model=WorkforceContinuityResponse)
async def workforce_continuity(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    """Compute the workforce continuity scorecard and dashboard payload.

    Returns illustrative sample data (``data_mode=sample``) when the login has
    no linked workforce profile or the district has no live roster yet.
    """
    code = _require_district_auth(db, context, district_code)
    if operator_missing_workforce_profile(db, context, code):
        return build_sample_continuity_response(code, reason="no_linked_profile")

    own = resolve_operator_employee_code(db, context, code, missing_ok=True)
    # Self-scoped with missing_ok still None only when not operator — managers
    # get district-wide; operators without a profile already returned sample.
    if is_operator_self_scoped(context) and own is None:
        return build_sample_continuity_response(code, reason="no_linked_profile")

    payload = compute_continuity_response(db, code, employee_code=own)
    sc = payload.get("scorecard") or {}
    empty = (
        int(sc.get("total_employees") or 0) == 0
        and int(sc.get("total_critical_functions") or 0) == 0
        and int(sc.get("total_positions") or 0) == 0
    )
    if empty:
        return build_sample_continuity_response(code, reason="empty_district")

    payload["data_mode"] = "live"
    payload["sample_notice"] = None
    payload["sample_reason"] = None
    return payload


@router.get("/continuity/scorecards", response_model=List[Dict[str, Any]])
async def workforce_scorecards(
    district_codes: Optional[List[str]] = Query(
        None,
        description="Districts to summarize. Defaults to user's authorized districts.",
    ),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    """Return scorecards for each requested (or accessible) district."""
    if is_operator_self_scoped(context):
        deny_operator_district_wide(context, "district scorecards")
    auth = _authorized_districts(db, context)
    requested: List[str]
    if district_codes:
        for c in district_codes:
            if "*" not in auth and c not in auth:
                raise HTTPException(
                    status_code=403, detail=f"Not authorized for district {c}"
                )
        requested = district_codes
    else:
        if "*" in auth:
            from app.models.water_district import WaterDistrict

            requested = [
                d[0]
                for d in db.query(WaterDistrict.district_code)
                .filter(WaterDistrict.is_active.is_(True))
                .order_by(WaterDistrict.district_code)
                .limit(50)
                .all()
            ]
        else:
            requested = sorted(auth)
    out: List[Dict[str, Any]] = []
    for code in requested:
        payload = compute_continuity_response(db, code)
        out.append(payload["scorecard"])
    return out


# ---------------------------------------------------------------------------
# Alert scanner trigger
# ---------------------------------------------------------------------------


@router.post(
    "/alerts/scan", response_model=WorkforceAlertScanResult
)
async def trigger_alert_scan(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    """Run the workforce alert scanner for a single district on demand.

    Emits alerts for certification expirations, coverage gaps, retirement
    horizons, overdue milestones, and due 30/60/90/180-day check-ins. Idempotent
    against open alerts via a deterministic dedup key.
    """
    code = _require_district_auth(db, context, district_code)
    result = scan_district(db, code)
    return WorkforceAlertScanResult(
        district_code=result.district_code,
        created=result.created,
        skipped_duplicate=result.skipped_duplicate,
        summary=result.summary,
    )


# ---------------------------------------------------------------------------
# Planning sessions (wizard stage persistence)
# ---------------------------------------------------------------------------


def _session_to_read(row: WorkforcePlanningSession) -> WorkforcePlanningSessionRead:
    completed: List[str] = []
    if row.completed_steps:
        try:
            parsed = json.loads(row.completed_steps)
            if isinstance(parsed, list):
                completed = [str(x) for x in parsed]
        except json.JSONDecodeError:
            completed = []
    validation_summary = None
    if row.validation_summary:
        try:
            validation_summary = json.loads(row.validation_summary)
        except json.JSONDecodeError:
            validation_summary = None
    return WorkforcePlanningSessionRead(
        id=row.id,
        district_code=row.district_code,
        created_by_user_id=row.created_by_user_id,
        title=row.title,
        current_step=row.current_step,
        completed_steps=completed,
        status=row.status,
        payload=parse_session_payload(row.payload_json),
        validation_summary=validation_summary,
        last_saved_at=row.last_saved_at,
        submitted_at=row.submitted_at,
        published_at=row.published_at,
        published_batch_id=row.published_batch_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/planning-session", response_model=Optional[WorkforcePlanningSessionRead])
async def get_planning_session_draft(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    row = get_active_draft(db, district_code=code, user_id=context.user_id)
    if row is None:
        return None
    return _session_to_read(row)


@router.post("/planning-session", response_model=WorkforcePlanningSessionEnsureResponse)
async def ensure_planning_session_draft(
    body: WorkforcePlanningSessionCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    try:
        row, created = get_or_create_planning_session(
            db,
            district_code=body.district_code,
            user_id=context.user_id,
            title=body.title,
        )
    except PlanningSessionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return WorkforcePlanningSessionEnsureResponse(
        session=_session_to_read(row),
        created=created,
    )


@router.patch("/planning-session/{session_id}", response_model=WorkforcePlanningSessionRead)
async def patch_planning_session_draft(
    session_id: int,
    body: WorkforcePlanningSessionUpdate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    try:
        row = update_planning_session(
            db,
            session_id=session_id,
            user_id=context.user_id,
            payload=body.payload,
            current_step=body.current_step,
            completed_steps=body.completed_steps,
            title=body.title,
            status=body.status,
        )
    except PlanningSessionNotFound:
        raise HTTPException(status_code=404, detail="Planning session not found")
    except PlanningSessionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _session_to_read(row)


@router.post(
    "/planning-session/{session_id}/validate",
    response_model=WorkforcePlanningSessionValidateResponse,
)
async def validate_planning_session_draft(
    session_id: int,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    try:
        result = validate_planning_session(
            db, session_id=session_id, user_id=context.user_id
        )
    except PlanningSessionNotFound:
        raise HTTPException(status_code=404, detail="Planning session not found")
    return WorkforcePlanningSessionValidateResponse(**result)


@router.post(
    "/planning-session/{session_id}/publish",
    response_model=WorkforcePlanningSessionPublishResponse,
)
async def publish_planning_session_draft(
    session_id: int,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    try:
        result = publish_planning_session(
            db,
            session_id=session_id,
            user_id=context.user_id,
            submitted_by_user_id=context.user_id,
        )
    except PlanningSessionNotFound:
        raise HTTPException(status_code=404, detail="Planning session not found")
    except PlanningSessionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return WorkforcePlanningSessionPublishResponse(**result)


@router.post("/planning-session/{session_id}/abandon", response_model=WorkforcePlanningSessionRead)
async def abandon_planning_session_draft(
    session_id: int,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    try:
        row = abandon_planning_session(
            db, session_id=session_id, user_id=context.user_id
        )
    except PlanningSessionNotFound:
        raise HTTPException(status_code=404, detail="Planning session not found")
    except PlanningSessionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _session_to_read(row)


# ---------------------------------------------------------------------------
# Widget summary (main dashboard)
# ---------------------------------------------------------------------------


@router.get("/widget-summary")
async def workforce_widget_summary(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    from app.services.workforce_succession.ceu_service import compute_district_ceu_summaries

    code = _require_district_auth(db, context, district_code)
    continuity = compute_continuity_response(db, code)
    scorecard = continuity["scorecard"]
    ceu_rows = compute_district_ceu_summaries(db, code)
    shortfall_ops = [r for r in ceu_rows if r.get("is_shortfall")]
    records_missing_vouchers = sum(r.get("records_missing_vouchers", 0) for r in ceu_rows)
    draft = get_active_draft(db, district_code=code, user_id=context.user_id)
    wizard_stage = None
    if draft:
        completed: List[str] = []
        if draft.completed_steps:
            try:
                parsed = json.loads(draft.completed_steps)
                if isinstance(parsed, list):
                    completed = [str(x) for x in parsed]
            except json.JSONDecodeError:
                completed = []
        wizard_stage = {
            "current_step": draft.current_step,
            "completed_steps": completed,
            "status": draft.status,
        }
    return {
        "district_code": code,
        "readiness_score": scorecard.get("readiness_score"),
        "cert_cliff_90d": scorecard.get("cert_cliff_90d"),
        "retirement_24mo": scorecard.get("employees_retirement_eligible_24mo"),
        "ceu_shortfall_count": scorecard.get("ceu_shortfall_count"),
        "records_missing_vouchers": records_missing_vouchers,
        "ceu_shortfall_operators": [
            {
                "employee_code": r["employee_code"],
                "employee_name": r["employee_name"],
                "remaining_hours": r["remaining_hours"],
                "days_until_cycle_end": r["days_until_cycle_end"],
            }
            for r in shortfall_ops[:5]
        ],
        "wizard_stage": wizard_stage,
    }


@router.get(
    "/districts/{district_code}/workforce-binder",
    response_model=WorkforceDocPackResponse | None,
)
def get_workforce_binder(
    district_code: str,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    """Return the existing succession binder for a district, if one was created."""
    code = _require_district_auth(db, context, district_code)
    require_workforce_package_enabled(db, code)
    user_id = getattr(context, "user_id", None)
    existing = WorkforceDocPackService(db).find_existing_binder(code)
    if not existing:
        return None
    studio = DocStudioService(db)
    return WorkforceDocPackResponse(
        pack_type=existing.pack_type,
        profile=existing.profile,
        folder_id=existing.folder_id,
        cover_document_id=existing.cover_document_id,
        document_count=len(existing.documents),
        documents=[studio._doc_with_lock_name(doc, user_id) for doc in existing.documents],
    )


@router.post(
    "/districts/{district_code}/generate-documentation-pack",
    response_model=WorkforceDocPackResponse,
)
async def generate_workforce_documentation_pack(
    district_code: str,
    body: GenerateWorkforceDocPackRequest | None = None,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    """Create or refresh a Succession Binder or CEU Tracker pack in Document Studio."""
    _require_utility_workforce_author(context)
    code = _require_district_auth(db, context, district_code)
    require_workforce_package_enabled(db, code)
    user_id = getattr(context, "user_id", None)
    req = body or GenerateWorkforceDocPackRequest()
    result = WorkforceDocPackService(db).generate_pack(
        code,
        user_id,
        pack_type=req.pack_type,
        profile=req.profile,
        contact_name=req.contact_name,
        contact_email=req.contact_email,
        use_live_data=req.use_live_data,
    )
    studio = DocStudioService(db)
    return WorkforceDocPackResponse(
        pack_type=result.pack_type,
        profile=result.profile,
        folder_id=result.folder_id,
        cover_document_id=result.cover_document_id,
        document_count=len(result.documents),
        documents=[studio._doc_with_lock_name(doc, user_id) for doc in result.documents],
    )


def _intake_to_read(data: dict[str, Any]) -> WorkforceBinderIntakeRead:
    return WorkforceBinderIntakeRead(**data)


def _pack_to_response(result, studio, user_id) -> WorkforceDocPackResponse:
    return WorkforceDocPackResponse(
        pack_type=result.pack_type,
        profile=result.profile,
        folder_id=result.folder_id,
        cover_document_id=result.cover_document_id,
        document_count=len(result.documents),
        documents=[studio._doc_with_lock_name(doc, user_id) for doc in result.documents],
    )


# ---------------------------------------------------------------------------
# Binder intake wizard
# ---------------------------------------------------------------------------


@router.get("/binder-intake", response_model=Optional[WorkforceBinderIntakeRead])
async def get_binder_intake_draft(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    row = get_active_binder_intake(db, district_code=code, user_id=context.user_id)
    if row is None:
        return None
    return _intake_to_read(session_to_dict(row))


@router.post("/binder-intake", response_model=WorkforceBinderIntakeEnsureResponse)
async def ensure_binder_intake_draft(
    body: WorkforceBinderIntakeCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_utility_workforce_author(context)
    code = _require_district_auth(db, context, body.district_code)
    require_workforce_package_enabled(db, code)
    row, created = ensure_binder_intake_session(
        db, district_code=code, user_id=context.user_id
    )
    return WorkforceBinderIntakeEnsureResponse(
        session=_intake_to_read(session_to_dict(row)),
        created=created,
    )


@router.patch("/binder-intake/{session_id}", response_model=WorkforceBinderIntakeRead)
async def patch_binder_intake_draft(
    session_id: int,
    body: WorkforceBinderIntakeUpdate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_utility_workforce_author(context)
    try:
        row = update_binder_intake_session(
            db,
            session_id=session_id,
            user_id=context.user_id,
            answers=body.answers,
            current_step=body.current_step,
            completed_steps=body.completed_steps,
        )
    except BinderIntakeNotFound:
        raise HTTPException(status_code=404, detail="Binder intake session not found")
    except BinderIntakeConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _intake_to_read(session_to_dict(row))


@router.post(
    "/binder-intake/{session_id}/complete",
    response_model=WorkforceBinderIntakeCompleteResponse,
)
async def complete_binder_intake(
    session_id: int,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_utility_workforce_author(context)
    try:
        row = update_binder_intake_session(
            db,
            session_id=session_id,
            user_id=context.user_id,
        )
    except BinderIntakeNotFound:
        raise HTTPException(status_code=404, detail="Binder intake session not found")
    code = _require_district_auth(db, context, row.district_code)
    require_workforce_package_enabled(db, code)
    user_id = getattr(context, "user_id", None)
    answers = session_to_dict(row)["answers"]
    pack_svc = WorkforceDocPackService(db)
    result = pack_svc.generate_pack(
        code,
        user_id,
        pack_type="succession_binder",
        profile=answers.get("profile", "small_system"),
        contact_name=answers.get("contact_name"),
        contact_email=answers.get("contact_email"),
        use_live_data=bool(answers.get("use_live_data", True)),
        intake_answers=answers,
        force_refresh=True,
    )
    row = update_binder_intake_session(
        db,
        session_id=session_id,
        user_id=context.user_id,
        binder_folder_id=result.folder_id,
        status="completed",
    )
    studio = DocStudioService(db)
    return WorkforceBinderIntakeCompleteResponse(
        session=_intake_to_read(session_to_dict(row)),
        pack=_pack_to_response(result, studio, user_id),
    )


@router.post("/binder-intake/{session_id}/abandon", response_model=WorkforceBinderIntakeRead)
async def abandon_binder_intake_draft(
    session_id: int,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_utility_workforce_author(context)
    try:
        row = abandon_binder_intake_session(
            db, session_id=session_id, user_id=context.user_id
        )
    except BinderIntakeNotFound:
        raise HTTPException(status_code=404, detail="Binder intake session not found")
    except BinderIntakeConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _intake_to_read(session_to_dict(row))


from app.api.endpoints.workforce_crud_routes import router as workforce_crud_router

router.include_router(workforce_crud_router)
