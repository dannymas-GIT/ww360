"""Workforce alert scanner — WW360 stub (no AquaSafe alerts table)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from sqlalchemy.orm import Session


@dataclass
class ScanResult:
    district_code: str
    created: int = 0
    skipped_duplicate: int = 0
    summary: List[Dict] = field(default_factory=list)


def scan_district(db: Session, district_code: str) -> ScanResult:
    return ScanResult(district_code=district_code)


def scan_all_districts(db: Session) -> List[ScanResult]:
    return []
