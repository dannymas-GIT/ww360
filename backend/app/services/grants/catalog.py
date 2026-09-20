"""Load and validate the grants catalog YAML."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

CATALOG_PATH = Path(__file__).resolve().parents[2] / "national" / "grants_catalog.yaml"


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    data = yaml.safe_load(CATALOG_PATH.read_text(encoding="utf-8")) or {}
    programs = data.get("programs") or []
    if not isinstance(programs, list) or not programs:
        raise ValueError("grants_catalog.yaml has no programs")
    for p in programs:
        if not p.get("id") or not p.get("name"):
            raise ValueError(f"Invalid program entry: {p!r}")
    return data


def list_programs(
    *,
    water_focus: str | None = None,
    status: str | None = None,
    level: str | None = None,
) -> list[dict[str, Any]]:
    programs = list(load_catalog().get("programs") or [])
    if water_focus:
        wf = water_focus.lower()
        programs = [
            p
            for p in programs
            if p.get("water_focus") in (wf, "both") or wf == "both"
        ]
    if status:
        programs = [p for p in programs if (p.get("status") or "").lower() == status.lower()]
    if level:
        programs = [p for p in programs if (p.get("level") or "").lower() == level.lower()]
    return programs


def get_program(program_id: str) -> dict[str, Any] | None:
    pid = (program_id or "").strip().lower()
    for p in load_catalog().get("programs") or []:
        if str(p.get("id", "")).lower() == pid:
            return p
    return None


def catalog_meta() -> dict[str, Any]:
    data = load_catalog()
    return {
        "version": data.get("version"),
        "updated": data.get("updated"),
        "program_count": len(data.get("programs") or []),
        "path": str(CATALOG_PATH),
    }
