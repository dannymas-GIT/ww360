"""Insights overview aggregator — six correlations + persona briefs."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.insights.correlations import CORRELATION_BUILDERS

CORRELATION_IDS = list(CORRELATION_BUILDERS.keys())

PERSONA_BRIEFS: list[dict[str, Any]] = [
    {
        "id": "jenny",
        "label": "OWW / Section partner (Jenny)",
        "audience": "NYSAWWA / One Water Workforce executive",
        "focus": [
            "Statewide compliance vs coverage pressure",
            "Grade demand gaps for training pipeline",
            "Fundable need + DAC/EJ overlays for grant narrative",
        ],
        "default_correlations": [
            "compliance_vs_coverage",
            "grade_demand_vs_supply",
            "fundable_need_overlay",
            "renewal_cliff",
        ],
    },
    {
        "id": "regulator",
        "label": "State / EPA regulator",
        "audience": "NYSDOH / NYSDEC / EPA R2 OpCert",
        "focus": [
            "Renewal cliff heatmaps by county",
            "Source-water / size-tier violation pressure",
            "Grade demand vs certified supply",
        ],
        "default_correlations": [
            "renewal_cliff",
            "source_water_complexity",
            "grade_demand_vs_supply",
            "compliance_vs_coverage",
        ],
    },
    {
        "id": "utility",
        "label": "Utility workforce planner",
        "audience": "District superintendent / chief operator",
        "focus": [
            "Retirement horizon and vacant positions",
            "Local cert expiry cliff",
            "Compliance pressure in their counties",
        ],
        "default_correlations": [
            "retirement_horizon",
            "renewal_cliff",
            "compliance_vs_coverage",
            "source_water_complexity",
        ],
    },
]

_MODE_RANK = {"live": 3, "mixed": 2, "curated": 1}


def _aggregate_data_mode(modes: list[str]) -> str:
    if not modes:
        return "curated"
    if all(m == "live" for m in modes):
        return "live"
    if all(m == "curated" for m in modes):
        return "curated"
    return "mixed"


def list_personas() -> list[dict[str, Any]]:
    return list(PERSONA_BRIEFS)


def get_correlation(db: Session, correlation_id: str, state_code: str = "NY") -> dict[str, Any]:
    builder = CORRELATION_BUILDERS.get(correlation_id)
    if not builder:
        raise KeyError(correlation_id)
    return builder(db, state_code.upper()[:2])


def build_insights_overview(
    db: Session,
    state_code: str = "NY",
    persona: str | None = None,
) -> dict[str, Any]:
    st = (state_code or "NY").upper()[:2]
    persona_key = (persona or "jenny").strip().lower()
    brief = next((p for p in PERSONA_BRIEFS if p["id"] == persona_key), PERSONA_BRIEFS[0])

    correlations: list[dict[str, Any]] = []
    for corr_id, builder in CORRELATION_BUILDERS.items():
        result = builder(db, st)
        # Soft-filter: keep all six but mark persona_match
        result["persona_match"] = persona_key in (result.get("persona_relevance") or [])
        correlations.append(result)

    # Persona-preferred order first
    preferred = brief.get("default_correlations") or []
    order = {cid: i for i, cid in enumerate(preferred)}
    correlations.sort(
        key=lambda c: (order.get(c["id"], 99), -_MODE_RANK.get(c.get("data_mode") or "curated", 0))
    )

    modes = [c.get("data_mode") or "curated" for c in correlations]
    return {
        "state_code": st,
        "persona": brief["id"],
        "persona_brief": brief,
        "data_mode": _aggregate_data_mode(modes),
        "correlations": correlations,
        "correlation_ids": CORRELATION_IDS,
    }
