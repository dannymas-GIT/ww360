"""Inbound sync from AquaSafe outbox + auth handoff."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.sync import SyncInbox
from app.services.auth_service import mint_ww360_token, redeem_aquasafe_handoff
from app.services.sync_processor import process_inbox_event

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


class SyncBatchBody(BaseModel):
    events: list[SyncEvent]


def _verify_hmac(body: bytes, signature: str | None) -> None:
    secret = settings.WW360_SYNC_HMAC_SECRET
    if not secret:
        raise HTTPException(status_code=503, detail="Sync HMAC not configured")
    if not signature:
        raise HTTPException(status_code=401, detail="Missing X-WW360-Signature")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")


@router.post("/auth/handoff")
async def handoff_login(body: HandoffRedeemBody):
    """Browser posts AquaSafe domain-handoff code; returns WW360 JWT."""
    try:
        user = await redeem_aquasafe_handoff(body.code)
    except Exception as exc:
        logger.warning("Handoff redeem failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired handoff code") from exc
    token = mint_ww360_token(user)
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/sync/aquasafe/events")
async def ingest_sync_events(
    body: SyncBatchBody,
    db: Session = Depends(get_db),
    x_ww360_signature: str | None = Header(default=None, alias="X-WW360-Signature"),
):
    """HMAC-signed batch from AquaSafe outbox relay."""
    raw = json.dumps(body.model_dump(), sort_keys=True).encode()
    _verify_hmac(raw, x_ww360_signature)

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
