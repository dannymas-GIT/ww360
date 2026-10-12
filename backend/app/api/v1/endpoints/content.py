"""Proxied content feeds (OWW blog, etc.)."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Query

from app.api import deps
from app.core.config import settings
from app.tenant_auth import TenantContext

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/content", tags=["content"])

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL_SECONDS = 15 * 60


def _oww_public_base() -> str:
    base = (settings.OWW_PUBLIC_BASE_URL or settings.OWW_ENTITLEMENT_BASE_URL or "").rstrip("/")
    return base


@router.get("/oww-blog")
def oww_blog_feed(
    state: str = Query(default="NY", max_length=2),
    limit: int = Query(default=5, ge=1, le=20),
    context: TenantContext = Depends(deps.get_current_tenant_user),
):
    """Proxy published OWW blog cards for dashboard widgets."""
    del context
    state_code = (state or "NY").upper()[:2]
    cache_key = f"{state_code}:{limit}"
    now = time.time()
    hit = _CACHE.get(cache_key)
    if hit and hit[0] > now:
        return hit[1]

    base = _oww_public_base()
    empty: dict[str, Any] = {
        "total": 0,
        "items": [],
        "state_code": state_code,
        "source": "oww",
        "data_mode": "empty",
        "message": None,
    }
    if not base:
        empty["message"] = "OWW public base URL is not configured"
        empty["data_mode"] = "error"
        return empty

    url = f"{base}/api/v1/public/blog/{state_code}"
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, params={"limit": limit})
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("OWW blog feed failed: %s", exc)
        empty["message"] = "Could not load One Water Workforce updates"
        empty["data_mode"] = "error"
        _CACHE[cache_key] = (now + 60, empty)  # short negative cache
        return empty

    items = data.get("items") if isinstance(data, dict) else []
    if not isinstance(items, list):
        items = []
    payload = {
        "total": int(data.get("total") or len(items)) if isinstance(data, dict) else len(items),
        "items": items[:limit],
        "state_code": state_code,
        "source": "oww",
        "data_mode": "live" if items else "empty",
        "message": None if items else "No published updates yet",
    }
    _CACHE[cache_key] = (now + _TTL_SECONDS, payload)
    return payload
