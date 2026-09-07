"""Illustrative GA4 + SEO fixtures for Digital reach (mirrors frontend fixtures)."""

from __future__ import annotations

import calendar
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Tuple

DigitalPropertyId = Literal["ww360", "oww-web", "learning-stream"]
DigitalRange = Literal["30d", "qtr", "12mo"]

WW360_SESSIONS = [412, 468, 521, 389, 612, 704, 798, 756, 689, 634, 578, 647]
WW360_ORGANIC = [890, 1020, 1180, 760, 1340, 1520, 1710, 1640, 1480, 1320, 1190, 1380]

OWW_SESSIONS = [2840, 3120, 3380, 2180, 3640, 3980, 4420, 4180, 3860, 3520, 3180, 3460]
OWW_ORGANIC = [4200, 4680, 5120, 3100, 5840, 6420, 7180, 6840, 6240, 5680, 5120, 5580]

LS_SESSIONS = [1620, 1840, 1980, 1240, 2140, 2380, 2640, 2520, 2280, 2060, 1880, 2040]
LS_ORGANIC = [2840, 3120, 3480, 1980, 3840, 4180, 4620, 4380, 3960, 3580, 3240, 3520]


def _expand_monthly(monthly: List[int], start_year: int = 2025, start_month: int = 8) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for i, total in enumerate(monthly):
        month = (start_month + i) % 12
        year = start_year + (start_month + i) // 12
        dim = calendar.monthrange(year, month + 1)[1]
        remaining = total
        for d in range(1, dim + 1):
            left = dim - d + 1
            v = remaining if d == dim else max(0, round(remaining / left + (d % 3) - 1))
            remaining -= v
            date = f"{year}-{month + 1:02d}-{d:02d}"
            out.append({"date": date, "value": max(0, v)})
    return out


def _slice_range(rows: List[Dict[str, Any]], range_key: DigitalRange) -> List[Dict[str, Any]]:
    if range_key == "12mo":
        return rows
    days = 30 if range_key == "30d" else 92
    return rows[-days:]


def _sum_values(rows: List[Dict[str, Any]]) -> int:
    return sum(int(r.get("value", 0)) for r in rows)


def _scale_int(value: int, factor: float) -> int:
    return round(value * factor)


def _property_bases() -> Dict[DigitalPropertyId, Dict[str, Any]]:
    return {
        "ww360": {
            "label": "Water Workforce 360",
            "sessions": WW360_SESSIONS,
            "organic": WW360_ORGANIC,
            "ga_summary": {
                "sessions": 7208,
                "users": 4891,
                "newUsers": 3124,
                "pageviews": 28440,
                "engagementRate": 0.68,
                "avgSessionDurationSec": 186,
                "conversions": 94,
                "bounceRate": 0.34,
            },
            "channels": [
                {"channel": "Direct", "sessions": 2162, "users": 1840, "conversions": 41},
                {"channel": "Organic Search", "sessions": 1874, "users": 1520, "conversions": 22},
                {"channel": "Referral", "sessions": 1296, "users": 980, "conversions": 18},
                {"channel": "Organic Social", "sessions": 864, "users": 710, "conversions": 8},
                {"channel": "Email", "sessions": 612, "users": 520, "conversions": 5},
            ],
            "insights": [
                {
                    "id": "ww360-sdwis",
                    "severity": "high",
                    "title": "SDWIS landscape drives 19% of in-app engagement",
                    "body": "1,420 sdwis_viewed events trail only the executive dashboard. Partners who land from organic queries spend 2.4× longer on /water-systems than direct visitors.",
                    "action": "Add SDWIS county deep-link to outreach emails",
                },
                {
                    "id": "ww360-access",
                    "severity": "medium",
                    "title": "Access requests convert at 0.65% — above B2G benchmark",
                    "body": "47 enrollment requests in 12 months with strongest lift from utility referral traffic.",
                    "action": "Publish utility referral UTM template",
                },
                {
                    "id": "ww360-studio",
                    "severity": "info",
                    "title": "Document Studio publish events growing MoM",
                    "body": "86 studio_published events since launch; tour completion correlates with first publish within 7 days.",
                    "action": "Highlight Studio in partner onboarding tour",
                },
            ],
        },
        "oww-web": {
            "label": "onewaterworkforce.org",
            "sessions": OWW_SESSIONS,
            "organic": OWW_ORGANIC,
            "ga_summary": {
                "sessions": 41780,
                "users": 28940,
                "newUsers": 18420,
                "pageviews": 126400,
                "engagementRate": 0.72,
                "avgSessionDurationSec": 224,
                "conversions": 741,
                "bounceRate": 0.29,
            },
            "channels": [
                {"channel": "Organic Search", "sessions": 12120, "users": 9840, "conversions": 214},
                {"channel": "Referral", "sessions": 9180, "users": 7120, "conversions": 163},
            ],
            "insights": [
                {
                    "id": "oww-mobile",
                    "severity": "high",
                    "title": "53% of career traffic is mobile — job board converts best",
                    "body": "Mobile sessions on /jobs convert at 8.7% to applications vs 4.1% on certification pages.",
                    "action": "Shorten mobile member sign-up flow",
                },
                {
                    "id": "oww-organic",
                    "severity": "medium",
                    "title": "Organic search is the #1 member acquisition channel",
                    "body": "214 of 741 members attribute to organic search in the referral mix.",
                    "action": "Add FAQ schema to /certification",
                },
                {
                    "id": "oww-grade-d",
                    "severity": "info",
                    "title": "Grade D pathway page gaining traction",
                    "body": "/pathways/grade-d added 5,620 pageviews in 12 months from non-branded CEU queries.",
                    "action": "Cross-link LS Grade D waitlist email",
                },
            ],
        },
        "learning-stream": {
            "label": "Learning Stream",
            "sessions": LS_SESSIONS,
            "organic": LS_ORGANIC,
            "ga_summary": {
                "sessions": 24640,
                "users": 16820,
                "newUsers": 9840,
                "pageviews": 68420,
                "engagementRate": 0.74,
                "avgSessionDurationSec": 198,
                "conversions": 1809,
                "bounceRate": 0.27,
            },
            "channels": [
                {"channel": "Email", "sessions": 8640, "users": 7120, "conversions": 612},
                {"channel": "Referral", "sessions": 6420, "users": 4980, "conversions": 498},
            ],
            "insights": [
                {
                    "id": "ls-grade-d-seo",
                    "severity": "high",
                    "title": "Grade D renewal query at position 8.2 with rising impressions",
                    "body": "Impressions up 24% QoQ while the Sep 24 section is 95% full with 11 waitlisted.",
                    "action": "A/B test Long Island in page title",
                },
                {
                    "id": "ls-email",
                    "severity": "medium",
                    "title": "Email drives 35% of catalog sessions but under-indexes on SEO",
                    "body": "Email channel converts at 7.1% vs 6.6% organic.",
                    "action": "Refresh catalog meta descriptions",
                },
                {
                    "id": "ls-waitlist",
                    "severity": "info",
                    "title": "186 waitlist joins — digital demand exceeds seated capacity",
                    "body": "waitlist_joined events correlate with Grade D renewal pageviews.",
                    "action": "Add second Grade D section landing page",
                },
            ],
        },
    }


def build_ga_block(base: Dict[str, Any], sessions_monthly: List[int], range_key: DigitalRange) -> Dict[str, Any]:
    session_daily = _expand_monthly(sessions_monthly)
    sliced = _slice_range(session_daily, range_key)
    total_sessions = _sum_values(sliced)
    summary_base = base["ga_summary"]
    factor = total_sessions / summary_base["sessions"] if summary_base["sessions"] else 1.0

    daily = [
        {
            "date": r["date"],
            "sessions": r["value"],
            "users": round(r["value"] * 0.72),
            "pageviews": round(r["value"] * 3.8),
        }
        for r in sliced
    ]

    summary = {
        "sessions": total_sessions,
        "users": _scale_int(summary_base["users"], factor),
        "newUsers": _scale_int(summary_base["newUsers"], factor),
        "pageviews": _scale_int(summary_base["pageviews"], factor),
        "engagementRate": summary_base["engagementRate"],
        "avgSessionDurationSec": summary_base["avgSessionDurationSec"],
        "conversions": _scale_int(summary_base["conversions"], factor),
        "bounceRate": summary_base["bounceRate"],
    }

    channels = [
        {
            "channel": c["channel"],
            "sessions": _scale_int(c["sessions"], factor),
            "users": _scale_int(c["users"], factor),
            "conversions": _scale_int(c["conversions"], factor),
        }
        for c in base.get("channels", [])
    ]

    return {
        "summary": summary,
        "daily": daily,
        "channels": channels,
        "topPages": [],
        "geo": [],
        "devices": [],
        "conversions": [],
    }


def build_seo_block(organic_monthly: List[int], range_key: DigitalRange) -> Dict[str, Any]:
    click_daily = _expand_monthly([round(v * 0.42) for v in organic_monthly])
    impression_daily = _expand_monthly(organic_monthly)
    sliced_c = _slice_range(click_daily, range_key)
    sliced_i = _slice_range(impression_daily, range_key)
    clicks = _sum_values(sliced_c)
    impressions = _sum_values(sliced_i)

    daily = [
        {
            "date": sliced_c[i]["date"],
            "clicks": sliced_c[i]["value"],
            "impressions": sliced_i[i]["value"] if i < len(sliced_i) else sliced_c[i]["value"] * 2,
        }
        for i in range(len(sliced_c))
    ]

    return {
        "summary": {
            "clicks": clicks,
            "impressions": impressions,
            "ctr": clicks / impressions if impressions else 0.0,
            "avgPosition": 12.0,
        },
        "daily": daily,
        "topQueries": [],
        "topLandings": [],
        "devices": [],
    }


def build_digital_property_report(
    property_id: DigitalPropertyId,
    range_key: DigitalRange = "12mo",
    data_mode: Literal["live", "sample"] = "sample",
    last_synced: str | None = None,
    ga_override: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    bases = _property_bases()
    base = bases[property_id]
    ga = ga_override or build_ga_block(base, base["sessions"], range_key)
    seo = build_seo_block(base["organic"], range_key)

    # Merge full fixture detail from frontend parity when sample
    from app.services.digital_analytics_fixture_detail import enrich_sample_report

    if ga_override is None:
        enrich_sample_report(property_id, ga, seo)
    elif property_id == "ww360":
        enrich_sample_report(property_id, ga, seo, skip_ga=True)

    return {
        "property": property_id,
        "label": base["label"],
        "dataMode": data_mode,
        "range": range_key,
        "lastSynced": last_synced,
        "ga": ga,
        "seo": seo,
        "insights": base.get("insights", []),
    }


def build_digital_teaser() -> Dict[str, int]:
    ww360 = build_digital_property_report("ww360", "30d")
    oww = build_digital_property_report("oww-web", "30d")
    ls = build_digital_property_report("learning-stream", "30d")
    return {
        "ww360Sessions30d": ww360["ga"]["summary"]["sessions"],
        "owwOrganicClicks30d": oww["seo"]["summary"]["clicks"],
        "lsCatalogSessions30d": ls["ga"]["summary"]["sessions"],
        "blendedSeoImpressions30d": (
            ww360["seo"]["summary"]["impressions"]
            + oww["seo"]["summary"]["impressions"]
            + ls["seo"]["summary"]["impressions"]
        ),
    }


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
