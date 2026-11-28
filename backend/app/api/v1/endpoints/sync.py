"""Inbound sync from AquaSafe outbox + auth handoff."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

from app.core.config import settings
from app.db.database import get_db
from app.models.sync import SyncInbox
from app.services.auth_service import complete_aquasafe_handoff
from app.services.sync_processor import process_inbox_event
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter()


class HandoffRedeemBody(BaseModel):
    code: str = Field(..., min_length=8)


class SyncEvent(BaseModel):
    event_id: str
    aggregate: str
    aggregate_id: str
    event_type: str
    payload: dict[str, Any]
    version: int
    occurred_at: str | None = None


class SyncBatchBody(BaseModel):
    events: list[SyncEvent]


def _normalize_signature(signature: str) -> str:
    """Accept ``sha256=<hex>`` or bare hex (legacy)."""
    raw = (signature or "").strip()
    lower = raw.lower()
    if lower.startswith("sha256="):
        return raw.split("=", 1)[1].strip()
    return raw


def verify_onewater_hmac(body: bytes, signature: str | None) -> None:
    """Verify HMAC-SHA256 over the exact raw request body bytes."""
    secret = settings.WW360_SYNC_HMAC_SECRET
    if not secret:
        raise HTTPException(status_code=503, detail="Sync HMAC not configured")
    if not signature:
        raise HTTPException(
            status_code=401,
            detail="Missing X-OneWater-Signature (or legacy X-WW360-Signature)",
        )
    provided = _normalize_signature(signature)
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, provided):
        raise HTTPException(status_code=401, detail="Invalid signature")


# Back-compat alias for tests / callers.
_verify_hmac = verify_onewater_hmac


@router.post("/auth/handoff")
async def handoff_login(body: HandoffRedeemBody, db: Session = Depends(get_db)):
    """Browser posts AquaSafe domain-handoff code; returns WW360 JWT (local user id)."""
    try:
        return await complete_aquasafe_handoff(db, body.code)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Handoff redeem failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired handoff code") from exc


@router.post("/sync/aquasafe/events")
async def ingest_sync_events(
    request: Request,
    db: Session = Depends(get_db),
    x_onewater_signature: str | None = Header(default=None, alias="X-OneWater-Signature"),
    x_ww360_signature: str | None = Header(default=None, alias="X-WW360-Signature"),
):
    """HMAC-signed batch from AquaSafe outbox relay (raw-body signature)."""
    raw = await request.body()
    signature = x_onewater_signature or x_ww360_signature
    verify_onewater_hmac(raw, signature)

    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc

    body = SyncBatchBody.model_validate(parsed)

    accepted = 0
    for ev in body.events:
        existing = db.get(SyncInbox, ev.event_id)
        if existing:
            continue
        db.add(
            SyncInbox(
                event_id=ev.event_id,
                aggregate=ev.aggregate,
                aggregate_id=ev.aggregate_id,
                event_type=ev.event_type,
                payload=ev.payload,
                version=ev.version,
            )
        )
        db.commit()
        if process_inbox_event(db, ev.event_id):
            accepted += 1
    return {"accepted": accepted, "total": len(body.events)}
