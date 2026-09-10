"""USAJOBS search adapter for water/wastewater operator openings (federal postings)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

USAJOBS_SEARCH_URL = "https://data.usajobs.gov/api/Search"
DEFAULT_KEYWORD = "water treatment operator"
_CACHE: dict[str, Any] = {"fetched_at": None, "payload": None}
_CACHE_TTL = timedelta(hours=1)


def _headers() -> dict[str, str] | None:
    key = (settings.USAJOBS_API_KEY or "").strip()
    agent = (settings.USAJOBS_USER_AGENT or "").strip()
    if not key or not agent:
        return None
    return {
        "Host": "data.usajobs.gov",
        "User-Agent": agent,
        "Authorization-Key": key,
    }


def _normalize_job(item: dict[str, Any]) -> dict[str, Any]:
    desc = item.get("MatchedObjectDescriptor") or {}
    locs = desc.get("PositionLocationDisplay") or desc.get("PositionLocation") or []
    if isinstance(locs, list):
        location = ", ".join(str(x) for x in locs[:2] if x)
    else:
        location = str(locs) if locs else ""
    rem = desc.get("PositionRemuneration") or []
    salary = None
    if isinstance(rem, list) and rem:
        r0 = rem[0] if isinstance(rem[0], dict) else {}
        lo = r0.get("MinimumRange")
        hi = r0.get("MaximumRange")
        interval = r0.get("RateIntervalCode") or r0.get("RateIntervalCode", {})
        if isinstance(interval, dict):
            interval = interval.get("Description") or interval.get("Code") or ""
        if lo and hi:
            salary = f"${lo}–${hi}{(' / ' + str(interval)) if interval else ''}"
    org = desc.get("OrganizationName") or desc.get("DepartmentName") or ""
    uri = desc.get("PositionURI") or desc.get("ApplyURI") or ""
    if not uri and desc.get("PositionID"):
        uri = f"https://www.usajobs.gov/job/{desc['PositionID']}"
    return {
        "id": str(item.get("MatchedObjectId") or desc.get("PositionID") or ""),
        "title": str(desc.get("PositionTitle") or "Untitled posting"),
        "organization": str(org),
        "location": location,
        "salary": salary,
        "posted": str(desc.get("PublicationStartDate") or ""),
        "url": str(uri),
        "department": str(desc.get("DepartmentName") or ""),
    }


def search_federal_operator_jobs(
    *,
    state: str | None = None,
    limit: int = 15,
) -> dict[str, Any]:
    """
    Search USAJOBS for water/wastewater-related federal openings.

    Requires USAJOBS_API_KEY and USAJOBS_USER_AGENT (email used when requesting the key).
    Returns cached results for 1 hour per query signature.
    """
    st = (state or "").upper()[:2] if state else ""
    cache_key = f"{st}:{limit}"
    now = datetime.now(timezone.utc)
    cached = _CACHE.get("payload")
    cached_at = _CACHE.get("fetched_at")
    cached_key = _CACHE.get("key")
    if (
        cached
        and cached_at
        and cached_key == cache_key
        and now - cached_at < _CACHE_TTL
    ):
        return cached

    hdrs = _headers()
    if not hdrs:
        return {
            "configured": False,
            "data_mode": "unavailable",
            "source": "usajobs",
            "source_label": "USAJOBS (federal)",
            "provenance_url": "https://developer.usajobs.gov/",
            "message": "USAJOBS API key not configured on server",
            "as_of": now.isoformat(),
            "total": 0,
            "jobs": [],
        }

    params: dict[str, str | int] = {
        "Keyword": DEFAULT_KEYWORD,
        "ResultsPerPage": min(max(limit, 1), 50),
        "Page": 1,
    }
    if st:
        params["LocationName"] = st

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(USAJOBS_SEARCH_URL, headers=hdrs, params=params)
            resp.raise_for_status()
            body = resp.json()
    except Exception as exc:
        logger.warning("USAJOBS search failed: %s", exc)
        return {
            "configured": True,
            "data_mode": "live",
            "source": "usajobs",
            "source_label": "USAJOBS (federal)",
            "provenance_url": USAJOBS_SEARCH_URL,
            "message": f"USAJOBS request failed: {exc}",
            "as_of": now.isoformat(),
            "total": 0,
            "jobs": [],
        }

    search_result = body.get("SearchResult") or {}
    items = search_result.get("SearchResultItems") or []
    total = int(search_result.get("SearchResultCountAll") or len(items))
    jobs = [_normalize_job(it) for it in items if isinstance(it, dict)][:limit]

    payload = {
        "configured": True,
        "data_mode": "live",
        "source": "usajobs",
        "source_label": "USAJOBS (federal)",
        "provenance_url": "https://www.usajobs.gov/",
        "search_keyword": DEFAULT_KEYWORD,
        "state_filter": st or None,
        "as_of": now.isoformat(),
        "total": total,
        "jobs": jobs,
    }
    _CACHE["fetched_at"] = now
    _CACHE["payload"] = payload
    _CACHE["key"] = cache_key
    return payload
