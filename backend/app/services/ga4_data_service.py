"""Optional live GA4 Data API fetch for WW360 self-analytics."""

from __future__ import annotations

import json
import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from urllib import error, request

from app.core.config import settings

logger = logging.getLogger(__name__)

GA4_DATA_BASE = "https://analyticsdata.googleapis.com/v1beta"


def _bearer_headers(access_token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def _run_report(
    access_token: str,
    property_id: str,
    start_date: str,
    end_date: str,
    metrics: List[str],
    dimensions: Optional[List[str]] = None,
    limit: int = 1000,
) -> Dict[str, Any]:
    prop = property_id if property_id.startswith("properties/") else f"properties/{property_id}"
    url = f"{GA4_DATA_BASE}/{prop}:runReport"
    body_obj: Dict[str, Any] = {
        "dateRanges": [{"startDate": start_date, "endDate": end_date}],
        "metrics": [{"name": m} for m in metrics],
        "limit": str(limit),
    }
    if dimensions:
        body_obj["dimensions"] = [{"name": d} for d in dimensions]
    body = json.dumps(body_obj).encode("utf-8")
    req = request.Request(url, data=body, method="POST")
    for k, v in _bearer_headers(access_token).items():
        req.add_header(k, v)
    with request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _range_dates(range_key: str) -> tuple[str, str]:
    end = date.today()
    if range_key == "30d":
        start = end - timedelta(days=30)
    elif range_key == "qtr":
        start = end - timedelta(days=92)
    else:
        start = end - timedelta(days=365)
    return start.isoformat(), end.isoformat()


def fetch_live_ga_block(range_key: str) -> Optional[Dict[str, Any]]:
    """Return GA block from GA4 Data API when credentials configured; else None."""
    token = (settings.GA4_ACCESS_TOKEN or "").strip()
    prop_id = (settings.GA4_PROPERTY_ID or "").strip()
    if not token or not prop_id:
        return None

    start_date, end_date = _range_dates(range_key)
    try:
        summary_data = _run_report(
            token,
            prop_id,
            start_date,
            end_date,
            metrics=[
                "sessions",
                "totalUsers",
                "newUsers",
                "screenPageViews",
                "bounceRate",
                "averageSessionDuration",
                "conversions",
                "engagementRate",
            ],
        )
    except error.HTTPError as exc:
        logger.warning("GA4 summary fetch failed: %s", exc.read()[:200])
        return None
    except Exception as exc:
        logger.warning("GA4 summary fetch error: %s", exc)
        return None

    rows = summary_data.get("rows") or []
    if not rows:
        return None

    def _metric(name: str, default: str = "0") -> float:
        headers = [h.get("name") for h in summary_data.get("metricHeaders", [])]
        if name not in headers:
            return 0.0
        idx = headers.index(name)
        val = rows[0].get("metricValues", [{}])[idx].get("value", default)
        return float(val)

    sessions = int(_metric("sessions"))
    if sessions <= 0:
        return None

    daily: List[Dict[str, Any]] = []
    try:
        daily_data = _run_report(
            token,
            prop_id,
            start_date,
            end_date,
            metrics=["sessions", "totalUsers", "screenPageViews"],
            dimensions=["date"],
            limit=366,
        )
        for row in daily_data.get("rows", []):
            dims = row.get("dimensionValues", [])
            mets = row.get("metricValues", [])
            d = dims[0].get("value", "") if dims else ""
            if len(d) == 8:
                d = f"{d[:4]}-{d[4:6]}-{d[6:8]}"
            daily.append(
                {
                    "date": d,
                    "sessions": int(mets[0].get("value", 0)) if len(mets) > 0 else 0,
                    "users": int(mets[1].get("value", 0)) if len(mets) > 1 else 0,
                    "pageviews": int(mets[2].get("value", 0)) if len(mets) > 2 else 0,
                }
            )
        daily.sort(key=lambda x: x.get("date", ""))
    except Exception as exc:
        logger.warning("GA4 daily fetch error: %s", exc)

    channels: List[Dict[str, Any]] = []
    try:
        ch_data = _run_report(
            token,
            prop_id,
            start_date,
            end_date,
            metrics=["sessions", "totalUsers", "conversions"],
            dimensions=["sessionDefaultChannelGroup"],
            limit=20,
        )
        for row in ch_data.get("rows", []):
            dims = row.get("dimensionValues", [])
            mets = row.get("metricValues", [])
            channels.append(
                {
                    "channel": dims[0].get("value", "") if dims else "",
                    "sessions": int(mets[0].get("value", 0)) if len(mets) > 0 else 0,
                    "users": int(mets[1].get("value", 0)) if len(mets) > 1 else 0,
                    "conversions": int(mets[2].get("value", 0)) if len(mets) > 2 else 0,
                }
            )
    except Exception as exc:
        logger.warning("GA4 channels fetch error: %s", exc)

    top_pages: List[Dict[str, Any]] = []
    try:
        page_data = _run_report(
            token,
            prop_id,
            start_date,
            end_date,
            metrics=["screenPageViews", "sessions", "bounceRate"],
            dimensions=["pagePath"],
            limit=20,
        )
        for row in page_data.get("rows", []):
            dims = row.get("dimensionValues", [])
            mets = row.get("metricValues", [])
            path = dims[0].get("value", "") if dims else ""
            top_pages.append(
                {
                    "pagePath": path,
                    "title": path or "(unknown)",
                    "pageviews": int(mets[0].get("value", 0)) if len(mets) > 0 else 0,
                    "sessions": int(mets[1].get("value", 0)) if len(mets) > 1 else 0,
                    "bounceRate": float(mets[2].get("value", 0)) if len(mets) > 2 else 0.0,
                }
            )
    except Exception as exc:
        logger.warning("GA4 pages fetch error: %s", exc)

    return {
        "summary": {
            "sessions": sessions,
            "users": int(_metric("totalUsers")),
            "newUsers": int(_metric("newUsers")),
            "pageviews": int(_metric("screenPageViews")),
            "engagementRate": _metric("engagementRate"),
            "avgSessionDurationSec": _metric("averageSessionDuration"),
            "conversions": int(_metric("conversions")),
            "bounceRate": _metric("bounceRate"),
        },
        "daily": daily,
        "channels": channels,
        "topPages": top_pages,
        "geo": [],
        "devices": [],
        "conversions": [],
    }
