"""
Module foundry — reusable home-screen building blocks (user-facing: "panels").

Avoid calling these "widgets" in UI copy. Code uses module_id for stability.
"""

from __future__ import annotations

from typing import Any

# Profiles that may place each panel on their home screen.
_ALL = ["national", "regional", "state_partner", "regulator", "utility"]

MODULE_FOUNDRY: list[dict[str, Any]] = [
    {
        "module_id": "kpi_headline",
        "label": "Headline numbers",
        "short_label": "Headlines",
        "description": "Your top 3–4 measures — openings, compliance pressure, renewals, or succession readiness.",
        "kpi_hints": [
            "What number would you show a board or partner first?",
            "Pick measures you already track or can explain in one sentence.",
        ],
        "category": "numbers",
        "default_size": "full",
        "profiles": _ALL,
        "icon": "bar-chart",
    },
    {
        "module_id": "trend_chart",
        "label": "Trend & comparison chart",
        "short_label": "Charts",
        "description": "Bar or trend views for regional gaps, pipeline stages, OpCert grades, or state comparison.",
        "kpi_hints": [
            "Which KPIs need a picture, not just a number?",
            "Comparisons (by region, grade, or state) fit well here.",
        ],
        "category": "charts",
        "default_size": "half",
        "profiles": _ALL,
        "icon": "line-chart",
    },
    {
        "module_id": "federal_jobs",
        "label": "Federal job openings",
        "short_label": "Federal jobs",
        "description": "Live USAJOBS postings for water and wastewater operator roles.",
        "kpi_hints": [
            "Use when your story includes career pathways or placement.",
            "Pairs with projected openings (BLS) — demand vs open roles today.",
        ],
        "category": "careers",
        "default_size": "full",
        "profiles": _ALL,
        "icon": "briefcase",
    },
    {
        "module_id": "water_systems",
        "label": "Water systems landscape",
        "short_label": "Water systems",
        "description": "SDWIS community water systems, compliance flags, and member links.",
        "kpi_hints": [
            "Match to compliance pressure and systems-per-operator KPIs.",
            "Best for state partners, regulators, and national views.",
        ],
        "category": "compliance",
        "default_size": "half",
        "profiles": ["national", "regional", "state_partner", "regulator"],
        "icon": "droplets",
    },
    {
        "module_id": "continuity",
        "label": "Workforce continuity",
        "short_label": "Continuity",
        "description": "Succession, vacancies, and CEU renewal pressure for utilities and programs.",
        "kpi_hints": [
            "Match to retirement cliff, succession readiness, CEU current %.",
            "Core for utility and section partner homes.",
        ],
        "category": "workforce",
        "default_size": "half",
        "profiles": ["state_partner", "regulator", "utility"],
        "icon": "workflow",
    },
    {
        "module_id": "document_studio",
        "label": "Document Studio",
        "short_label": "Documents",
        "description": "Author and publish program reports, OpCert packs, and utility procedures.",
        "kpi_hints": [
            "Use when reporting or grant packages are part of your role.",
            "Available to every role — keep it on your home if you publish often.",
        ],
        "category": "content",
        "default_size": "half",
        "profiles": _ALL,
        "icon": "pen",
    },
    {
        "module_id": "opcert_program",
        "label": "Operator certification program",
        "short_label": "OpCert",
        "description": "Coverage, renewal cliff, and Nine Baseline Standards entry for regulators.",
        "kpi_hints": [
            "Match to active certifications and renewals in the next 90 days.",
            "Primary panel for state DOH / OpCert managers.",
        ],
        "category": "compliance",
        "default_size": "full",
        "profiles": ["regulator", "regional"],
        "icon": "shield",
    },
    {
        "module_id": "national_overview",
        "label": "US / national overview",
        "short_label": "National",
        "description": "United States headline KPIs and state scorecard entry.",
        "kpi_hints": [
            "Match to national workforce gap, SNC pressure, DWSRF pipeline.",
            "Default for EPA, ASDWA, and AWWA national observers.",
        ],
        "category": "national",
        "default_size": "half",
        "profiles": ["national", "regional"],
        "icon": "globe",
    },
    {
        "module_id": "quick_actions",
        "label": "Quick actions",
        "short_label": "Actions",
        "description": "Buttons into Document Studio, Continuity, and US overview — your next steps.",
        "kpi_hints": [
            "Keep this if you jump between tools often.",
            "Does not display KPIs itself — it routes to the tools that do.",
        ],
        "category": "navigation",
        "default_size": "full",
        "profiles": _ALL,
        "icon": "zap",
    },
    {
        "module_id": "sources_freshness",
        "label": "Data sources & freshness",
        "short_label": "Sources",
        "description": "Which feeds are live vs illustrative, and when they last refreshed.",
        "kpi_hints": [
            "Add when presenting to partners who will ask “is this live?”",
            "Pairs with every KPI panel — trust and provenance.",
        ],
        "category": "trust",
        "default_size": "half",
        "profiles": ["national", "regional", "state_partner", "regulator"],
        "icon": "info",
    },
]


DEFAULT_LAYOUTS: dict[str, list[dict[str, Any]]] = {
    "national": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "national_overview", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": True, "size": "full"},
        {"module_id": "document_studio", "visible": True, "size": "half"},
        {"module_id": "quick_actions", "visible": True, "size": "full"},
        {"module_id": "sources_freshness", "visible": False, "size": "half"},
    ],
    "regional": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "opcert_program", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": True, "size": "full"},
        {"module_id": "quick_actions", "visible": True, "size": "full"},
    ],
    "state_partner": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "continuity", "visible": True, "size": "half"},
        {"module_id": "water_systems", "visible": True, "size": "half"},
        {"module_id": "document_studio", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": True, "size": "full"},
        {"module_id": "quick_actions", "visible": True, "size": "full"},
    ],
    "regulator": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "opcert_program", "visible": True, "size": "full"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "document_studio", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": False, "size": "full"},
        {"module_id": "quick_actions", "visible": True, "size": "full"},
    ],
    "utility": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "continuity", "visible": True, "size": "half"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "document_studio", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": True, "size": "full"},
        {"module_id": "quick_actions", "visible": True, "size": "full"},
    ],
}


def modules_for_profile(profile: str) -> list[dict[str, Any]]:
    return [m for m in MODULE_FOUNDRY if profile in m["profiles"]]


def default_layout_for_profile(profile: str) -> list[dict[str, Any]]:
    return list(DEFAULT_LAYOUTS.get(profile) or DEFAULT_LAYOUTS["state_partner"])


def validate_layout(layout: list[Any], profile: str) -> list[dict[str, Any]]:
    allowed = {m["module_id"] for m in modules_for_profile(profile)}
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in layout or []:
        if not isinstance(item, dict):
            continue
        mid = str(item.get("module_id") or "")
        if mid not in allowed or mid in seen:
            continue
        seen.add(mid)
        size = item.get("size") if item.get("size") in ("full", "half") else "full"
        out.append(
            {
                "module_id": mid,
                "visible": bool(item.get("visible", True)),
                "size": size,
            }
        )
    # Append any profile modules missing from saved layout (defaults hidden if not in default)
    defaults = {d["module_id"]: d for d in default_layout_for_profile(profile)}
    for m in modules_for_profile(profile):
        mid = m["module_id"]
        if mid not in seen:
            d = defaults.get(mid)
            out.append(
                {
                    "module_id": mid,
                    "visible": bool(d["visible"]) if d else False,
                    "size": (d or {}).get("size") or m.get("default_size") or "full",
                }
            )
    return out
