"""Detailed sample rows for Digital reach fixtures (pages, queries, geo)."""

from __future__ import annotations

from typing import Any, Dict, Literal

DigitalPropertyId = Literal["ww360", "oww-web", "learning-stream"]


def enrich_sample_report(
    property_id: DigitalPropertyId,
    ga: Dict[str, Any],
    seo: Dict[str, Any],
    *,
    skip_ga: bool = False,
) -> None:
    """Mutate ga/seo dicts with rich illustrative detail rows."""
    factor = ga["summary"]["sessions"] / _base_sessions(property_id)
    detail = _DETAIL.get(property_id)
    if not detail:
        return

    if not skip_ga:
        ga["topPages"] = [
            {
                **p,
                "pageviews": round(p["pageviews"] * factor),
                "sessions": round(p["sessions"] * factor),
            }
            for p in detail["topPages"]
        ]
        ga["geo"] = [
            {**g, "sessions": round(g["sessions"] * factor), "users": round(g["users"] * factor)}
            for g in detail["geo"]
        ]
        ga["devices"] = detail["devices"]
        ga["conversions"] = [
            {**c, "count": round(c["count"] * factor)} for c in detail["conversions"]
        ]

    seo["topQueries"] = [
        {
            **q,
            "clicks": round(q["clicks"] * factor),
            "impressions": round(q["impressions"] * factor),
        }
        for q in detail["topQueries"]
    ]
    seo["topLandings"] = [
        {
            **l,
            "clicks": round(l["clicks"] * factor),
            "impressions": round(l["impressions"] * factor),
        }
        for l in detail["topLandings"]
    ]
    seo["devices"] = [
        {
            **d,
            "clicks": round(d["clicks"] * factor),
            "impressions": round(d["impressions"] * factor),
        }
        for d in detail["seoDevices"]
    ]
    if detail.get("avgPosition"):
        seo["summary"]["avgPosition"] = detail["avgPosition"]


def _base_sessions(property_id: DigitalPropertyId) -> int:
    return {"ww360": 7208, "oww-web": 41780, "learning-stream": 24640}[property_id]


_DETAIL: Dict[DigitalPropertyId, Dict[str, Any]] = {
    "ww360": {
        "avgPosition": 14.6,
        "topPages": [
            {"pagePath": "/", "title": "Landing — Workforce 360", "pageviews": 8420, "sessions": 6120, "bounceRate": 0.28},
            {"pagePath": "/dashboard", "title": "Executive overview", "pageviews": 4680, "sessions": 2140, "bounceRate": 0.12},
            {"pagePath": "/continuity", "title": "Continuity workspace", "pageviews": 3920, "sessions": 1680, "bounceRate": 0.15},
            {"pagePath": "/water-systems", "title": "SDWIS landscape", "pageviews": 3540, "sessions": 1420, "bounceRate": 0.18},
            {"pagePath": "/studio", "title": "Document Studio", "pageviews": 2180, "sessions": 890, "bounceRate": 0.22},
        ],
        "geo": [
            {"region": "New York", "sessions": 4980, "users": 3410},
            {"region": "New Jersey", "sessions": 412, "users": 298},
        ],
        "devices": [
            {"device": "Desktop", "sessions": 4680, "share": 0.649},
            {"device": "Mobile", "sessions": 1980, "share": 0.275},
            {"device": "Tablet", "sessions": 548, "share": 0.076},
        ],
        "conversions": [
            {"event": "access_request_submitted", "count": 47, "rate": 0.0065},
            {"event": "tour_completed", "count": 312, "rate": 0.043},
            {"event": "sdwis_viewed", "count": 1420, "rate": 0.197},
        ],
        "topQueries": [
            {"query": "water workforce 360", "clicks": 186, "impressions": 4200, "ctr": 0.044, "position": 4.2, "branded": True},
            {"query": "NY water utility succession planning", "clicks": 142, "impressions": 6100, "ctr": 0.023, "position": 8.8, "branded": False},
        ],
        "topLandings": [
            {"page": "https://ww360.aquasafe-solutions.us/", "title": "Workforce 360 home", "clicks": 920, "impressions": 18400, "ctr": 0.05, "position": 8.4},
        ],
        "seoDevices": [
            {"device": "Desktop", "clicks": 1210, "impressions": 28400},
            {"device": "Mobile", "clicks": 498, "impressions": 16200},
        ],
    },
    "oww-web": {
        "avgPosition": 12.8,
        "topPages": [
            {"pagePath": "/careers/operator", "title": "Become a water operator", "pageviews": 28480, "sessions": 19240, "bounceRate": 0.24},
            {"pagePath": "/certification", "title": "NYS certification explained", "pageviews": 22140, "sessions": 16820, "bounceRate": 0.31},
            {"pagePath": "/jobs", "title": "Job board", "pageviews": 19860, "sessions": 14280, "bounceRate": 0.22},
        ],
        "geo": [{"region": "New York", "sessions": 31240, "users": 21840}],
        "devices": [
            {"device": "Mobile", "sessions": 22180, "share": 0.531},
            {"device": "Desktop", "sessions": 16280, "share": 0.39},
        ],
        "conversions": [
            {"event": "member_profile_created", "count": 741, "rate": 0.0177},
            {"event": "job_application_submitted", "count": 528, "rate": 0.0126},
        ],
        "topQueries": [
            {"query": "become a water operator NY", "clicks": 420, "impressions": 18400, "ctr": 0.023, "position": 7.4, "branded": False},
            {"query": "one water workforce", "clicks": 284, "impressions": 3200, "ctr": 0.089, "position": 2.1, "branded": True},
        ],
        "topLandings": [
            {"page": "https://onewaterworkforce.org/careers/operator", "title": "Become a water operator", "clicks": 1840, "impressions": 68400, "ctr": 0.027, "position": 8.2},
        ],
        "seoDevices": [
            {"device": "Mobile", "clicks": 3980, "impressions": 168400},
            {"device": "Desktop", "clicks": 2420, "impressions": 98400},
        ],
    },
    "learning-stream": {
        "avgPosition": 11.2,
        "topPages": [
            {"pagePath": "/courses/grade-d-renewal", "title": "Grade D Renewal — Sep 24", "pageviews": 12480, "sessions": 9840, "bounceRate": 0.18},
            {"pagePath": "/catalog", "title": "Course catalog", "pageviews": 7840, "sessions": 6120, "bounceRate": 0.24},
        ],
        "geo": [{"region": "New York", "sessions": 19840, "users": 13620}],
        "devices": [
            {"device": "Desktop", "sessions": 14280, "share": 0.58},
            {"device": "Mobile", "sessions": 8640, "share": 0.35},
        ],
        "conversions": [
            {"event": "course_registration_completed", "count": 1809, "rate": 0.073},
            {"event": "waitlist_joined", "count": 186, "rate": 0.0075},
        ],
        "topQueries": [
            {"query": "Grade D renewal course", "clicks": 284, "impressions": 9800, "ctr": 0.029, "position": 8.2, "branded": False},
            {"query": "NYS water operator CEU", "clicks": 312, "impressions": 12400, "ctr": 0.025, "position": 8.4, "branded": False},
        ],
        "topLandings": [
            {"page": "https://learningstream.com/courses/grade-d-renewal", "title": "Grade D Renewal", "clicks": 840, "impressions": 28400, "ctr": 0.03, "position": 8.2},
        ],
        "seoDevices": [
            {"device": "Desktop", "clicks": 2680, "impressions": 98400},
            {"device": "Mobile", "clicks": 1280, "impressions": 58400},
        ],
    },
}
