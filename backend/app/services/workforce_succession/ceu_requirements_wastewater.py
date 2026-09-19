"""NYS DEC wastewater operator RTC/CEU requirements reference taxonomy.

Placeholder values aligned with 6 NYCRR Part 650 renewal training expectations.
Verify against current DEC guidance before production compliance use.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Dict, List, Optional

RENEWAL_CYCLE_YEARS_WW = 5

# Cybersecurity training requirement for renewals expiring on or after 2027-01-01
# (6 NYCRR Part 650 — DEC cyber-awareness RTC add-on; placeholder hours).
CYBER_CEU_EFFECTIVE_DATE = date(2027, 1, 1)
CYBER_CONTACT_HOURS = 10.0  # 1.0 CEU equivalent

# Contact hours (RTC) required over the 5-year renewal cycle by grade.
# Citations: 6 NYCRR Part 650 — Operator Certification and Training (NYSDEC).
DEFAULT_RTC_HOURS_BY_GRADE_WW: Dict[str, float] = {
    "1": 12.0,
    "2": 18.0,
    "3": 24.0,
    "4": 30.0,
    "1A": 12.0,
    "2A": 18.0,
    "3A": 24.0,
    "4A": 30.0,
}

WW_FEDERAL_CITATION = (
    "Clean Water Act §402 — NPDES permit conditions require qualified operators "
    "in responsible charge; states administer certification under approved programs."
)

WW_STATE_CITATION = (
    "6 NYCRR Part 650 — Operator Certification and Training (NYSDEC wastewater "
    "operator certification and recertification requirements)."
)

WW_REGULATION_SOURCES = {
    "part_650": "https://www.dec.ny.gov/regulations/94147.html",
    "operator_certification": (
        "https://www.dec.ny.gov/chemical/8468.html"
    ),
}

WW_SCOPE_NOTES = [
    (
        "Values below are reasonable NYSDEC-style placeholders for treatment grades "
        "1–4 and collection grades 1A–4A over a fixed 5-year renewal cycle "
        "(Part 650). Confirm RTC totals against the current DEC operator handbook."
    ),
    (
        "One CEU equals 10 contact hours of DEC-approved training. Operators holding "
        "multiple wastewater grades must meet the requirement for the highest grade held."
    ),
    (
        "Renewals with expiration on or after 2027-01-01 include an additional "
        "cybersecurity awareness RTC requirement (placeholder: 10 contact hours)."
    ),
]

WW_APPROVED_CATEGORIES_TREATMENT = [
    "Biological treatment",
    "Physical/chemical treatment",
    "Laboratory",
    "Mathematics",
    "Operation & maintenance",
    "Regulations",
    "Safety",
    "Collection systems",
]

WW_APPROVED_CATEGORIES_COLLECTION = [
    "Collection systems",
    "Pumping stations",
    "Mathematics",
    "Operation & maintenance",
    "Regulations",
    "Safety",
]


@dataclass(frozen=True)
class MandatoryCategoryRule:
    category: str
    minimum_ceu: float
    notes: Optional[str] = None


@dataclass(frozen=True)
class WastewaterGradeRequirement:
    grade: str
    role_title: str
    cert_type: str  # treatment | collection
    cert_program: str
    required_contact_hours: float
    renewal_cycle_years: int
    mandatory_categories: List[MandatoryCategoryRule] = field(default_factory=list)
    acceptable_categories: List[str] = field(default_factory=list)
    notes: Optional[str] = None

    @property
    def required_ceu(self) -> float:
        return self.required_contact_hours / 10.0


@dataclass(frozen=True)
class WastewaterRoleDefinition:
    role_key: str
    role_title: str
    description: str
    issuing_authority: str
    cert_program: str
    grades: List[WastewaterGradeRequirement] = field(default_factory=list)
    federal_citation: str = WW_FEDERAL_CITATION
    state_citation: str = WW_STATE_CITATION


def _ww_grade_req(
    grade: str,
    role_title: str,
    cert_type: str,
    contact_hours: float,
    *,
    acceptable: List[str],
    notes: Optional[str] = None,
) -> WastewaterGradeRequirement:
    return WastewaterGradeRequirement(
        grade=grade,
        role_title=role_title,
        cert_type=cert_type,
        cert_program="wastewater",
        required_contact_hours=contact_hours,
        renewal_cycle_years=RENEWAL_CYCLE_YEARS_WW,
        acceptable_categories=acceptable,
        notes=notes,
    )


WASTEWATER_OPERATOR_ROLES: List[WastewaterRoleDefinition] = [
    WastewaterRoleDefinition(
        role_key="wastewater_treatment_plant_operator",
        role_title="Wastewater Treatment Plant Operator",
        description=(
            "DEC-certified operator in responsible charge of a WWTP "
            "(6 NYCRR Part 650 treatment grades 1–4)."
        ),
        issuing_authority="NYS Department of Environmental Conservation",
        cert_program="wastewater",
        grades=[
            _ww_grade_req(
                "1",
                "Wastewater Treatment Plant Operator",
                "treatment",
                DEFAULT_RTC_HOURS_BY_GRADE_WW["1"],
                acceptable=WW_APPROVED_CATEGORIES_TREATMENT,
            ),
            _ww_grade_req(
                "2",
                "Wastewater Treatment Plant Operator",
                "treatment",
                DEFAULT_RTC_HOURS_BY_GRADE_WW["2"],
                acceptable=WW_APPROVED_CATEGORIES_TREATMENT,
            ),
            _ww_grade_req(
                "3",
                "Wastewater Treatment Plant Operator",
                "treatment",
                DEFAULT_RTC_HOURS_BY_GRADE_WW["3"],
                acceptable=WW_APPROVED_CATEGORIES_TREATMENT,
            ),
            _ww_grade_req(
                "4",
                "Wastewater Treatment Plant Operator",
                "treatment",
                DEFAULT_RTC_HOURS_BY_GRADE_WW["4"],
                acceptable=WW_APPROVED_CATEGORIES_TREATMENT,
            ),
        ],
    ),
    WastewaterRoleDefinition(
        role_key="wastewater_collection_system_operator",
        role_title="Wastewater Collection System Operator",
        description=(
            "DEC-certified operator for sewer collection systems "
            "(6 NYCRR Part 650 collection grades 1A–4A)."
        ),
        issuing_authority="NYS Department of Environmental Conservation",
        cert_program="wastewater",
        grades=[
            _ww_grade_req(
                "1A",
                "Wastewater Collection System Operator",
                "collection",
                DEFAULT_RTC_HOURS_BY_GRADE_WW["1A"],
                acceptable=WW_APPROVED_CATEGORIES_COLLECTION,
            ),
            _ww_grade_req(
                "2A",
                "Wastewater Collection System Operator",
                "collection",
                DEFAULT_RTC_HOURS_BY_GRADE_WW["2A"],
                acceptable=WW_APPROVED_CATEGORIES_COLLECTION,
            ),
            _ww_grade_req(
                "3A",
                "Wastewater Collection System Operator",
                "collection",
                DEFAULT_RTC_HOURS_BY_GRADE_WW["3A"],
                acceptable=WW_APPROVED_CATEGORIES_COLLECTION,
            ),
            _ww_grade_req(
                "4A",
                "Wastewater Collection System Operator",
                "collection",
                DEFAULT_RTC_HOURS_BY_GRADE_WW["4A"],
                acceptable=WW_APPROVED_CATEGORIES_COLLECTION,
            ),
        ],
    ),
]

GRADE_TO_REQUIRED_RTC_WW: Dict[str, float] = dict(DEFAULT_RTC_HOURS_BY_GRADE_WW)

WW_TREATMENT_GRADES = ("1", "2", "3", "4")
WW_COLLECTION_GRADES = ("1A", "2A", "3A", "4A")


def normalize_grade_ww(grade: Optional[str]) -> Optional[str]:
    if not grade:
        return None
    g = grade.strip().upper().replace(" ", "")
    if g in GRADE_TO_REQUIRED_RTC_WW:
        return g
    # Allow "Grade 3" / "3-A" style inputs
    aliases = {
        "GRADE1": "1",
        "GRADE2": "2",
        "GRADE3": "3",
        "GRADE4": "4",
        "GRADE1A": "1A",
        "GRADE2A": "2A",
        "GRADE3A": "3A",
        "GRADE4A": "4A",
        "3-A": "3A",
        "4-A": "4A",
    }
    if g in aliases:
        return aliases[g]
    if g.endswith("A") and g[:-1].isdigit():
        candidate = f"{g[:-1]}A"
        if candidate in GRADE_TO_REQUIRED_RTC_WW:
            return candidate
    return g


def cyber_rtc_required(expiration_date: Optional[date]) -> bool:
    """True when renewal cycle includes the Part 650 cyber RTC add-on."""
    if expiration_date is None:
        return False
    return expiration_date >= CYBER_CEU_EFFECTIVE_DATE


def required_hours_for_grade_ww(
    grade: Optional[str],
    *,
    overrides: Optional[Dict[str, float]] = None,
    expiration_date: Optional[date] = None,
    include_cyber: bool = True,
) -> float:
    """Return required contact hours (RTC) for a wastewater grade over the 5-year cycle."""
    table = {**GRADE_TO_REQUIRED_RTC_WW, **(overrides or {})}
    norm = normalize_grade_ww(grade)
    base = float(table.get(norm or "", table.get("1", 12.0)))
    if include_cyber and cyber_rtc_required(expiration_date):
        base += CYBER_CONTACT_HOURS
    return base


def grade_rank_ww(grade: Optional[str]) -> int:
    """Numeric rank for comparison (higher = more qualified)."""
    norm = normalize_grade_ww(grade)
    if not norm:
        return 0
    treatment_ranks = {"1": 1, "2": 2, "3": 3, "4": 4}
    collection_ranks = {"1A": 1, "2A": 2, "3A": 3, "4A": 4}
    if norm in treatment_ranks:
        return treatment_ranks[norm]
    if norm in collection_ranks:
        return collection_ranks[norm] + 10  # distinguish track; same-track compares below
    return 0


def grade_meets_required(actual: Optional[str], required: Optional[str]) -> bool:
    """True when actual grade meets or exceeds required plant class (same track)."""
    act = normalize_grade_ww(actual)
    req = normalize_grade_ww(required)
    if not act or not req:
        return False
    act_is_collection = act.endswith("A")
    req_is_collection = req.endswith("A")
    if act_is_collection != req_is_collection:
        return False
    return grade_rank_ww(act) >= grade_rank_ww(req)


def get_wastewater_requirements_taxonomy() -> Dict:
    roles_out = []
    for role in WASTEWATER_OPERATOR_ROLES:
        grades_out = []
        for g in role.grades:
            grades_out.append(
                {
                    "grade": g.grade,
                    "role_title": g.role_title,
                    "cert_type": g.cert_type,
                    "cert_program": g.cert_program,
                    "required_ceu": g.required_ceu,
                    "required_contact_hours": g.required_contact_hours,
                    "renewal_cycle_years": g.renewal_cycle_years,
                    "mandatory_categories": [
                        {
                            "category": m.category,
                            "minimum_ceu": m.minimum_ceu,
                            "notes": m.notes,
                        }
                        for m in g.mandatory_categories
                    ],
                    "acceptable_categories": g.acceptable_categories,
                    "notes": g.notes,
                }
            )
        roles_out.append(
            {
                "role_key": role.role_key,
                "role_title": role.role_title,
                "description": role.description,
                "issuing_authority": role.issuing_authority,
                "cert_program": role.cert_program,
                "federal_citation": role.federal_citation,
                "state_citation": role.state_citation,
                "grades": grades_out,
            }
        )
    default_ceu = {
        grade: hours / 10.0 for grade, hours in DEFAULT_RTC_HOURS_BY_GRADE_WW.items()
    }
    return {
        "renewal_cycle_years": RENEWAL_CYCLE_YEARS_WW,
        "federal_citation": WW_FEDERAL_CITATION,
        "state_citation": WW_STATE_CITATION,
        "regulation_sources": dict(WW_REGULATION_SOURCES),
        "scope_notes": list(WW_SCOPE_NOTES),
        "default_ceu_by_grade": default_ceu,
        "default_rtc_hours_by_grade": dict(DEFAULT_RTC_HOURS_BY_GRADE_WW),
        "cyber_rtc_effective_date": CYBER_CEU_EFFECTIVE_DATE.isoformat(),
        "cyber_contact_hours": CYBER_CONTACT_HOURS,
        "roles": roles_out,
    }
