"""CRUD, CEU, DOH-352, and batch-review routes for workforce succession."""

from __future__ import annotations

import logging
import mimetypes
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api import deps
from app.models.water_district import WaterDistrict
from app.models.workforce_succession import WorkforceCeuRecord, WorkforceCeuVoucher
from app.schemas.workforce_succession import (
    Doh352PreviewResponse,
    WorkforceDistrictEmployerProfileRead,
    WorkforceDistrictEmployerProfileUpdate,
    WorkforceCertificationCreate,
    WorkforceCertificationRead,
    WorkforceCertificationUpdate,
    WorkforceCriticalFunctionCreate,
    WorkforceCriticalFunctionRead,
    WorkforceCriticalFunctionUpdate,
    WorkforceCeuRecordCreate,
    WorkforceCeuRecordRead,
    WorkforceCeuRecordUpdate,
    WorkforceCeuSummaryResponse,
    WorkforceCeuVoucherRead,
    WorkforceEmployeeCreate,
    WorkforceEmployeeRead,
    WorkforceEmployeeUpdate,
    WorkforceImportBatchRead,
    WorkforceKnowledgeArtifactCreate,
    WorkforceKnowledgeArtifactRead,
    WorkforceKnowledgeArtifactUpdate,
    WorkforcePositionCreate,
    WorkforcePositionRead,
    WorkforcePositionUpdate,
    WorkforceRoleCoverageCreate,
    WorkforceRoleCoverageRead,
    WorkforceRoleCoverageUpdate,
    WorkforceSuccessionCandidateCreate,
    WorkforceSuccessionCandidateRead,
    WorkforceSuccessionCandidateUpdate,
    WorkforceTransitionMilestoneCreate,
    WorkforceTransitionMilestoneRead,
    WorkforceTransitionMilestoneUpdate,
    WorkforceTrainingCourseListResponse,
    WorkforceTrainingScrapeResult,
    LearningStreamSeedResult,
    CeuRequirementsResponse,
    WorkforceScheduledTrainingCreate,
    WorkforceScheduledTrainingListResponse,
    WorkforceScheduledTrainingRead,
    WorkforceScheduledTrainingUpdate,
    WorkforceTrainingEnrollmentListResponse,
    WorkforceTrainingEnrollmentRead,
)
from app.services.document_storage_service import DocumentStorageService
from app.services.workforce_succession.ceu_service import compute_district_ceu_summaries
from app.services.workforce_succession.crud_service import (
    WorkforceCrudError,
    create_entity,
    list_entities,
    promote_import_batch,
    reject_import_batch,
    soft_delete_entity,
    update_entity,
)
from app.services.workforce_succession.doh352_service import (
    _collect_cycle_vouchers,
    _gather_operator_data,
    build_doh352_field_map,
    build_voucher_manifest,
    generate_doh352_pdf,
)
from app.services.workforce_succession.importer import _resolve_employee_id
from app.services.workforce_succession.operator_scope import (
    get_linked_employee,
    resolve_operator_employee_code,
)
from app.services.workforce_succession.workforce_alert_settings import (
    load_workforce_alert_settings,
)
from app.services.district_security_service import DistrictSecurityService
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

_storage = DocumentStorageService()


def _authorized_districts(db: Session, context: TenantContext):
    return DistrictSecurityService(db).get_authorized_districts(context)


def _require_district_auth(
    db: Session, context: TenantContext, district_code: str
) -> str:
    code = (district_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="district_code is required")
    auth = _authorized_districts(db, context)
    if "*" not in auth and code not in auth:
        raise HTTPException(status_code=403, detail="Not authorized for this district")
    return code


def _crud_error(exc: WorkforceCrudError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(exc))


# ---------------------------------------------------------------------------
# Positions CRUD
# ---------------------------------------------------------------------------


@router.post("/positions", response_model=WorkforcePositionRead)
async def create_position(
    body: WorkforcePositionCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    try:
        return create_entity(db, entity_type="positions", data=body.model_dump())
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.patch("/positions/{entity_id}", response_model=WorkforcePositionRead)
async def update_position(
    entity_id: int,
    body: WorkforcePositionUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return update_entity(
            db,
            entity_type="positions",
            entity_id=entity_id,
            district_code=code,
            data=body.model_dump(exclude_unset=True),
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.delete("/positions/{entity_id}", response_model=WorkforcePositionRead)
async def delete_position(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return soft_delete_entity(
            db, entity_type="positions", entity_id=entity_id, district_code=code
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


# ---------------------------------------------------------------------------
# Employees CRUD
# ---------------------------------------------------------------------------


@router.post("/employees", response_model=WorkforceEmployeeRead)
async def create_employee(
    body: WorkforceEmployeeCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    try:
        return create_entity(db, entity_type="employees", data=body.model_dump())
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.patch("/employees/{entity_id}", response_model=WorkforceEmployeeRead)
async def update_employee(
    entity_id: int,
    body: WorkforceEmployeeUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return update_entity(
            db,
            entity_type="employees",
            entity_id=entity_id,
            district_code=code,
            data=body.model_dump(exclude_unset=True),
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.delete("/employees/{entity_id}", response_model=WorkforceEmployeeRead)
async def delete_employee(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return soft_delete_entity(
            db, entity_type="employees", entity_id=entity_id, district_code=code
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


# ---------------------------------------------------------------------------
# Certifications CRUD
# ---------------------------------------------------------------------------


@router.post("/certifications", response_model=WorkforceCertificationRead)
async def create_certification(
    body: WorkforceCertificationCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    try:
        return create_entity(db, entity_type="certifications", data=body.model_dump())
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.patch("/certifications/{entity_id}", response_model=WorkforceCertificationRead)
async def update_certification(
    entity_id: int,
    body: WorkforceCertificationUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return update_entity(
            db,
            entity_type="certifications",
            entity_id=entity_id,
            district_code=code,
            data=body.model_dump(exclude_unset=True),
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.delete("/certifications/{entity_id}", response_model=WorkforceCertificationRead)
async def delete_certification(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return soft_delete_entity(
            db, entity_type="certifications", entity_id=entity_id, district_code=code
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


# ---------------------------------------------------------------------------
# Critical functions CRUD
# ---------------------------------------------------------------------------


@router.post("/critical-functions", response_model=WorkforceCriticalFunctionRead)
async def create_critical_function(
    body: WorkforceCriticalFunctionCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    try:
        return create_entity(db, entity_type="critical_functions", data=body.model_dump())
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.patch("/critical-functions/{entity_id}", response_model=WorkforceCriticalFunctionRead)
async def update_critical_function(
    entity_id: int,
    body: WorkforceCriticalFunctionUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return update_entity(
            db,
            entity_type="critical_functions",
            entity_id=entity_id,
            district_code=code,
            data=body.model_dump(exclude_unset=True),
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.delete("/critical-functions/{entity_id}", response_model=WorkforceCriticalFunctionRead)
async def delete_critical_function(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return soft_delete_entity(
            db, entity_type="critical_functions", entity_id=entity_id, district_code=code
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


# ---------------------------------------------------------------------------
# Role coverage CRUD
# ---------------------------------------------------------------------------


@router.post("/role-coverage", response_model=WorkforceRoleCoverageRead)
async def create_role_coverage(
    body: WorkforceRoleCoverageCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    try:
        return create_entity(db, entity_type="role_coverage", data=body.model_dump())
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.patch("/role-coverage/{entity_id}", response_model=WorkforceRoleCoverageRead)
async def update_role_coverage(
    entity_id: int,
    body: WorkforceRoleCoverageUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return update_entity(
            db,
            entity_type="role_coverage",
            entity_id=entity_id,
            district_code=code,
            data=body.model_dump(exclude_unset=True),
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.delete("/role-coverage/{entity_id}", response_model=WorkforceRoleCoverageRead)
async def delete_role_coverage(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return soft_delete_entity(
            db, entity_type="role_coverage", entity_id=entity_id, district_code=code
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


# ---------------------------------------------------------------------------
# Succession candidates CRUD
# ---------------------------------------------------------------------------


@router.post("/succession-candidates", response_model=WorkforceSuccessionCandidateRead)
async def create_succession_candidate(
    body: WorkforceSuccessionCandidateCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    try:
        return create_entity(db, entity_type="succession_candidates", data=body.model_dump())
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.patch("/succession-candidates/{entity_id}", response_model=WorkforceSuccessionCandidateRead)
async def update_succession_candidate(
    entity_id: int,
    body: WorkforceSuccessionCandidateUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return update_entity(
            db,
            entity_type="succession_candidates",
            entity_id=entity_id,
            district_code=code,
            data=body.model_dump(exclude_unset=True),
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.delete("/succession-candidates/{entity_id}", response_model=WorkforceSuccessionCandidateRead)
async def delete_succession_candidate(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return soft_delete_entity(
            db, entity_type="succession_candidates", entity_id=entity_id, district_code=code
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


# ---------------------------------------------------------------------------
# Knowledge artifacts CRUD
# ---------------------------------------------------------------------------


@router.post("/knowledge-artifacts", response_model=WorkforceKnowledgeArtifactRead)
async def create_knowledge_artifact(
    body: WorkforceKnowledgeArtifactCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    try:
        return create_entity(db, entity_type="knowledge_artifacts", data=body.model_dump())
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.patch("/knowledge-artifacts/{entity_id}", response_model=WorkforceKnowledgeArtifactRead)
async def update_knowledge_artifact(
    entity_id: int,
    body: WorkforceKnowledgeArtifactUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return update_entity(
            db,
            entity_type="knowledge_artifacts",
            entity_id=entity_id,
            district_code=code,
            data=body.model_dump(exclude_unset=True),
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.delete("/knowledge-artifacts/{entity_id}", response_model=WorkforceKnowledgeArtifactRead)
async def delete_knowledge_artifact(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return soft_delete_entity(
            db, entity_type="knowledge_artifacts", entity_id=entity_id, district_code=code
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


# ---------------------------------------------------------------------------
# Transition milestones CRUD
# ---------------------------------------------------------------------------


@router.post("/transition-milestones", response_model=WorkforceTransitionMilestoneRead)
async def create_transition_milestone(
    body: WorkforceTransitionMilestoneCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    try:
        return create_entity(db, entity_type="transition_milestones", data=body.model_dump())
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.patch("/transition-milestones/{entity_id}", response_model=WorkforceTransitionMilestoneRead)
async def update_transition_milestone(
    entity_id: int,
    body: WorkforceTransitionMilestoneUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return update_entity(
            db,
            entity_type="transition_milestones",
            entity_id=entity_id,
            district_code=code,
            data=body.model_dump(exclude_unset=True),
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.delete("/transition-milestones/{entity_id}", response_model=WorkforceTransitionMilestoneRead)
async def delete_transition_milestone(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return soft_delete_entity(
            db, entity_type="transition_milestones", entity_id=entity_id, district_code=code
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


# ---------------------------------------------------------------------------
# Import batch promote / reject
# ---------------------------------------------------------------------------


@router.post("/import/batches/{batch_id}/promote", response_model=WorkforceImportBatchRead)
async def promote_batch(
    batch_id: int,
    district_code: str = Query(..., min_length=1),
    review_notes: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return promote_import_batch(
            db,
            batch_id=batch_id,
            district_code=code,
            reviewer_user_id=context.user_id,
            review_notes=review_notes,
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


@router.post("/import/batches/{batch_id}/reject", response_model=WorkforceImportBatchRead)
async def reject_batch(
    batch_id: int,
    district_code: str = Query(..., min_length=1),
    review_notes: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    try:
        return reject_import_batch(
            db,
            batch_id=batch_id,
            district_code=code,
            reviewer_user_id=context.user_id,
            review_notes=review_notes,
        )
    except WorkforceCrudError as exc:
        raise _crud_error(exc)


# ---------------------------------------------------------------------------
# CEU records
# ---------------------------------------------------------------------------


def _voucher_counts_for_records(db: Session, record_ids: List[int]) -> Dict[int, int]:
    if not record_ids:
        return {}
    return dict(
        db.query(
            WorkforceCeuVoucher.ceu_record_id,
            func.count(WorkforceCeuVoucher.id),
        )
        .filter(WorkforceCeuVoucher.ceu_record_id.in_(record_ids))
        .group_by(WorkforceCeuVoucher.ceu_record_id)
        .all()
    )


def _ceu_record_read(row: WorkforceCeuRecord, voucher_count: int = 0) -> WorkforceCeuRecordRead:
    payload = WorkforceCeuRecordRead.model_validate(row).model_dump()
    payload["voucher_count"] = voucher_count
    return WorkforceCeuRecordRead(**payload)


@router.get("/ceu/records", response_model=List[WorkforceCeuRecordRead])
async def list_ceu_records(
    district_code: str = Query(..., min_length=1),
    employee_code: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    own = resolve_operator_employee_code(
        db, context, code, requested_employee_code=employee_code
    )
    query = db.query(WorkforceCeuRecord).filter(
        WorkforceCeuRecord.district_code == code,
        WorkforceCeuRecord.record_status != "archived",
    )
    if own:
        query = query.filter(WorkforceCeuRecord.employee_code == own)
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(
            WorkforceCeuRecord.course_title.ilike(needle)
            | WorkforceCeuRecord.provider.ilike(needle)
        )
    rows = query.order_by(WorkforceCeuRecord.completion_date.desc()).limit(limit).all()
    counts = _voucher_counts_for_records(db, [r.id for r in rows])
    return [_ceu_record_read(r, counts.get(r.id, 0)) for r in rows]


@router.post("/ceu/records", response_model=WorkforceCeuRecordRead)
async def create_ceu_record(
    body: WorkforceCeuRecordCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    payload = body.model_dump()
    payload["employee_id"] = _resolve_employee_id(
        db, body.district_code, body.employee_code
    )
    row = WorkforceCeuRecord(**payload, record_status="active")
    db.add(row)
    db.commit()
    db.refresh(row)
    return _ceu_record_read(row, 0)


@router.patch("/ceu/records/{record_id}", response_model=WorkforceCeuRecordRead)
async def update_ceu_record(
    record_id: int,
    body: WorkforceCeuRecordUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    row = (
        db.query(WorkforceCeuRecord)
        .filter(WorkforceCeuRecord.id == record_id, WorkforceCeuRecord.district_code == code)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="CEU record not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    if body.employee_code:
        row.employee_id = _resolve_employee_id(db, code, body.employee_code)
    db.commit()
    db.refresh(row)
    counts = _voucher_counts_for_records(db, [row.id])
    return _ceu_record_read(row, counts.get(row.id, 0))


@router.delete("/ceu/records/{record_id}", response_model=WorkforceCeuRecordRead)
async def delete_ceu_record(
    record_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    row = (
        db.query(WorkforceCeuRecord)
        .filter(WorkforceCeuRecord.id == record_id, WorkforceCeuRecord.district_code == code)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="CEU record not found")
    row.record_status = "archived"
    db.commit()
    db.refresh(row)
    counts = _voucher_counts_for_records(db, [row.id])
    return _ceu_record_read(row, counts.get(row.id, 0))


@router.get("/ceu/requirements", response_model=CeuRequirementsResponse)
async def ceu_requirements(
    context: TenantContext = Depends(require_workforce_viewer),
):
    del context
    from app.services.workforce_succession.ceu_requirements import get_requirements_taxonomy

    return CeuRequirementsResponse(**get_requirements_taxonomy())


@router.get("/ceu/summary", response_model=WorkforceCeuSummaryResponse)
async def ceu_summary(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    own = resolve_operator_employee_code(db, context, code)
    settings = load_workforce_alert_settings(db, code)
    operators = compute_district_ceu_summaries(
        db,
        code,
        ceu_overrides=settings.ceu_requirements_by_grade or None,
        ceu_shortfall_lead_days=settings.ceu_shortfall_lead_days,
        employee_code=own,
    )
    shortfall = sum(1 for o in operators if o.get("is_shortfall"))
    return WorkforceCeuSummaryResponse(
        district_code=code,
        operators=operators,
        total_shortfall=shortfall,
        total_operators=len(operators),
    )


@router.post("/ceu/records/{record_id}/vouchers", response_model=WorkforceCeuVoucherRead)
async def upload_ceu_voucher(
    record_id: int,
    district_code: str = Query(..., min_length=1),
    description: Optional[str] = Query(None),
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    record = (
        db.query(WorkforceCeuRecord)
        .filter(WorkforceCeuRecord.id == record_id, WorkforceCeuRecord.district_code == code)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=404, detail="CEU record not found")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    ext = (Path(file.filename or "voucher.pdf").suffix or ".pdf").lstrip(".").lower()
    meta = _storage.upload(
        "workforce_ceu",
        record_id,
        data,
        file.content_type,
        ext,
    )
    voucher = WorkforceCeuVoucher(
        district_code=code,
        ceu_record_id=record_id,
        filename=file.filename or f"voucher.{ext}",
        content_type=meta.get("content_type"),
        file_extension=ext,
        size_bytes=meta.get("size_bytes", len(data)),
        description=description,
        storage_kind=meta.get("storage_kind", "local"),
        blob_name=meta.get("blob_name"),
        file_path=meta.get("file_path"),
        uploaded_by_user_id=context.user_id,
    )
    db.add(voucher)
    db.commit()
    db.refresh(voucher)
    return voucher


@router.get("/ceu/records/{record_id}/vouchers", response_model=List[WorkforceCeuVoucherRead])
async def list_ceu_vouchers(
    record_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    record = (
        db.query(WorkforceCeuRecord)
        .filter(WorkforceCeuRecord.id == record_id, WorkforceCeuRecord.district_code == code)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=404, detail="CEU record not found")
    return (
        db.query(WorkforceCeuVoucher)
        .filter(
            WorkforceCeuVoucher.ceu_record_id == record_id,
            WorkforceCeuVoucher.district_code == code,
        )
        .order_by(WorkforceCeuVoucher.created_at.asc())
        .all()
    )


@router.get("/ceu/vouchers/{voucher_id}")
async def download_ceu_voucher(
    voucher_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    voucher = (
        db.query(WorkforceCeuVoucher)
        .filter(
            WorkforceCeuVoucher.id == voucher_id,
            WorkforceCeuVoucher.district_code == code,
        )
        .first()
    )
    if voucher is None:
        raise HTTPException(status_code=404, detail="Voucher not found")
    try:
        content = _storage.read_bytes(
            voucher.storage_kind, voucher.blob_name, voucher.file_path
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not content:
        raise HTTPException(status_code=404, detail="Voucher file not found")
    return Response(
        content=content,
        media_type=voucher.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{voucher.filename}"'},
    )


@router.delete("/ceu/vouchers/{voucher_id}")
async def delete_ceu_voucher(
    voucher_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    voucher = (
        db.query(WorkforceCeuVoucher)
        .filter(
            WorkforceCeuVoucher.id == voucher_id,
            WorkforceCeuVoucher.district_code == code,
        )
        .first()
    )
    if voucher is None:
        raise HTTPException(status_code=404, detail="Voucher not found")
    try:
        _storage.delete(voucher.storage_kind, voucher.blob_name, voucher.file_path)
    except Exception:
        logger.warning("Could not delete voucher blob for id=%s", voucher_id)
    db.delete(voucher)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# DOH-352
# ---------------------------------------------------------------------------


@router.get("/district-employer-profile", response_model=WorkforceDistrictEmployerProfileRead)
async def get_district_employer_profile(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    district = (
        db.query(WaterDistrict)
        .filter(WaterDistrict.district_code == code)
        .first()
    )
    if district is None:
        raise HTTPException(status_code=404, detail="District not found")
    return district


@router.patch("/district-employer-profile", response_model=WorkforceDistrictEmployerProfileRead)
async def update_district_employer_profile(
    body: WorkforceDistrictEmployerProfileUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_admin),
):
    code = _require_district_auth(db, context, district_code)
    district = (
        db.query(WaterDistrict)
        .filter(WaterDistrict.district_code == code)
        .first()
    )
    if district is None:
        raise HTTPException(status_code=404, detail="District not found")
    if body.mailing_address_line1 is not None:
        district.mailing_address_line1 = body.mailing_address_line1
    if body.mailing_address_line2 is not None:
        district.mailing_address_line2 = body.mailing_address_line2
    db.commit()
    db.refresh(district)
    return district


@router.get("/doh352/{employee_code}/preview", response_model=Doh352PreviewResponse)
async def doh352_preview(
    employee_code: str,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    fields = build_doh352_field_map(db, code, employee_code)
    if fields.get("error"):
        raise HTTPException(status_code=404, detail=fields["error"])
    _, _, _, ceu_rows = _gather_operator_data(db, code, employee_code)
    attachments = _collect_cycle_vouchers(db, ceu_rows)
    voucher_manifest, _ = build_voucher_manifest(attachments, _storage)
    return Doh352PreviewResponse(
        fields=fields,
        missing_fields=fields.get("missing_fields") or [],
        voucher_count=len(voucher_manifest),
        voucher_manifest=voucher_manifest,
    )


@router.get("/doh352/{employee_code}")
async def doh352_pdf(
    employee_code: str,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    try:
        pdf_bytes, meta = generate_doh352_pdf(db, code, employee_code)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    filename = f"DOH-352_{employee_code}_{code}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Training courses (statewide reference catalog)
# ---------------------------------------------------------------------------


@router.get("/training-courses", response_model=WorkforceTrainingCourseListResponse)
async def list_training_courses(
    cert_program: Optional[str] = Query(None),
    cert_type: Optional[str] = Query(None),
    course_category: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    upcoming_only: bool = Query(False),
    local_metro_only: bool = Query(True),
    q: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    del context
    from app.models.workforce_succession import WorkforceTrainingCourse
    from app.services.workforce_succession.training_catalog_regions import passes_local_metro_filter
    from app.services.workforce_succession.training_scraper import get_latest_sync_metadata

    query = db.query(WorkforceTrainingCourse)
    if not include_inactive:
        query = query.filter(WorkforceTrainingCourse.is_active.is_(True))
    if source:
        query = query.filter(WorkforceTrainingCourse.source == source.strip())
    if cert_program:
        query = query.filter(WorkforceTrainingCourse.cert_program == cert_program.strip())
    if cert_type:
        query = query.filter(WorkforceTrainingCourse.cert_type == cert_type.strip())
    if course_category:
        query = query.filter(
            WorkforceTrainingCourse.course_category == course_category.strip()
        )
    if grade:
        query = query.filter(WorkforceTrainingCourse.grade.ilike(f"%{grade.strip()}%"))
    if upcoming_only:
        today = date.today()
        query = query.filter(
            (WorkforceTrainingCourse.end_date.is_(None))
            | (WorkforceTrainingCourse.end_date >= today)
        )
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (WorkforceTrainingCourse.sponsor.ilike(like))
            | (WorkforceTrainingCourse.course_name.ilike(like))
            | (WorkforceTrainingCourse.contact_email.ilike(like))
            | (WorkforceTrainingCourse.description.ilike(like))
            | (WorkforceTrainingCourse.county.ilike(like))
            | (WorkforceTrainingCourse.city.ilike(like))
        )

    courses = (
        query.order_by(
            WorkforceTrainingCourse.start_date.asc().nullslast(),
            WorkforceTrainingCourse.sponsor.asc(),
            WorkforceTrainingCourse.course_name.asc(),
        ).all()
    )
    if local_metro_only:
        courses = [
            c
            for c in courses
            if c.source == "Learning Stream" or passes_local_metro_filter(c)
        ]
    meta = get_latest_sync_metadata(db)
    return WorkforceTrainingCourseListResponse(
        courses=courses,
        total=len(courses),
        last_synced_at=meta["last_synced_at"] if meta else None,
    )


@router.post("/training-courses/scrape", response_model=WorkforceTrainingScrapeResult)
async def scrape_training_courses(
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    del context
    from app.services.workforce_succession.training_scraper import (
        TrainingScrapeError,
        sync_training_courses,
    )

    try:
        result = sync_training_courses(db)
    except TrainingScrapeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return WorkforceTrainingScrapeResult(**result)


@router.post("/training-courses/seed-learning-stream", response_model=LearningStreamSeedResult)
async def seed_learning_stream_courses(
    district_code: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    from app.services.workforce_succession.learning_stream_seed import (
        seed_learning_stream_catalog,
        seed_learning_stream_district_sessions,
    )

    if district_code:
        _require_district_auth(db, context, district_code)
    added, updated = seed_learning_stream_catalog(db)
    sessions = 0
    if district_code:
        sessions = seed_learning_stream_district_sessions(db, district_code=district_code.strip())
    return LearningStreamSeedResult(
        catalog_added=added,
        catalog_updated=updated,
        district_sessions_created=sessions,
    )


def _scheduled_training_read(
    db: Session,
    row,
    *,
    employee_code: Optional[str] = None,
) -> WorkforceScheduledTrainingRead:
    from app.services.workforce_succession.training_enrollment_service import (
        enrich_scheduled_training,
    )

    payload = enrich_scheduled_training(db, row, employee_code=employee_code)
    catalog_source = None
    if row.source_course_id and row.source_course:
        catalog_source = row.source_course.source
    elif row.source_course_id:
        from app.models.workforce_succession import WorkforceTrainingCourse

        course = db.query(WorkforceTrainingCourse).filter(
            WorkforceTrainingCourse.id == row.source_course_id
        ).first()
        catalog_source = course.source if course else None
    payload["catalog_source"] = catalog_source
    return WorkforceScheduledTrainingRead.model_validate(payload)


# ---------------------------------------------------------------------------
# District scheduled training events
# ---------------------------------------------------------------------------


@router.get("/scheduled-training", response_model=WorkforceScheduledTrainingListResponse)
async def list_scheduled_training(
    district_code: str = Query(..., min_length=1),
    upcoming_only: bool = Query(False),
    cert_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    from app.services.workforce_succession.scheduled_training_service import (
        list_scheduled_trainings,
    )

    rows = list_scheduled_trainings(
        db,
        district_code=code,
        upcoming_only=upcoming_only,
        cert_type=cert_type,
        status=status,
    )
    emp = get_linked_employee(db, user_id=context.user_id, district_code=code)
    employee_code = emp.employee_code if emp else None
    trainings = [
        _scheduled_training_read(db, row, employee_code=employee_code) for row in rows
    ]
    return WorkforceScheduledTrainingListResponse(trainings=trainings, total=len(trainings))


@router.post("/scheduled-training", response_model=WorkforceScheduledTrainingRead)
async def create_scheduled_training(
    body: WorkforceScheduledTrainingCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    _require_district_auth(db, context, body.district_code)
    from app.services.workforce_succession.scheduled_training_service import (
        ScheduledTrainingError,
        create_scheduled_training as create_row,
    )

    try:
        return create_row(db, body.model_dump())
    except ScheduledTrainingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/scheduled-training/from-course/{course_id}",
    response_model=WorkforceScheduledTrainingRead,
)
async def create_scheduled_training_from_course(
    course_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    from app.services.workforce_succession.scheduled_training_service import (
        ScheduledTrainingError,
        create_from_catalog_course,
    )

    try:
        return create_from_catalog_course(db, district_code=code, course_id=course_id)
    except ScheduledTrainingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/scheduled-training/{entity_id}", response_model=WorkforceScheduledTrainingRead)
async def update_scheduled_training(
    entity_id: int,
    body: WorkforceScheduledTrainingUpdate,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    from app.services.workforce_succession.scheduled_training_service import (
        ScheduledTrainingError,
        update_scheduled_training as update_row,
    )

    try:
        return update_row(
            db,
            entity_id=entity_id,
            district_code=code,
            data=body.model_dump(exclude_unset=True),
        )
    except ScheduledTrainingError as exc:
        raise HTTPException(status_code=404 if "not found" in str(exc).lower() else 400, detail=str(exc)) from exc


@router.delete("/scheduled-training/{entity_id}", response_model=WorkforceScheduledTrainingRead)
async def delete_scheduled_training(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_manager),
):
    code = _require_district_auth(db, context, district_code)
    from app.services.workforce_succession.scheduled_training_service import (
        ScheduledTrainingError,
        soft_delete_scheduled_training,
    )

    try:
        return soft_delete_scheduled_training(db, entity_id=entity_id, district_code=code)
    except ScheduledTrainingError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/scheduled-training/{entity_id}/enroll",
    response_model=WorkforceTrainingEnrollmentRead,
)
async def enroll_in_scheduled_training(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    from app.services.workforce_succession.training_enrollment_service import (
        TrainingEnrollmentError,
        enroll_operator,
    )

    try:
        row = enroll_operator(
            db, context, district_code=code, training_id=entity_id
        )
    except TrainingEnrollmentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return WorkforceTrainingEnrollmentRead.model_validate(row)


@router.delete(
    "/scheduled-training/{entity_id}/enroll",
    response_model=WorkforceTrainingEnrollmentRead,
)
async def cancel_scheduled_training_enrollment(
    entity_id: int,
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    from app.services.workforce_succession.training_enrollment_service import (
        TrainingEnrollmentError,
        cancel_enrollment,
    )

    try:
        row = cancel_enrollment(
            db, context, district_code=code, training_id=entity_id
        )
    except TrainingEnrollmentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return WorkforceTrainingEnrollmentRead.model_validate(row)


@router.get(
    "/my-training-enrollments",
    response_model=WorkforceTrainingEnrollmentListResponse,
)
async def list_my_training_enrollments(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(require_workforce_viewer),
):
    code = _require_district_auth(db, context, district_code)
    from app.services.workforce_succession.training_enrollment_service import (
        list_my_enrollments,
    )

    emp = get_linked_employee(db, user_id=context.user_id, district_code=code)
    if emp is None:
        return WorkforceTrainingEnrollmentListResponse(enrollments=[], total=0)

    rows = list_my_enrollments(
        db, district_code=code, employee_code=emp.employee_code
    )
    out: List[WorkforceTrainingEnrollmentRead] = []
    for enr in rows:
        training = enr.scheduled_training
        base = WorkforceTrainingEnrollmentRead.model_validate(enr)
        if training:
            base = base.model_copy(
                update={
                    "training": _scheduled_training_read(
                        db, training, employee_code=emp.employee_code
                    )
                }
            )
        out.append(base)
    return WorkforceTrainingEnrollmentListResponse(enrollments=out, total=len(out))

