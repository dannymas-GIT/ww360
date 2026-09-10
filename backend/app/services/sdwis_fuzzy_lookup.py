"""Fuzzy / tolerant PWS name matching against cached sdwis_state_systems."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

try:
    from rapidfuzz import fuzz
except ImportError:  # pragma: no cover
    fuzz = None  # type: ignore

_STOP = frozenset(
    {
        "the",
        "of",
        "and",
        "a",
        "an",
        "inc",
        "llc",
    }
)
_EXPAND = {
    "wd": ("water", "district"),
    "pws": ("public", "water", "system"),
    "dept": ("department",),
    "v": ("village",),
    "t": ("town",),
    "c": ("city",),
}
_TOKEN_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)


@dataclass(frozen=True)
class FuzzyHit:
    pwsid: str
    pws_name: str | None
    state_code: str | None
    population_served: int | None
    snc: str | None
    score: float
    match_reason: str


def _tokens(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text or "") if t]


def _expanded_tokens(text: str) -> list[str]:
    out: list[str] = []
    for t in _tokens(text):
        if t in _EXPAND:
            out.extend(_EXPAND[t])
        elif t not in _STOP:
            out.append(t)
    return out


def _significant_tokens(text: str) -> list[str]:
    weak = {
        "water",
        "district",
        "department",
        "public",
        "system",
        "municipal",
        "village",
        "town",
        "city",
        "county",
        "authority",
        "company",
    }
    return [t for t in _expanded_tokens(text) if t not in weak and len(t) > 1]


def _acronyms_for_name(name: str) -> set[str]:
    """Build plausible acronyms (WWD for Westbury WD / Westbury Water District)."""
    cands: set[str] = set()
    expanded = _expanded_tokens(name)
    if expanded:
        cands.add("".join(t[0] for t in expanded if t))
    # Prefer place + water-system initials: keep water/district letters when present.
    raw = _tokens(name)
    if raw:
        cands.add("".join(t[0] for t in raw if t not in _STOP))
    return {c for c in cands if len(c) >= 2}


def _score_row(query: str, name: str, pwsid: str) -> tuple[float, str]:
    q = (query or "").strip()
    if not q:
        return 0.0, ""
    q_lower = q.lower()
    name_l = (name or "").lower()
    pid_l = (pwsid or "").lower()

    if pid_l == q_lower or pid_l.endswith(q_lower):
        return 100.0, "pwsid"
    if name_l == q_lower:
        return 99.0, "exact name"

    # Case-insensitive contiguous substring (Westbury / westbury / WESTBURY)
    if q_lower in name_l:
        if name_l.startswith(q_lower):
            return 92.0, "name starts with"
        return 85.0, "name contains"

    q_words = [t for t in _expanded_tokens(q) if t]
    n_words = [t for t in _expanded_tokens(name) if t]
    if q_words and n_words:
        overlap = len(set(q_words) & set(n_words))
        if overlap:
            return 70.0 + min(20.0, overlap * 8.0), "shared words"

    # Acronym: WWD ↔ Westbury Water District / WESTBURY WD
    q_compact = re.sub(r"[^a-z0-9]", "", q_lower)
    if len(q_compact) >= 2:
        acros = _acronyms_for_name(name)
        if q_compact in acros or any(
            a.startswith(q_compact) for a in acros if len(a) >= len(q_compact)
        ):
            # Prefer compact EPA labels (WESTBURY WD) over long compound names that
            # happen to share the same initials (WARRENSBURG WATER DISTRICT).
            base = 90.0 if q_compact in acros else 76.0
            length_penalty = min(14.0, max(0.0, len(name_l) - 12) * 0.45)
            wd_bonus = 0.0
            if re.search(r"\bwd\b", name_l):
                wd_bonus = 5.0
            elif "water" in name_l and "district" in name_l:
                wd_bonus = 2.0
            place = _significant_tokens(name)
            first_ok = 0.0
            if place and place[0][:1] == q_compact[:1]:
                first_ok = 2.0
                # Prefer distinctive town names (Westbury) over stubs (West, Wells).
                nlen = len(place[0])
                if 6 <= nlen <= 14:
                    first_ok += 4.0
                elif nlen <= 4:
                    first_ok -= 4.0
            return base + wd_bonus + first_ok - length_penalty, "acronym"

    # Typo / near spelling via rapidfuzz (case-insensitive)
    if fuzz is not None and name_l:
        partial = float(fuzz.partial_ratio(q_lower, name_l))
        token_set = float(fuzz.token_set_ratio(q_lower, name_l))
        best = max(partial, token_set)
        # Avoid flooding results with weak "West *" partials for place searches.
        threshold = 78 if len(q_lower) >= 5 else 72
        if best >= threshold:
            return best * 0.9, "similar spelling"

    return 0.0, ""


def fuzzy_lookup_state_systems(
    db: Session,
    *,
    state: str,
    query: str,
    limit: int = 40,
    min_score: float = 55.0,
) -> list[FuzzyHit]:
    """
    Rank cached landscape rows for a state.

    Matching is always case-insensitive. Supports substrings, shared tokens,
    acronyms (WWD), and near-spellings via rapidfuzz when available.
    """
    from app.models.sdwis_state_system import SDWISStateSystem

    state_u = state.upper()[:2]
    q = (query or "").strip()
    if len(q) < 2:
        return []

    # Narrow candidates with cheap ILIKE when possible; always include acronym path.
    like = f"%{q}%"
    candidates: list[SDWISStateSystem] = (
        db.query(SDWISStateSystem)
        .filter(SDWISStateSystem.state_code == state_u)
        .filter(
            (SDWISStateSystem.pws_name.ilike(like))
            | (SDWISStateSystem.pwsid.ilike(like))
        )
        .limit(500)
        .all()
    )

    # For short / acronym queries, also scan a broader set scored in Python.
    # NY has ~27k rows — scoring all is fine for a few hundred ms.
    need_broad = len(q) <= 6 or len(_significant_tokens(q)) <= 1
    if need_broad or len(candidates) < 5:
        # Load only columns we score — NY landscape is ~27k rows.
        broad = (
            db.query(SDWISStateSystem)
            .filter(SDWISStateSystem.state_code == state_u)
            .with_entities(
                SDWISStateSystem.pwsid,
                SDWISStateSystem.pws_name,
                SDWISStateSystem.state_code,
                SDWISStateSystem.population_served,
                SDWISStateSystem.snc,
            )
            .all()
        )
        by_id = {r.pwsid: r for r in candidates}
        for r in broad:
            if r.pwsid not in by_id:
                by_id[r.pwsid] = r
        candidates = list(by_id.values())

    hits: list[FuzzyHit] = []
    for row in candidates:
        score, reason = _score_row(q, row.pws_name or "", row.pwsid or "")
        if score < min_score:
            continue
        hits.append(
            FuzzyHit(
                pwsid=row.pwsid,
                pws_name=row.pws_name,
                state_code=row.state_code,
                population_served=row.population_served,
                snc=row.snc,
                score=score,
                match_reason=reason,
            )
        )

    # Larger systems first when scores tie (short acronyms are ambiguous).
    hits.sort(
        key=lambda h: (
            -h.score,
            -(h.population_served or 0),
            (h.pws_name or "").lower(),
            h.pwsid,
        )
    )
    # Keep acronym lists usable — show best matches, not every W* WD in the state.
    if len(q) <= 4 and q.isalpha():
        return hits[:25]
    return hits[:limit]


def merge_lookup_rows(
    primary: Iterable[dict],
    fuzzy: Iterable[FuzzyHit],
    *,
    limit: int = 50,
) -> list[dict]:
    """Merge EPA live rows with fuzzy local hits; prefer higher local score order."""
    by_id: dict[str, dict] = {}
    order: list[str] = []

    for hit in fuzzy:
        pid = (hit.pwsid or "").upper()
        if not pid or pid in by_id:
            continue
        by_id[pid] = {
            "pwsid": pid,
            "pws_name": hit.pws_name,
            "state_code": hit.state_code,
            "population_served": str(hit.population_served)
            if hit.population_served is not None
            else None,
            "snc": hit.snc,
            "match_score": hit.score,
            "match_reason": hit.match_reason,
        }
        order.append(pid)

    for row in primary:
        pid = str(row.get("pwsid") or "").upper()
        if not pid:
            continue
        if pid in by_id:
            # Keep fuzzy metadata; refresh name from EPA if present.
            if row.get("pws_name"):
                by_id[pid]["pws_name"] = row["pws_name"]
            continue
        by_id[pid] = {
            "pwsid": pid,
            "pws_name": row.get("pws_name"),
            "state_code": row.get("state_code"),
            "population_served": row.get("population_served"),
            "snc": row.get("snc"),
            "match_score": 80.0,
            "match_reason": "epa live",
        }
        order.append(pid)

    def _pop(row: dict) -> int:
        raw = row.get("population_served")
        try:
            return int(float(raw)) if raw is not None and str(raw).strip() != "" else 0
        except (TypeError, ValueError):
            return 0

    ranked = sorted(
        by_id.values(),
        key=lambda r: (
            -float(r.get("match_score") or 0),
            -_pop(r),
            (r.get("pws_name") or "").lower(),
            r.get("pwsid") or "",
        ),
    )
    return ranked[:limit]
