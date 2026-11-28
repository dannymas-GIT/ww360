"""Entitlement JSON cache helpers on top of PR 1A redis_client (graceful without Redis)."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings
from app.core.redis_client import redis_delete as _redis_delete
from app.core.redis_client import redis_get, redis_set

logger = logging.getLogger(__name__)


def redis_get_json(key: str) -> dict[str, Any] | None:
    raw = redis_get(key)
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def redis_set_json(key: str, value: dict[str, Any], ttl: int | None = None) -> None:
    ttl = ttl if ttl is not None else int(settings.ENTITLEMENT_REDIS_TTL_SECONDS or 300)
    try:
        redis_set(key, json.dumps(value), ttl_seconds=max(30, ttl))
    except Exception:
        return


def redis_delete(key: str) -> None:
    try:
        _redis_delete(key)
    except Exception:
        return


def entitlement_cache_key(*, org_code: str | None = None, oww_org_id: str | None = None) -> str:
    if org_code:
        return f"ww360:entitlement:org:{org_code}"
    return f"ww360:entitlement:oww:{oww_org_id or ''}"
