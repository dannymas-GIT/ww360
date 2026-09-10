"""KPI definitions and snapshots API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.services.national.kpi_service import create_kpi, kpis_with_latest, list_kpis, update_kpi
from app.tenant_auth import TenantContext

router = APIRouter()


class KpiCreateBody(BaseModel):
    owner_scope: str = Field(..., pattern="^(us|region|state|org|district)$")
    owner_code: str
    metric_key: str
    label: str
    target_value: float | None = None
    direction: str = "higher_better"
    warn_threshold: float | None = None
    critical_threshold: float | None = None
    cadence: str = "monthly"


class KpiPatchBody(BaseModel):
    label: str | None = None
    target_value: float | None = None
    direction: str | None = None
    warn_threshold: float | None = None
    critical_threshold: float | None = None
    cadence: str | None = None


@router.get("")
def get_kpis(
    owner_scope: str | None = None,
    owner_code: str | None = None,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    scope = owner_scope or ("us" if context.is_global_admin or context.has_role("national_observer") else "state")
    code = owner_code or (context.active_state_code if scope == "state" else "US")
    return kpis_with_latest(db, scope, code)


@router.post("")
def post_kpi(
    body: KpiCreateBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if context.is_impersonating and context.impersonation_mode == "preview":
        raise HTTPException(status_code=403, detail="IMPERSONATION_READ_ONLY")
    if not (context.is_global_admin or context.is_state_exec()):
        raise HTTPException(status_code=403, detail="Not authorized to create KPIs")
    row = create_kpi(db, data=body.model_dump(), created_by=context.actor_user_id)
    return {"id": row.id, "label": row.label}


@router.get("/brief.pdf")
def kpi_brief_pdf(
    owner_scope: str = "us",
    owner_code: str = "US",
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    from io import BytesIO

    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    from app.services.national.national_overview_service import build_national_overview

    overview = build_national_overview(db) if owner_scope == "us" else {}
    kpis = kpis_with_latest(db, owner_scope, owner_code)
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    y = 750
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, y, "Water Workforce 360 — Executive Brief")
    y -= 28
    c.setFont("Helvetica", 11)
    c.drawString(72, y, f"Scope: {owner_scope}/{owner_code}")
    y -= 20
    headline = overview.get("headline_kpis") or {}
    for key, block in headline.items():
        if y < 100:
            c.showPage()
            y = 750
        c.drawString(72, y, f"{key}: {block}")
        y -= 16
    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.drawString(72, y, "Custom KPIs")
    y -= 18
    c.setFont("Helvetica", 11)
    for k in kpis:
        if y < 72:
            c.showPage()
            y = 750
        c.drawString(
            72,
            y,
            f"{k['label']}: {k.get('current_value')} (target {k.get('target_value')})",
        )
        y -= 14
    c.save()
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=ww360-brief.pdf"},
    )


@router.patch("/{kpi_id}")
def patch_kpi(
    kpi_id: str,
    body: KpiPatchBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if context.is_impersonating and context.impersonation_mode == "preview":
        raise HTTPException(status_code=403, detail="IMPERSONATION_READ_ONLY")
    row = update_kpi(db, kpi_id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="KPI not found")
    return {"id": row.id, "label": row.label}
