"""Grants Studio API — catalog, eligibility match, applications, EPA autofill."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.grants import GrantApplication, GrantApplicationEvent
from app.services.grants.catalog import catalog_meta, get_program, list_programs
from app.services.grants.facts import build_district_facts, build_program_facts
from app.services.grants.matcher import evaluate_program, rank_programs
from app.services.grants.stats import epa_iwiwd_autofill
from app.tenant_auth import Roles, TenantContext

router = APIRouter()

PROGRAM_ROLES = [
    Roles.PLATFORM_ADMIN,
    Roles.STATE_ADMIN,
    Roles.OWW_PARTNER,
    Roles.NATIONAL_OBSERVER,
]
DISTRICT_WRITE_ROLES = [
    Roles.DISTRICT_ADMIN,
    Roles.DISTRICT_MANAGER,
    Roles.PLATFORM_ADMIN,
]


def _can_view(ctx: TenantContext) -> bool:
    if ctx.is_global_admin or ctx.is_national_admin:
        return True
    if ctx.has_any_role(PROGRAM_ROLES + DISTRICT_WRITE_ROLES + [Roles.DISTRICT_VIEWER]):
        return True
    return bool(ctx.district_code or ctx.assigned_districts)


def _can_write_program(ctx: TenantContext) -> bool:
    return ctx.is_global_admin or ctx.has_any_role(
        [Roles.PLATFORM_ADMIN, Roles.STATE_ADMIN, Roles.OWW_PARTNER]
    )


def _can_write_district(ctx: TenantContext, district_code: str) -> bool:
    if ctx.is_global_admin:
        return True
    if not ctx.has_any_role(DISTRICT_WRITE_ROLES):
        return False
    return ctx.has_district_access(district_code)


def _require_view(ctx: TenantContext) -> None:
    if not _can_view(ctx):
        raise HTTPException(status_code=403, detail="Grants view not authorized")


def _serialize(row: GrantApplication) -> dict[str, Any]:
    return {
        "id": row.id,
        "program_id": row.program_id,
        "owner_scope": row.owner_scope,
        "owner_code": row.owner_code,
        "cycle_key": row.cycle_key,
        "status": row.status,
        "fit_score": row.fit_score,
        "fit_reasons": row.fit_reasons,
        "missing_facts": row.missing_facts,
        "checklist": row.checklist,
        "auto_fill": row.auto_fill,
        "notes": row.notes,
        "due_date": row.due_date,
        "created_by": row.created_by,
        "updated_by": row.updated_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _audit(
    db: Session,
    *,
    application_id: str,
    actor_user_id: int | None,
    action: str,
    detail: dict | None = None,
) -> None:
    db.add(
        GrantApplicationEvent(
            application_id=application_id,
            actor_user_id=actor_user_id,
            action=action,
            detail=detail,
        )
    )


@router.get("/programs")
def grants_programs(
    water_focus: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_view(context)
    programs = list_programs(water_focus=water_focus, status=status, level=level)
    return {"meta": catalog_meta(), "count": len(programs), "programs": programs}


@router.get("/programs/{program_id}")
def grants_program_detail(
    program_id: str,
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_view(context)
    program = get_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@router.get("/match")
def grants_match(
    district_code: Optional[str] = Query(None),
    state_code: Optional[str] = Query(None),
    scope: str = Query("district", pattern="^(district|program)$"),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_view(context)
    st = (state_code or context.active_state_code or "NY").upper()[:2]
    if scope == "program":
        if not _can_write_program(context) and not context.has_role(Roles.NATIONAL_OBSERVER):
            raise HTTPException(status_code=403, detail="Program match not authorized")
        facts = build_program_facts(db, st)
    else:
        code = (district_code or context.district_code or "").strip()
        if not code:
            raise HTTPException(status_code=400, detail="district_code required")
        if not context.has_district_access(code) and not _can_write_program(context):
            raise HTTPException(status_code=403, detail="District not authorized")
        facts = build_district_facts(db, code, st)
    return {"facts": facts, "matches": rank_programs(list_programs(), facts)}


@router.get("/programs/{program_id}/eligibility")
def grants_program_eligibility(
    program_id: str,
    district_code: Optional[str] = Query(None),
    state_code: Optional[str] = Query(None),
    scope: str = Query("district", pattern="^(district|program)$"),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_view(context)
    program = get_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    st = (state_code or context.active_state_code or "NY").upper()[:2]
    if scope == "program":
        facts = build_program_facts(db, st)
    else:
        code = (district_code or context.district_code or "").strip()
        if not code:
            raise HTTPException(status_code=400, detail="district_code required")
        if not context.has_district_access(code) and not _can_write_program(context):
            raise HTTPException(status_code=403, detail="District not authorized")
        facts = build_district_facts(db, code, st)
    return {
        "program": program,
        "facts": facts,
        "result": evaluate_program(program, facts),
    }


@router.get("/autofill/epa-iwiwd")
def grants_epa_autofill(
    state_code: Optional[str] = Query("NY"),
    district_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_view(context)
    return epa_iwiwd_autofill(
        db,
        state_code=(state_code or "NY").upper()[:2],
        district_code=district_code or "",
    )


class ApplicationCreate(BaseModel):
    program_id: str
    owner_scope: str = Field(..., pattern="^(district|program|state)$")
    owner_code: str
    cycle_key: str = "current"
    status: str = "exploring"
    notes: Optional[str] = None
    due_date: Optional[str] = None


class ApplicationPatch(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    checklist: Optional[dict[str, Any]] = None
    auto_fill: Optional[dict[str, Any]] = None
    due_date: Optional[str] = None


@router.get("/applications")
def list_applications(
    owner_scope: Optional[str] = Query(None),
    owner_code: Optional[str] = Query(None),
    program_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_view(context)
    q = db.query(GrantApplication)
    if program_id:
        q = q.filter(GrantApplication.program_id == program_id)
    if owner_scope:
        q = q.filter(GrantApplication.owner_scope == owner_scope)
    if owner_code:
        q = q.filter(GrantApplication.owner_code == owner_code)

    rows = q.order_by(GrantApplication.updated_at.desc()).limit(200).all()
    out: list[dict[str, Any]] = []
    for row in rows:
        if row.owner_scope == "district":
            if not (
                context.has_district_access(row.owner_code) or _can_write_program(context)
            ):
                continue
        elif row.owner_scope in ("program", "state"):
            if not (
                _can_write_program(context) or context.has_role(Roles.NATIONAL_OBSERVER)
            ):
                continue
        out.append(_serialize(row))
    return {"count": len(out), "applications": out}


@router.post("/applications")
def create_application(
    body: ApplicationCreate,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_view(context)
    program = get_program(body.program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    if body.owner_scope == "district":
        if not _can_write_district(context, body.owner_code):
            raise HTTPException(status_code=403, detail="Not authorized for district application")
        facts = build_district_facts(
            db, body.owner_code, context.active_state_code or "NY"
        )
    else:
        if not _can_write_program(context):
            raise HTTPException(status_code=403, detail="Not authorized for program application")
        facts = build_program_facts(db, context.active_state_code or "NY")

    match = evaluate_program(program, facts)
    checklist = {
        item["id"]: {
            "label": item.get("label"),
            "required": item.get("required"),
            "done": False,
        }
        for item in (program.get("readiness_checklist") or [])
        if item.get("id")
    }
    auto = None
    if body.program_id == "epa-iwiwd-2026":
        auto = epa_iwiwd_autofill(
            db,
            state_code=context.active_state_code or "NY",
            district_code=body.owner_code if body.owner_scope == "district" else "",
        )

    existing = (
        db.query(GrantApplication)
        .filter(
            GrantApplication.program_id == body.program_id,
            GrantApplication.owner_scope == body.owner_scope,
            GrantApplication.owner_code == body.owner_code,
            GrantApplication.cycle_key == body.cycle_key,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Application already exists for this cycle")

    row = GrantApplication(
        program_id=body.program_id,
        owner_scope=body.owner_scope,
        owner_code=body.owner_code,
        cycle_key=body.cycle_key,
        status=body.status,
        fit_score=match.get("fit_pct"),
        fit_reasons={"matched": match.get("matched"), "failed": match.get("failed")},
        missing_facts=match.get("missing_facts"),
        checklist=checklist,
        auto_fill=auto,
        notes=body.notes,
        due_date=body.due_date or program.get("deadline"),
        created_by=context.user_id,
        updated_by=context.user_id,
    )
    db.add(row)
    db.flush()
    _audit(
        db,
        application_id=row.id,
        actor_user_id=context.user_id,
        action="create",
        detail={"status": row.status, "program_id": row.program_id},
    )
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.get("/applications/{application_id}")
def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_view(context)
    row = db.query(GrantApplication).filter(GrantApplication.id == application_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    if row.owner_scope == "district" and not (
        context.has_district_access(row.owner_code) or _can_write_program(context)
    ):
        raise HTTPException(status_code=403, detail="Not authorized")
    if row.owner_scope in ("program", "state") and not (
        _can_write_program(context) or context.has_role(Roles.NATIONAL_OBSERVER)
    ):
        raise HTTPException(status_code=403, detail="Not authorized")
    return _serialize(row)


@router.patch("/applications/{application_id}")
def patch_application(
    application_id: str,
    body: ApplicationPatch,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    _require_view(context)
    row = db.query(GrantApplication).filter(GrantApplication.id == application_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")

    if row.owner_scope == "district":
        if not _can_write_district(context, row.owner_code):
            raise HTTPException(status_code=403, detail="Not authorized")
    elif not _can_write_program(context):
        raise HTTPException(status_code=403, detail="Not authorized")

    before = row.status
    if body.status is not None:
        row.status = body.status
    if body.notes is not None:
        row.notes = body.notes
    if body.checklist is not None:
        row.checklist = body.checklist
    if body.auto_fill is not None:
        row.auto_fill = body.auto_fill
    if body.due_date is not None:
        row.due_date = body.due_date
    row.updated_by = context.user_id
    _audit(
        db,
        application_id=row.id,
        actor_user_id=context.user_id,
        action="status_change" if body.status and body.status != before else "update",
        detail={
            "from": before,
            "to": row.status,
            "fields": body.model_dump(exclude_none=True),
        },
    )
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.post("/applications/ensure-epa-oww")
def ensure_epa_oww_application(
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    """Idempotent program-level EPA IWIWD application for OWW (Jenny fast-track)."""
    if not _can_write_program(context):
        raise HTTPException(status_code=403, detail="Not authorized")
    program = get_program("epa-iwiwd-2026")
    if not program:
        raise HTTPException(status_code=404, detail="EPA program missing from catalog")

    existing = (
        db.query(GrantApplication)
        .filter(
            GrantApplication.program_id == "epa-iwiwd-2026",
            GrantApplication.owner_scope == "program",
            GrantApplication.owner_code == "OWW",
            GrantApplication.cycle_key == "2026",
        )
        .first()
    )
    if existing:
        return _serialize(existing)

    facts = build_program_facts(db, context.active_state_code or "NY")
    match = evaluate_program(program, facts)
    checklist = {
        item["id"]: {
            "label": item.get("label"),
            "required": item.get("required"),
            "done": False,
        }
        for item in (program.get("readiness_checklist") or [])
        if item.get("id")
    }
    auto = epa_iwiwd_autofill(db, state_code=context.active_state_code or "NY")
    row = GrantApplication(
        program_id="epa-iwiwd-2026",
        owner_scope="program",
        owner_code="OWW",
        cycle_key="2026",
        status="drafting",
        fit_score=match.get("fit_pct"),
        fit_reasons={"matched": match.get("matched"), "failed": match.get("failed")},
        missing_facts=match.get("missing_facts"),
        checklist=checklist,
        auto_fill=auto,
        due_date=program.get("deadline") or "2026-10-05",
        notes="Fast-track EPA-OW-OWM-26-03 packet for OWW / Jenny",
        created_by=context.user_id,
        updated_by=context.user_id,
    )
    db.add(row)
    db.flush()
    _audit(
        db,
        application_id=row.id,
        actor_user_id=context.user_id,
        action="create",
        detail={"fast_track": True, "opportunity": "EPA-OW-OWM-26-03"},
    )
    db.commit()
    db.refresh(row)
    return _serialize(row)
