"""State content packs for national WW360 with state primacy."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from fastapi import HTTPException, status
from pydantic import BaseModel, Field

PACKS_DIR = Path(__file__).resolve().parents[1] / "jurisdictions" / "packs"


class EconomicRegion(BaseModel):
    id: str
    label: str


class ExecTourCopy(BaseModel):
    intro: str = ""
    sources: str = ""
    sdwis: str = ""


class JurisdictionPack(BaseModel):
    state_code: str = Field(..., min_length=2, max_length=2)
    partner_name: str
    section_eyebrow: str
    geography_phrase: str = ""
    landing_tagline: str = ""
    landing_headline_accent: str = ""
    exec_description: str = ""
    landscape_description: str = ""
    sdwis_default_state: str = Field(..., min_length=2, max_length=2)
    economic_regions: list[EconomicRegion] = Field(default_factory=list)
    exec_tour: ExecTourCopy = Field(default_factory=ExecTourCopy)
    analytics_geo_hints: list[str] = Field(default_factory=list)


def _normalize_state(state: str) -> str:
    return (state or "NY").strip().upper()[:2]


@lru_cache(maxsize=32)
def load_pack(state_code: str) -> JurisdictionPack:
    code = _normalize_state(state_code)
    path = PACKS_DIR / f"{code}.yaml"
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No content pack for state {code}",
        )
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    raw["state_code"] = code
    if not raw.get("sdwis_default_state"):
        raw["sdwis_default_state"] = code
    return JurisdictionPack.model_validate(raw)


def list_pack_states() -> list[str]:
    return sorted(p.stem for p in PACKS_DIR.glob("*.yaml"))


def pack_summary(state_code: str) -> dict[str, Any]:
    pack = load_pack(state_code)
    return {
        "state_code": pack.state_code,
        "partner_name": pack.partner_name,
        "section_eyebrow": pack.section_eyebrow,
        "geography_phrase": pack.geography_phrase,
        "sdwis_default_state": pack.sdwis_default_state,
        "region_count": len(pack.economic_regions),
    }
