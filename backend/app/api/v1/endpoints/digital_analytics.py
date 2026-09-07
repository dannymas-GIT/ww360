"""Digital reach analytics API — GA4 + SEO (fixtures + optional live WW360 GA4)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api import deps
from app.schemas.digital_analytics import DigitalPropertyReportOut, DigitalTeaserOut
from app.services.digital_analytics_fixtures import (
    build_digital_property_report,
    build_digital_teaser,
    utc_now_iso,
)
from app.services.ga4_data_service import fetch_live_ga_block
from app.tenant_auth import PARTNER_ROLES, Roles, TenantContext

router = APIRouter()

DigitalPropertyId = Literal["ww360", "oww-web", "learning-stream"]
DigitalRange = Literal["30d", "qtr", "12mo"]

PARTNER_ACCESS_ROLES = PARTNER_ROLES + [Roles.PLATFORM_ADMIN, Roles.CEU_ADMIN]


@router.get("/digital", response_model=DigitalPropertyReportOut)
def digital_property_report(
    property: DigitalPropertyId = Query("ww360", alias="property"),
    range: DigitalRange = Query("12mo", alias="range"),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if not (
        context.is_global_admin or context.has_any_role(PARTNER_ACCESS_ROLES)
    ):
        raise HTTPException(status_code=403, detail="Partner or admin access required")

    data_mode: Literal["live", "sample"] = "sample"
    last_synced = None
    ga_override = None

    if property == "ww360":
        live_ga = fetch_live_ga_block(range)
        if live_ga and live_ga.get("daily"):
            ga_override = live_ga
            data_mode = "live"
            last_synced = utc_now_iso()

    report = build_digital_property_report(
        property,
        range,
        data_mode=data_mode,
        last_synced=last_synced,
        ga_override=ga_override,
    )
    return report


@router.get("/digital/teaser", response_model=DigitalTeaserOut)
def digital_teaser(
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    if not (
        context.is_global_admin or context.has_any_role(PARTNER_ACCESS_ROLES)
    ):
        raise HTTPException(status_code=403, detail="Partner or admin access required")
    return build_digital_teaser()
