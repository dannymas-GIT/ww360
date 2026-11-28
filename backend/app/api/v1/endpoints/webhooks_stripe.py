"""Stripe webhook receiver for OWW membership entitlements."""

from __future__ import annotations

import logging

from app.core.config import settings
from app.db.database import get_db
from app.services.stripe_webhook_service import process_stripe_event
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter()


def _verify_stripe_signature(payload: bytes, sig_header: str | None) -> dict:
    secret = (settings.OWW_STRIPE_WEBHOOK_SECRET or "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook secret not configured",
        )
    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Stripe-Signature header",
        )
    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe package not installed",
        ) from exc

    tolerance = int(settings.OWW_STRIPE_WEBHOOK_TOLERANCE_SECONDS or 300)
    try:
        return stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=secret,
            tolerance=tolerance,
        )
    except stripe.error.SignatureVerificationError as exc:
        logger.warning("Stripe signature verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Stripe-Signature",
        ) from exc
    except Exception as exc:
        logger.warning("Stripe webhook construct failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed Stripe event",
        ) from exc


@router.post("/webhooks/stripe/oww")
async def stripe_oww_webhook(request: Request, db: Session = Depends(get_db)):
    """Verify Stripe-Signature over raw body; upsert entitlement cache."""
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature") or request.headers.get("stripe-signature")
    event = _verify_stripe_signature(payload, sig)
    if not isinstance(event, dict):
        # stripe SDK may return StripeObject
        event = dict(event)
    result = process_stripe_event(db, event)
    return {"received": True, **result}
