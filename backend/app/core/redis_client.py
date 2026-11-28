"""Thin Redis helper with graceful degradation when Redis is unavailable."""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Any = None
_client_failed = False


def get_redis() -> Any | None:
    """Return a sync Redis client, or None if Redis is unset/unreachable."""
    global _client, _client_failed
    url = (settings.REDIS_URL or "").strip()
    if not url or _client_failed:
        return None
    if _client is not None:
        return _client
    try:
        import redis

        client = redis.Redis.from_url(url, decode_responses=True, socket_connect_timeout=1.5)
        client.ping()
        _client = client
        return _client
    except Exception as exc:
        logger.warning("Redis unavailable (%s); falling back to Postgres-only paths", exc)
        _client_failed = True
        _client = None
        return None


def redis_get(key: str) -> str | None:
    client = get_redis()
    if client is None:
        return None
    try:
        return client.get(key)
    except Exception:
        return None


def redis_set(key: str, value: str, *, ttl_seconds: int | None = 300) -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        if ttl_seconds:
            client.setex(key, ttl_seconds, value)
        else:
            client.set(key, value)
        return True
    except Exception:
        return False


def redis_delete(key: str) -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        client.delete(key)
        return True
    except Exception:
        return False
