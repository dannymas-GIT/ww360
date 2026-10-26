"""In-process login rate limit (best-effort across multi-worker)."""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

_RATE: dict[str, list[float]] = defaultdict(list)
_WINDOW_S = 300
_MAX = 20  # attempts per IP per window


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for") or ""
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def enforce_login_rate_limit(request: Request) -> None:
    ip = client_ip(request)
    now = time.time()
    bucket = [t for t in _RATE[ip] if now - t < _WINDOW_S]
    _RATE[ip] = bucket
    if len(bucket) >= _MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
        )
    bucket.append(now)
