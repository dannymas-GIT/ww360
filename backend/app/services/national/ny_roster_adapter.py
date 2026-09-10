"""NYSDOH certified operator roster — aggregate only, no names stored."""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.models.national_metrics import StateOperatorCertAggregate

logger = logging.getLogger(__name__)

NY_ROSTER_URL = (
    "https://www.health.ny.gov/environmental/water/drinking/operate/"
    "certified_operators/statewide_certified_operators.htm"
)

GRADE_PATTERN = re.compile(
    r"(IA|IIA|IB|IIB|C|D)[-\s]?(?:SW/GUI|GW|Plant|Distribution)?",
    re.I,
)


def _parse_expiration_month(text: str) -> str | None:
    text = (text or "").strip()
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if not m:
        return None
    month, _, year = m.groups()
    return f"{year}-{int(month):02d}"


def _parse_grades(level_desc: str) -> list[str]:
    grades: list[str] = []
    for part in re.split(r"(?<=[A-Z])(?=[A-Z])|,", level_desc or ""):
        for m in GRADE_PATTERN.finditer(part):
            g = m.group(1).upper()
            if g not in grades:
                grades.append(g)
    if not grades and level_desc:
        if "Distribution" in level_desc:
            grades.append("D")
        elif "Plant" in level_desc:
            grades.append("C")
    return grades or ["UNKNOWN"]


def refresh_ny_roster(db: Session) -> int:
    try:
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            resp = client.get(NY_ROSTER_URL)
            resp.raise_for_status()
            html = resp.text
    except Exception as exc:
        logger.warning("NY roster fetch failed: %s", exc)
        return 0

    # Parse HTML table rows: | County | Name | Cert | Expiration | Level |
    rows = re.findall(
        r"\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|",
        html,
    )
    counts: dict[tuple[str, str, str | None], int] = defaultdict(int)
    for county, _name, _cert, exp, level in rows:
        county = county.strip()
        if county.lower() in ("county", "---") or not county:
            continue
        exp_month = _parse_expiration_month(exp.strip())
        for grade in _parse_grades(level.strip()):
            counts[(county, grade, exp_month)] += 1

    db.query(StateOperatorCertAggregate).filter(
        StateOperatorCertAggregate.state_code == "NY"
    ).delete(synchronize_session=False)

    now = datetime.now(timezone.utc)
    total = 0
    for (county, grade, exp_month), n in counts.items():
        db.add(
            StateOperatorCertAggregate(
                state_code="NY",
                county=county,
                grade_code=grade,
                expiration_month=exp_month,
                operator_count=n,
                fetched_at=now,
            )
        )
        total += 1
    db.commit()
    logger.info("NY roster aggregate: %d buckets, ~%d operators", total, sum(counts.values()))
    return total
