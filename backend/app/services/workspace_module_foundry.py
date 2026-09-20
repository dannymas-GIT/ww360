"""
Module foundry — reusable home-screen building blocks (user-facing: "panels").

Layout v2 stores rows of blocks with columnSpan (1–3) and rowSpan (1–2).
Legacy v1 was a flat list of {module_id, visible, size: full|half}.
"""

from __future__ import annotations

import uuid
from typing import Any

# Profiles that may place each panel on their home screen.
_ALL = ["national", "regional", "state_partner", "regulator", "utility"]
_WORKFORCE = ["state_partner", "regulator", "utility"]

# kind: module | chart | metric | metric_group
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
        "kind": "module",
        "default_size": "full",
        "default_column_span": 3,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
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
        "kind": "chart",
        "default_size": "half",
        "default_column_span": 1,
        "default_row_span": 1,
        "allow_row_span": True,
        "unique": False,
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
        "kind": "module",
        "default_size": "full",
        "default_column_span": 3,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
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
        "kind": "module",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
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
        "kind": "module",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "profiles": _WORKFORCE,
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
        "kind": "module",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
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
        "kind": "module",
        "default_size": "full",
        "default_column_span": 3,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
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
        "kind": "module",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "profiles": ["national", "regional"],
        "icon": "globe",
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
        "kind": "module",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "profiles": ["national", "regional", "state_partner", "regulator"],
        "icon": "info",
    },
    {
        "module_id": "upcoming_training",
        "label": "Upcoming training",
        "short_label": "Training",
        "description": "Scheduled workforce training events from Continuity.",
        "kpi_hints": ["Useful when CEU and training pipelines are on your weekly agenda."],
        "category": "workforce",
        "kind": "module",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "profiles": _WORKFORCE,
        "icon": "calendar",
    },
    # Workforce metric groups
    {
        "module_id": "metric_group:certification_health",
        "label": "Certification Health",
        "short_label": "Cert health",
        "description": "Certification cliff at 30, 90, and 365 days.",
        "kpi_hints": ["Pair with Continuity when cert renewals are a board topic."],
        "category": "workforce",
        "kind": "metric_group",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "config_key": "groupId",
        "config_value": "certification_health",
        "profiles": _WORKFORCE,
        "icon": "shield",
    },
    {
        "module_id": "metric_group:ceu_compliance",
        "label": "CEU Compliance",
        "short_label": "CEU",
        "description": "Shortfalls, completion, and missing vouchers.",
        "kpi_hints": ["Use when renewal hours drive your utility scorecard."],
        "category": "workforce",
        "kind": "metric_group",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "config_key": "groupId",
        "config_value": "ceu_compliance",
        "profiles": _WORKFORCE,
        "icon": "clipboard",
    },
    {
        "module_id": "metric_group:coverage_succession",
        "label": "Coverage & Succession",
        "short_label": "Coverage",
        "description": "Backup coverage, retirement horizon, and vacancies.",
        "kpi_hints": ["Core for superintendent and workforce manager homes."],
        "category": "workforce",
        "kind": "metric_group",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "config_key": "groupId",
        "config_value": "coverage_succession",
        "profiles": _WORKFORCE,
        "icon": "users",
    },
    {
        "module_id": "metric_group:readiness_overview",
        "label": "Readiness Overview",
        "short_label": "Readiness",
        "description": "Composite score and key component metrics.",
        "kpi_hints": ["One glance at Continuity health for utility leadership."],
        "category": "workforce",
        "kind": "metric_group",
        "default_size": "half",
        "default_column_span": 2,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "config_key": "groupId",
        "config_value": "readiness_overview",
        "profiles": _WORKFORCE,
        "icon": "activity",
    },
    # Compact single workforce metrics
    {
        "module_id": "metric:readiness_score",
        "label": "Readiness Score",
        "short_label": "Readiness",
        "description": "Composite workforce continuity health.",
        "kpi_hints": [],
        "category": "numbers",
        "kind": "metric",
        "default_size": "half",
        "default_column_span": 1,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "config_key": "metricId",
        "config_value": "readiness_score",
        "profiles": _WORKFORCE,
        "icon": "gauge",
    },
    {
        "module_id": "metric:coverage_pct",
        "label": "Coverage %",
        "short_label": "Coverage",
        "description": "Critical functions with qualified backup.",
        "kpi_hints": [],
        "category": "numbers",
        "kind": "metric",
        "default_size": "half",
        "default_column_span": 1,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "config_key": "metricId",
        "config_value": "coverage_pct",
        "profiles": _WORKFORCE,
        "icon": "percent",
    },
    {
        "module_id": "metric:cert_cliff_90d",
        "label": "Certs Expiring (90d)",
        "short_label": "Cert 90d",
        "description": "Certifications expiring within 90 days.",
        "kpi_hints": [],
        "category": "numbers",
        "kind": "metric",
        "default_size": "half",
        "default_column_span": 1,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "config_key": "metricId",
        "config_value": "cert_cliff_90d",
        "profiles": _WORKFORCE,
        "icon": "alert",
    },
    {
        "module_id": "metric:vacant_positions",
        "label": "Vacant Positions",
        "short_label": "Vacancies",
        "description": "Active positions marked vacant.",
        "kpi_hints": [],
        "category": "numbers",
        "kind": "metric",
        "default_size": "half",
        "default_column_span": 1,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "config_key": "metricId",
        "config_value": "vacant_positions",
        "profiles": _WORKFORCE,
        "icon": "user-x",
    },
    {
        "module_id": "metric:ceu_shortfall_count",
        "label": "CEU Shortfall",
        "short_label": "CEU short",
        "description": "Operators behind on renewal hours.",
        "kpi_hints": [],
        "category": "numbers",
        "kind": "metric",
        "default_size": "half",
        "default_column_span": 1,
        "default_row_span": 1,
        "allow_row_span": False,
        "unique": True,
        "config_key": "metricId",
        "config_value": "ceu_shortfall_count",
        "profiles": _WORKFORCE,
        "icon": "clock",
    },
]


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _size_to_span(size: str | None) -> int:
    return 2 if size == "half" else 3


def modules_for_profile(profile: str) -> list[dict[str, Any]]:
    return [m for m in MODULE_FOUNDRY if profile in m["profiles"]]


def _module_by_id(module_id: str) -> dict[str, Any] | None:
    for m in MODULE_FOUNDRY:
        if m["module_id"] == module_id:
            return m
    return None


def _block_from_module(
    module: dict[str, Any],
    *,
    column_span: int | None = None,
    row_span: int | None = None,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    kind = module.get("kind") or "module"
    cfg: dict[str, Any] = dict(config or {})
    if module.get("config_key") and module.get("config_value") is not None:
        cfg.setdefault(module["config_key"], module["config_value"])
    span = column_span if column_span in (1, 2, 3) else int(module.get("default_column_span") or 1)
    rspan = row_span if row_span in (1, 2) else int(module.get("default_row_span") or 1)
    if not module.get("allow_row_span"):
        rspan = 1
    return {
        "id": _new_id("blk"),
        "type": kind,
        "module_id": module["module_id"],
        "columnSpan": span,
        "rowSpan": rspan,
        "config": cfg,
    }


def _row_with_blocks(blocks: list[dict[str, Any]]) -> dict[str, Any]:
    return {"id": _new_id("row"), "blocks": blocks}


def migrate_v1_to_v2(layout: list[Any], profile: str) -> dict[str, Any]:
    """Convert legacy flat [{module_id, visible, size}] to v2 {version, rows}."""
    allowed = {m["module_id"] for m in modules_for_profile(profile)}
    rows: list[dict[str, Any]] = []
    pending_half: dict[str, Any] | None = None

    for item in layout or []:
        if not isinstance(item, dict):
            continue
        if not bool(item.get("visible", True)):
            continue
        mid = str(item.get("module_id") or "")
        if mid not in allowed:
            continue
        mod = _module_by_id(mid)
        if not mod:
            continue
        span = _size_to_span(item.get("size") if item.get("size") in ("full", "half") else mod.get("default_size"))
        block = _block_from_module(mod, column_span=span)
        if span == 2:
            if pending_half is None:
                pending_half = block
            else:
                rows.append(_row_with_blocks([pending_half, block]))
                pending_half = None
        else:
            if pending_half is not None:
                rows.append(_row_with_blocks([pending_half]))
                pending_half = None
            rows.append(_row_with_blocks([block]))

    if pending_half is not None:
        rows.append(_row_with_blocks([pending_half]))

    if not rows:
        return default_layout_for_profile(profile)
    return {"version": 2, "rows": rows}


def _v1_defaults_to_v2(items: list[dict[str, Any]], profile: str) -> dict[str, Any]:
    return migrate_v1_to_v2(items, profile)


# Legacy-shaped seeds; converted to v2 on read.
_DEFAULT_LAYOUTS_V1: dict[str, list[dict[str, Any]]] = {
    "national": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "national_overview", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": True, "size": "full"},
        {"module_id": "document_studio", "visible": True, "size": "half"},
        {"module_id": "sources_freshness", "visible": False, "size": "half"},
    ],
    "regional": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "opcert_program", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": True, "size": "full"},
        {"module_id": "document_studio", "visible": True, "size": "half"},
    ],
    "state_partner": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "continuity", "visible": True, "size": "half"},
        {"module_id": "water_systems", "visible": True, "size": "half"},
        {"module_id": "document_studio", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": True, "size": "full"},
    ],
    "regulator": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "opcert_program", "visible": True, "size": "full"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "document_studio", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": False, "size": "full"},
    ],
    "utility": [
        {"module_id": "kpi_headline", "visible": True, "size": "full"},
        {"module_id": "continuity", "visible": True, "size": "half"},
        {"module_id": "trend_chart", "visible": True, "size": "half"},
        {"module_id": "metric_group:readiness_overview", "visible": True, "size": "half"},
        {"module_id": "document_studio", "visible": True, "size": "half"},
        {"module_id": "federal_jobs", "visible": True, "size": "full"},
    ],
}


def default_layout_for_profile(profile: str) -> dict[str, Any]:
    seed = _DEFAULT_LAYOUTS_V1.get(profile) or _DEFAULT_LAYOUTS_V1["state_partner"]
    return _v1_defaults_to_v2(seed, profile)


def _clamp_span(value: Any, allowed: tuple[int, ...], default: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return n if n in allowed else default


def _normalize_block(raw: Any, profile: str, seen_unique: set[str]) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    mid = str(raw.get("module_id") or "")
    mod = _module_by_id(mid)
    if not mod or profile not in mod["profiles"]:
        return None
    if mod.get("unique") and mid in seen_unique:
        return None
    if mod.get("unique"):
        seen_unique.add(mid)

    kind = str(raw.get("type") or mod.get("kind") or "module")
    if kind not in ("module", "chart", "metric", "metric_group"):
        kind = mod.get("kind") or "module"

    col = _clamp_span(raw.get("columnSpan"), (1, 2, 3), int(mod.get("default_column_span") or 1))
    row = _clamp_span(raw.get("rowSpan"), (1, 2), int(mod.get("default_row_span") or 1))
    if not mod.get("allow_row_span"):
        row = 1

    cfg = raw.get("config") if isinstance(raw.get("config"), dict) else {}
    cfg = dict(cfg)
    if mod.get("config_key") and mod.get("config_value") is not None:
        cfg.setdefault(mod["config_key"], mod["config_value"])

    block_id = str(raw.get("id") or "").strip() or _new_id("blk")
    return {
        "id": block_id,
        "type": kind,
        "module_id": mid,
        "columnSpan": col,
        "rowSpan": row,
        "config": cfg,
    }


def _row_capacity(blocks: list[dict[str, Any]]) -> int:
    """Capacity used — lone full-width chart counts as 1 so Add Chart stays available."""
    used = 0
    for b in blocks:
        span = int(b.get("columnSpan") or 1)
        if len(blocks) == 1 and span == 3 and b.get("type") == "chart":
            used += 1
        else:
            used += span
    return used


def validate_layout(layout: Any, profile: str) -> dict[str, Any]:
    """Accept v2 dict or legacy v1 list; always return normalized v2."""
    if isinstance(layout, list):
        return migrate_v1_to_v2(layout, profile)

    if not isinstance(layout, dict):
        return default_layout_for_profile(profile)

    raw_rows = layout.get("rows")
    if not isinstance(raw_rows, list):
        return default_layout_for_profile(profile)

    seen_unique: set[str] = set()
    rows_out: list[dict[str, Any]] = []
    for raw_row in raw_rows:
        if not isinstance(raw_row, dict):
            continue
        raw_blocks = raw_row.get("blocks")
        if not isinstance(raw_blocks, list):
            continue
        blocks: list[dict[str, Any]] = []
        for rb in raw_blocks:
            block = _normalize_block(rb, profile, seen_unique)
            if not block:
                continue
            # Enforce capacity ≤ 3 (using stored spans; charts may still auto-display wider)
            trial = blocks + [block]
            if _row_capacity(trial) > 3 and len(blocks) > 0:
                # spill to next row
                rows_out.append(
                    {
                        "id": str(raw_row.get("id") or "").strip() or _new_id("row"),
                        "blocks": blocks,
                    }
                )
                blocks = [block]
            else:
                blocks.append(block)
        if blocks:
            rows_out.append(
                {
                    "id": str(raw_row.get("id") or "").strip() or _new_id("row"),
                    "blocks": blocks,
                }
            )

    if not rows_out:
        return default_layout_for_profile(profile)
    return {"version": 2, "rows": rows_out}


# Back-compat alias used by older imports
DEFAULT_LAYOUTS = _DEFAULT_LAYOUTS_V1
