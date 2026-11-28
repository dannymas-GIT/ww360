"""Platform admin district merge (canonical PWSID / NPDES conflict resolution)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from app.api import deps
from app.db.database import get_db
from app.models.water_district import WaterDistrict
from app.tenant_auth import TenantContext
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()


class DistrictMergeBody(BaseModel):
    source_district_code: str = Field(..., min_length=1, max_length=50)
    target_district_code: str = Field(..., min_length=1, max_length=50)
    reason: str = Field(..., min_length=3, max_length=2000)
    prefer_identifiers_from: str = Field(
        default="target",
        description="Which district's pwsid/npdes/spdes/aquasafe_district_id wins on conflict",
    )


class DistrictMergeOut(BaseModel):
    ok: bool = True
    target_district_code: str
    source_district_code: str
    merged_at: str
    message: str


@router.post("/admin/districts/merge", response_model=DistrictMergeOut)
def merge_districts(
    body: DistrictMergeBody,
    db: Session = Depends(get_db),
    context: TenantContext = Depends(deps.require_global_admin()),
):
    """Audited merge of a conflicting source district into a canonical target.

    Moves canonical identifiers onto the target, deactivates the source, and
    does not silently overwrite an unrelated OWW/AquaSafe tenant without an
    explicit platform_admin action.
    """
    source_code = body.source_district_code.strip()
    target_code = body.target_district_code.strip()
    if source_code == target_code:
        raise HTTPException(status_code=400, detail="source and target must differ")

    source = (
        db.query(WaterDistrict).filter(WaterDistrict.district_code == source_code).one_or_none()
    )
    target = (
        db.query(WaterDistrict).filter(WaterDistrict.district_code == target_code).one_or_none()
    )
    if source is None or target is None:
        raise HTTPException(status_code=404, detail="Source or target district not found")

    prefer_source = body.prefer_identifiers_from.strip().lower() == "source"

    def _take(attr: str) -> None:
        src_val = getattr(source, attr)
        tgt_val = getattr(target, attr)
        if prefer_source and src_val:
            setattr(target, attr, src_val)
            setattr(source, attr, None)
        elif not tgt_val and src_val:
            setattr(target, attr, src_val)
            setattr(source, attr, None)
        elif prefer_source is False and src_val:
            # Keep target; clear source to free unique indexes.
            setattr(source, attr, None)

    for col in ("aquasafe_district_id", "pwsid", "npdes_id", "spdes_id"):
        _take(col)

    if prefer_source and source.state_code:
        target.state_code = source.state_code
    elif not target.state_code and source.state_code:
        target.state_code = source.state_code

    source.is_active = False
    db.commit()

    merged_at = datetime.now(UTC).isoformat()
    logger.info(
        "platform_admin district merge source=%s target=%s by_user_id=%s by_username=%s reason=%s",
        source_code,
        target_code,
        context.user_id,
        context.username,
        body.reason[:500],
    )
    return DistrictMergeOut(
        target_district_code=target_code,
        source_district_code=source_code,
        merged_at=merged_at,
        message="Districts merged; source deactivated",
    )
