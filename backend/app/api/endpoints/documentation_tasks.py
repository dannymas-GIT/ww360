"""Documentation task + grant API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas.documentation_task import (
    DocumentationGrantCreate,
    DocumentationGrantRead,
    DocumentationTaskCreate,
    DocumentationTaskNoteCreate,
    DocumentationTaskNoteRead,
    DocumentationTaskRead,
    DocumentationTaskSubmit,
    DocumentationTaskSummary,
    DocumentationTaskUpdate,
    RecorderAccess,
)
from app.services import documentation_task_service as svc
from app.tenant_auth import TenantContext

router = APIRouter()


@router.get("/summary", response_model=DocumentationTaskSummary)
def get_summary(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.task_summary(db, context, district_code.upper())


@router.get("", response_model=list[DocumentationTaskRead])
def list_tasks(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.list_tasks_for_district(db, context, district_code.upper())


@router.get("/my", response_model=list[DocumentationTaskRead])
def my_tasks(
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.list_my_tasks(db, context)


@router.post("", response_model=DocumentationTaskRead)
def create_task(
    body: DocumentationTaskCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.create_task(db, context, body)


@router.patch("/{task_id}", response_model=DocumentationTaskRead)
def update_task(
    task_id: int,
    body: DocumentationTaskUpdate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.update_task(db, context, task_id, body)


@router.post("/{task_id}/notes", response_model=DocumentationTaskNoteRead)
def add_note(
    task_id: int,
    body: DocumentationTaskNoteCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.add_task_note(db, context, task_id, body)


@router.post("/{task_id}/submit", response_model=DocumentationTaskRead)
def submit_task(
    task_id: int,
    body: DocumentationTaskSubmit,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.submit_task(db, context, task_id, body.document_id)


@router.post("/{task_id}/request-changes", response_model=DocumentationTaskRead)
def request_changes(
    task_id: int,
    body: DocumentationTaskNoteCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.request_changes(db, context, task_id, body.body)


@router.post("/{task_id}/approve", response_model=DocumentationTaskRead)
def approve_task(
    task_id: int,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.approve_task(db, context, task_id)


@router.get("/recorder-access", response_model=RecorderAccess)
def recorder_access(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.recorder_access(db, context, district_code.upper())


@router.get("/grants", response_model=list[DocumentationGrantRead])
def list_grants(
    district_code: str = Query(..., min_length=1),
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.list_grants(db, context, district_code.upper())


@router.post("/grants", response_model=DocumentationGrantRead)
def create_grant(
    body: DocumentationGrantCreate,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    return svc.create_grant(db, context, body)


@router.delete("/grants/{grant_id}", status_code=204)
def delete_grant(
    grant_id: int,
    db: Session = Depends(deps.get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    svc.delete_grant(db, context, grant_id)
