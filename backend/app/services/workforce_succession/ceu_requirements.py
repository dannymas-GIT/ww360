"""NYS / EPA operator CEU requirements reference taxonomy.

Single source of truth for role names, grade tiers, renewal-cycle CEU amounts,
mandatory training categories, and regulatory citations used by ceu_service,
API endpoints, and the workforce continuity UI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

RENEWAL_CYCLE_YEARS = 3

# 10 NYCRR Subpart 5-4.8 Table 5-4.8 — CEU totals over a fixed 3-year cycle.
DEFAULT_CEU_REQUIREMENTS_BY_GRADE: Dict[str, float] = {
    "IA": 3.0,
    "IIA": 3.0,
    "IB": 3.0,
    "IIB": 3.0,
    "C": 1.5,
    "D": 1.5,
    # Legacy / shorthand aliases used in imports and UI filters
    "A": 3.0,
    "B": 3.0,
    "IIIA": 3.0,
    "IIIB": 3.0,
    "IIIC": 1.5,
}

# Approved training categories (Subpart 5-4.8 Table 5-4.8)
APPROVED_CATEGORIES_A_GRADES = [
    "Laboratory",
    "Science of water",
    "Source water protection",
    "Mathematics",
    "Treatment",
    "Operation & maintenance",
    "Regulations",
    "Safety",
]

APPROVED_CATEGORIES_B_GRADES = [
    "Laboratory",
    "Science of water",
    "Source water protection",
    "Mathematics",
    "Treatment",
    "Operation & maintenance",
    "Regulations",
    "Safety",
]

APPROVED_CATEGORIES_C = [
    "Laboratory",
    "Science of water",
    "Source water protection",
    "Mathematics",
    "Treatment",
    "Operation & maintenance",
    "Distribution systems",
    "Regulations",
    "Safety",
]

APPROVED_CATEGORIES_D = [
    "Distribution systems",
    "Mathematics",
    "Operation & maintenance",
    "Regulations",
    "Safety",
]

FEDERAL_CITATION = (
    "SDWA §1419 — EPA Final Guidelines for the Certification and Recertification "
    "of Operators of Community and Nontransient Noncommunity Public Water Systems "
    "(Federal Register, Feb 5, 1999). States must implement a fixed renewal cycle "
    "not exceeding three years and a recertification process for lapsed certificates."
)

NYS_CITATION = (
    "10 NYCRR Subpart 5-4 — Classification and Certification of Community and "
    "Nontransient Noncommunity Water System Operators; §5-4.8 Table 5-4.8 "
    "(fixed 3-year renewal cycle)."
)

# Authoritative NYSDOH sources (verified 2026-06; do not use legacy health.ny.gov
# /regulations/subpart5-4.htm paths — those 404; use regs.health.ny.gov instead).
NYS_REGULATION_SOURCES = {
    "subpart_5_4": (
        "https://regs.health.ny.gov/content/subpart-5-4-classification-and-"
        "certification-community-and-nontransient-noncommunity-water"
    ),
    "section_5_4_8": (
        "https://regs.health.ny.gov/content/section-5-48-renewalrecertification-requirements"
    ),
    "section_5_4_1_definitions": (
        "https://regs.health.ny.gov/content/section-5-41-definitions"
    ),
    "operator_program": (
        "https://www.health.ny.gov/environmental/water/drinking/operate/operate.htm"
    ),
    "operator_fact_sheet": (
        "https://www.health.ny.gov/environmental/water/drinking/operate/opcertfs.htm"
    ),
}

# Plain-language scope — what this module does and does not model.
REQUIREMENTS_SCOPE_NOTES = [
    (
        "Values below are transcribed from 10 NYCRR §5-4.8 Table 5-4.8 for community and "
        "nontransient noncommunity (C/NTNC) drinking-water operator certificate grades "
        "IA, IIA, IB, IIB, C, and D — not job titles such as superintendent or chief operator."
    ),
    (
        "One CEU equals 10 contact hours of Department-approved training (§5-4.1). "
        "Operators holding dual certification must meet the requirement for the highest "
        "grade held (§5-4.8(a)(5)); AquaSafe CEU progress currently uses one primary "
        "operator cert per employee unless district staff override grades manually."
    ),
    (
        "Backflow prevention assembly tester credentials are a separate program and are "
        "not governed by Subpart 5-4 Table 5-4.8; recertification hours vary by sponsor."
    ),
    (
        "The statewide training catalog is scraped from NYSDOH-approved course listings; "
        "category-to-CEU compliance is displayed for reference but not auto-validated on "
        "each CEU record entry."
    ),
]

BACKFLOW_CITATION = (
    "NYS cross-connection control / backflow prevention assembly tester program "
    "(separate from Subpart 5-4 operator CEU). Recertification requirements are "
    "program-specific; consult the local health department or sponsoring agency."
)


@dataclass(frozen=True)
class MandatoryCategoryRule:
    category: str
    minimum_ceu: float
    notes: Optional[str] = None


@dataclass(frozen=True)
class OperatorGradeRequirement:
    grade: str
    role_title: str
    cert_type: str  # treatment | distribution | backflow
    cert_program: str  # drinking_water | backflow
    required_ceu: float
    renewal_cycle_years: int
    mandatory_categories: List[MandatoryCategoryRule] = field(default_factory=list)
    acceptable_categories: List[str] = field(default_factory=list)
    notes: Optional[str] = None


@dataclass(frozen=True)
class OperatorRoleDefinition:
    role_key: str
    role_title: str
    description: str
    issuing_authority: str
    cert_program: str
    grades: List[OperatorGradeRequirement] = field(default_factory=list)
    federal_citation: str = FEDERAL_CITATION
    state_citation: str = NYS_CITATION


def _grade_req(
    grade: str,
    role_title: str,
    cert_type: str,
    required_ceu: float,
    *,
    mandatory: Optional[List[MandatoryCategoryRule]] = None,
    acceptable: List[str],
    notes: Optional[str] = None,
) -> OperatorGradeRequirement:
    return OperatorGradeRequirement(
        grade=grade,
        role_title=role_title,
        cert_type=cert_type,
        cert_program="drinking_water",
        required_ceu=required_ceu,
        renewal_cycle_years=RENEWAL_CYCLE_YEARS,
        mandatory_categories=mandatory or [],
        acceptable_categories=acceptable,
        notes=notes,
    )


OPERATOR_ROLES: List[OperatorRoleDefinition] = [
    OperatorRoleDefinition(
        role_key="water_treatment_plant_operator",
        role_title="Water Treatment Plant Operator",
        description=(
            "Certified operator in responsible charge of a community or "
            "nontransient noncommunity water treatment plant (Subpart 5-4.1)."
        ),
        issuing_authority="NYS Department of Health",
        cert_program="drinking_water",
        grades=[
            _grade_req(
                "IA",
                "Water Treatment Plant Operator",
                "treatment",
                3.0,
                mandatory=[
                    MandatoryCategoryRule(
                        "Laboratory",
                        0.5,
                        "0.5 CEU required from an approved laboratory course.",
                    )
                ],
                acceptable=APPROVED_CATEGORIES_A_GRADES,
                notes="Remaining 2.5 CEU from approved categories.",
            ),
            _grade_req(
                "IIA",
                "Water Treatment Plant Operator",
                "treatment",
                3.0,
                mandatory=[
                    MandatoryCategoryRule(
                        "Laboratory",
                        0.5,
                        "0.5 CEU required from an approved laboratory course.",
                    )
                ],
                acceptable=APPROVED_CATEGORIES_A_GRADES,
                notes="Remaining 2.5 CEU from approved categories.",
            ),
            _grade_req(
                "IB",
                "Water Treatment Plant Operator",
                "treatment",
                3.0,
                acceptable=APPROVED_CATEGORIES_B_GRADES,
            ),
            _grade_req(
                "IIB",
                "Water Treatment Plant Operator",
                "treatment",
                3.0,
                acceptable=APPROVED_CATEGORIES_B_GRADES,
            ),
            _grade_req(
                "C",
                "Water Treatment Plant Operator",
                "treatment",
                1.5,
                acceptable=APPROVED_CATEGORIES_C,
            ),
        ],
    ),
    OperatorRoleDefinition(
        role_key="water_treatment_assistant_operator",
        role_title="Water Treatment Assistant Operator",
        description=(
            "Assistant operator certification for water treatment plants "
            "(Subpart 5-4.1)."
        ),
        issuing_authority="NYS Department of Health",
        cert_program="drinking_water",
        grades=[
            _grade_req(
                "C",
                "Water Treatment Assistant Operator",
                "treatment",
                1.5,
                acceptable=APPROVED_CATEGORIES_C,
            ),
        ],
    ),
    OperatorRoleDefinition(
        role_key="distribution_system_operator",
        role_title="Distribution System Operator",
        description=(
            "Certified operator in responsible charge of a public water "
            "distribution system (Subpart 5-4.1)."
        ),
        issuing_authority="NYS Department of Health",
        cert_program="drinking_water",
        grades=[
            _grade_req(
                "D",
                "Distribution System Operator",
                "distribution",
                1.5,
                acceptable=APPROVED_CATEGORIES_D,
            ),
        ],
    ),
    OperatorRoleDefinition(
        role_key="backflow_prevention_assembly_tester",
        role_title="Backflow Prevention Assembly Tester",
        description=(
            "Certified tester for cross-connection control and backflow "
            "prevention assemblies. Separate from Subpart 5-4 operator CEU."
        ),
        issuing_authority="NYS / local health department (program sponsor)",
        cert_program="backflow",
        federal_citation=FEDERAL_CITATION,
        state_citation=BACKFLOW_CITATION,
        grades=[
            OperatorGradeRequirement(
                grade="TESTER",
                role_title="Backflow Prevention Assembly Tester",
                cert_type="backflow",
                cert_program="backflow",
                required_ceu=0.0,
                renewal_cycle_years=RENEWAL_CYCLE_YEARS,
                acceptable_categories=["Cross-connection control", "Backflow prevention"],
                notes=(
                    "Recertification CEU/contact-hour requirements vary by sponsoring "
                    "agency; not governed by Subpart 5-4 Table 5-4.8."
                ),
            ),
        ],
    ),
]

# Flat lookup: normalized grade -> required CEU hours
GRADE_TO_REQUIRED_CEU: Dict[str, float] = dict(DEFAULT_CEU_REQUIREMENTS_BY_GRADE)


def normalize_grade(grade: Optional[str]) -> Optional[str]:
    """Normalize certification grade strings to canonical IA/IIA/IB/IIB/C/D keys."""
    if not grade:
        return None
    g = grade.strip().upper().replace(" ", "")
    # Legacy single-letter grades map to canonical IA/IB before flat lookup
    if g == "A":
        return "IA"
    if g == "B":
        return "IB"
    # Grade 3-A/B/C (stored as IIIA/IIIB/IIIC in imports) before substring matching
    if g in ("IIIA", "IIIB", "IIIC"):
        return g
    if g in GRADE_TO_REQUIRED_CEU:
        return g
    # Map Roman-numeral style and legacy prefixed grades
    aliases = {
        "GRADEIA": "IA",
        "GRADEIIA": "IIA",
        "GRADEIB": "IB",
        "GRADEIIB": "IIB",
        "GRADEC": "C",
        "GRADED": "D",
        "TYPEA": "IA",
        "TYPEB": "IB",
    }
    if g in aliases:
        return aliases[g]
    for key in ("IIA", "IIB", "IA", "IB", "C", "D"):
        if g == key:
            return key
    return g


def required_hours_for_grade(
    grade: Optional[str], overrides: Optional[Dict[str, float]] = None
) -> float:
    table = {**GRADE_TO_REQUIRED_CEU, **(overrides or {})}
    norm = normalize_grade(grade)
    if norm and norm in table:
        return float(table[norm])
    return float(table.get("C", 1.5))


def mandatory_category_rules(grade: Optional[str]) -> List[MandatoryCategoryRule]:
    norm = normalize_grade(grade)
    for role in OPERATOR_ROLES:
        for g in role.grades:
            if g.grade == norm:
                return list(g.mandatory_categories)
    return []


def get_requirements_taxonomy() -> Dict:
    """Serialize the full role/grade taxonomy for API and UI consumption."""
    roles_out = []
    for role in OPERATOR_ROLES:
        grades_out = []
        for g in role.grades:
            grades_out.append(
                {
                    "grade": g.grade,
                    "role_title": g.role_title,
                    "cert_type": g.cert_type,
                    "cert_program": g.cert_program,
                    "required_ceu": g.required_ceu,
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
    return {
        "renewal_cycle_years": RENEWAL_CYCLE_YEARS,
        "federal_citation": FEDERAL_CITATION,
        "state_citation": NYS_CITATION,
        "regulation_sources": dict(NYS_REGULATION_SOURCES),
        "scope_notes": list(REQUIREMENTS_SCOPE_NOTES),
        "default_ceu_by_grade": dict(DEFAULT_CEU_REQUIREMENTS_BY_GRADE),
        "roles": roles_out,
    }
