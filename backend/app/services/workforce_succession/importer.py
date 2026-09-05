"""CSV intake for workforce succession data.

Uses the same staging-then-promote philosophy as the lab data importer
(``app.services.ingestion.manual_adapter``). The flow is:

1. Parse the uploaded CSV.
2. Validate required columns and per-row data quality for the entity type.
3. Persist a ``WorkforceImportBatch`` header so reviewers can see what was
   loaded.
4. If ``commit`` is true (and there are no fatal validation errors), upsert
   rows into the target table keyed by ``(district_code, natural_key)`` so
   re-imports update existing rows instead of creating duplicates.

The importer is intentionally narrow: it only moves data into planning-grade
workforce tables. It does not perform HR validations or reach out to external
HRIS systems.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from app.models.workforce_succession import (
    WorkforceCertification,
    WorkforceCriticalFunction,
    WorkforceEmployee,
    WorkforceImportBatch,
    WorkforceKnowledgeArtifact,
    WorkforcePosition,
    WorkforceRoleCoverage,
    WorkforceSuccessionCandidate,
    WorkforceTransitionMilestone,
)

logger = logging.getLogger(__name__)


ENTITY_TYPES = (
    "positions",
    "employees",
    "certifications",
    "critical_functions",
    "role_coverage",
    "succession_candidates",
    "knowledge_artifacts",
    "transition_milestones",
)


class WorkforceImportError(Exception):
    """Raised for fatal import errors (caller should map to HTTP 400)."""


@dataclass
class _RowIssue:
    row_index: int
    field: Optional[str]
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_index": self.row_index,
            "field": self.field,
            "message": self.message,
        }


@dataclass
class _EntitySpec:
    """Static description of how to ingest a CSV for an entity type."""

    model: type
    required_columns: Sequence[str]
    optional_columns: Sequence[str]
    boolean_columns: Sequence[str] = field(default_factory=tuple)
    date_columns: Sequence[str] = field(default_factory=tuple)
    int_columns: Sequence[str] = field(default_factory=tuple)
    natural_key: Sequence[str] = field(default_factory=tuple)
    enum_columns: Dict[str, Sequence[str]] = field(default_factory=dict)


def _truthy(value: Any) -> Optional[bool]:
    if value is None or value == "":
        return None
    s = str(value).strip().lower()
    if s in {"1", "true", "yes", "y", "t"}:
        return True
    if s in {"0", "false", "no", "n", "f"}:
        return False
    return None


def _parse_date(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"unrecognized date '{value}'")


def _parse_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    return int(str(value).strip())


_SPECS: Dict[str, _EntitySpec] = {
    "positions": _EntitySpec(
        model=WorkforcePosition,
        required_columns=("district_code", "position_code", "title"),
        optional_columns=(
            "external_id",
            "civil_service_classification",
            "civil_service_grade",
            "department",
            "reports_to_position_code",
            "fte_count",
            "is_funded",
            "is_vacant",
            "vacancy_since",
            "notes",
        ),
        boolean_columns=("is_funded", "is_vacant"),
        date_columns=("vacancy_since",),
        int_columns=("fte_count",),
        natural_key=("district_code", "position_code"),
    ),
    "employees": _EntitySpec(
        model=WorkforceEmployee,
        required_columns=("district_code", "employee_code", "full_name"),
        optional_columns=(
            "external_id",
            "work_email",
            "work_phone",
            "operator_grade",
            "position_code",
            "hire_date",
            "retirement_eligible_date",
            "planned_departure_date",
            "linked_aquasafe_username",
            "is_active",
            "notes",
        ),
        boolean_columns=("is_active",),
        date_columns=(
            "hire_date",
            "retirement_eligible_date",
            "planned_departure_date",
        ),
        natural_key=("district_code", "employee_code"),
    ),
    "certifications": _EntitySpec(
        model=WorkforceCertification,
        required_columns=(
            "district_code",
            "employee_code",
            "certification_type",
        ),
        optional_columns=(
            "external_id",
            "certification_grade",
            "issuing_authority",
            "credential_id",
            "issued_date",
            "expiration_date",
            "is_required_for_role",
            "notes",
        ),
        boolean_columns=("is_required_for_role",),
        date_columns=("issued_date", "expiration_date"),
        natural_key=(
            "district_code",
            "employee_code",
            "certification_type",
            "certification_grade",
            "credential_id",
        ),
    ),
    "critical_functions": _EntitySpec(
        model=WorkforceCriticalFunction,
        required_columns=(
            "district_code",
            "function_code",
            "function_name",
        ),
        optional_columns=(
            "external_id",
            "function_area",
            "description",
            "linked_facility_id",
            "linked_schedule_id",
            "linked_program",
            "required_certification_type",
            "required_certification_grade",
        ),
        int_columns=("linked_facility_id", "linked_schedule_id"),
        natural_key=("district_code", "function_code"),
    ),
    "role_coverage": _EntitySpec(
        model=WorkforceRoleCoverage,
        required_columns=(
            "district_code",
            "function_code",
            "employee_code",
            "coverage_role",
        ),
        optional_columns=(
            "external_id",
            "proficiency_level",
            "last_performed_date",
            "notes",
        ),
        date_columns=("last_performed_date",),
        natural_key=(
            "district_code",
            "function_code",
            "employee_code",
            "coverage_role",
        ),
        enum_columns={
            "coverage_role": WorkforceRoleCoverage.COVERAGE_ROLES,
            "proficiency_level": WorkforceRoleCoverage.PROFICIENCY_LEVELS,
        },
    ),
    "succession_candidates": _EntitySpec(
        model=WorkforceSuccessionCandidate,
        required_columns=(
            "district_code",
            "employee_code",
            "target_position_code",
        ),
        optional_columns=(
            "external_id",
            "readiness_level",
            "readiness_target_date",
            "training_plan_summary",
            "mentor_employee_code",
            "notes",
        ),
        date_columns=("readiness_target_date",),
        natural_key=(
            "district_code",
            "employee_code",
            "target_position_code",
        ),
        enum_columns={
            "readiness_level": WorkforceSuccessionCandidate.READINESS_LEVELS,
        },
    ),
    "knowledge_artifacts": _EntitySpec(
        model=WorkforceKnowledgeArtifact,
        required_columns=(
            "district_code",
            "external_id",
            "artifact_type",
            "title",
        ),
        optional_columns=(
            "function_code",
            "summary",
            "source_employee_code",
            "captured_by",
            "captured_date",
            "verified_by",
            "verified_date",
            "storage_uri",
            "notes",
        ),
        date_columns=("captured_date", "verified_date"),
        natural_key=("district_code", "external_id"),
        enum_columns={
            "artifact_type": WorkforceKnowledgeArtifact.ARTIFACT_TYPES,
        },
    ),
    "transition_milestones": _EntitySpec(
        model=WorkforceTransitionMilestone,
        required_columns=(
            "district_code",
            "position_code",
            "milestone_type",
            "title",
        ),
        optional_columns=(
            "external_id",
            "owner_employee_code",
            "target_date",
            "completed_date",
            "status",
            "toolkit_phase",
            "notes",
        ),
        date_columns=("target_date", "completed_date"),
        natural_key=(
            "district_code",
            "position_code",
            "milestone_type",
            "external_id",
        ),
        enum_columns={
            "milestone_type": WorkforceTransitionMilestone.MILESTONE_TYPES,
            "status": WorkforceTransitionMilestone.STATUS_VALUES,
            "toolkit_phase": WorkforceTransitionMilestone.TOOLKIT_PHASES,
        },
    ),
}


def _decode_csv(content: bytes) -> List[Dict[str, str]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        clean = {
            (k or "").strip(): (v.strip() if isinstance(v, str) else v)
            for k, v in row.items()
        }
        rows.append(clean)
    return rows


def _coerce_value(spec: _EntitySpec, column: str, value: Any) -> Any:
    if value is None or value == "":
        return None
    if column in spec.boolean_columns:
        coerced = _truthy(value)
        if coerced is None:
            raise ValueError(f"invalid boolean for '{column}': {value!r}")
        return coerced
    if column in spec.date_columns:
        return _parse_date(value)
    if column in spec.int_columns:
        return _parse_int(value)
    return value


def _validate_row(
    spec: _EntitySpec,
    row_index: int,
    row: Dict[str, Any],
    target_district: Optional[str],
) -> Tuple[Dict[str, Any], List[_RowIssue]]:
    issues: List[_RowIssue] = []
    cleaned: Dict[str, Any] = {}

    district_code = row.get("district_code") or target_district
    if not district_code:
        issues.append(
            _RowIssue(row_index, "district_code", "district_code is required")
        )
    cleaned["district_code"] = district_code

    if target_district and district_code and district_code != target_district:
        issues.append(
            _RowIssue(
                row_index,
                "district_code",
                f"district_code '{district_code}' does not match target '{target_district}'",
            )
        )

    for col in spec.required_columns:
        if col == "district_code":
            continue
        if not row.get(col):
            issues.append(_RowIssue(row_index, col, f"{col} is required"))

    columns = (
        list(spec.required_columns) + list(spec.optional_columns)
    )
    for col in columns:
        if col == "district_code":
            continue
        if col not in row:
            cleaned[col] = None
            continue
        try:
            cleaned[col] = _coerce_value(spec, col, row.get(col))
        except ValueError as exc:
            issues.append(_RowIssue(row_index, col, str(exc)))
            cleaned[col] = None

    for col, allowed in spec.enum_columns.items():
        value = cleaned.get(col)
        if value and value not in allowed:
            issues.append(
                _RowIssue(
                    row_index,
                    col,
                    f"value '{value}' not in {sorted(allowed)}",
                )
            )

    return cleaned, issues


def _build_natural_key_filter(
    spec: _EntitySpec, cleaned: Dict[str, Any]
) -> Dict[str, Any]:
    return {col: cleaned.get(col) for col in spec.natural_key}


def _resolve_employee_id(
    db: Session, district_code: str, employee_code: Optional[str]
) -> Optional[int]:
    if not employee_code:
        return None
    row = (
        db.query(WorkforceEmployee.id)
        .filter(
            WorkforceEmployee.district_code == district_code,
            WorkforceEmployee.employee_code == employee_code,
        )
        .first()
    )
    return row[0] if row else None


def _resolve_function_id(
    db: Session, district_code: str, function_code: Optional[str]
) -> Optional[int]:
    if not function_code:
        return None
    row = (
        db.query(WorkforceCriticalFunction.id)
        .filter(
            WorkforceCriticalFunction.district_code == district_code,
            WorkforceCriticalFunction.function_code == function_code,
        )
        .first()
    )
    return row[0] if row else None


def _resolve_user_id(
    db: Session, username: Optional[str]
) -> Optional[int]:
    if not username:
        return None
    from app.models.user import User

    row = db.query(User.id).filter(User.username == username).first()
    return row[0] if row else None


def _resolve_position_id(
    db: Session, district_code: str, position_code: Optional[str]
) -> Optional[int]:
    if not position_code:
        return None
    row = (
        db.query(WorkforcePosition.id)
        .filter(
            WorkforcePosition.district_code == district_code,
            WorkforcePosition.position_code == position_code,
        )
        .first()
    )
    return row[0] if row else None


def _lookup_employee_code(
    db: Session, district_code: str, employee_id: Optional[int]
) -> Optional[str]:
    if not employee_id:
        return None
    row = (
        db.query(WorkforceEmployee.employee_code)
        .filter(
            WorkforceEmployee.district_code == district_code,
            WorkforceEmployee.id == employee_id,
        )
        .first()
    )
    return row[0] if row else None


def _lookup_position_code(
    db: Session, district_code: str, position_id: Optional[int]
) -> Optional[str]:
    if not position_id:
        return None
    row = (
        db.query(WorkforcePosition.position_code)
        .filter(
            WorkforcePosition.district_code == district_code,
            WorkforcePosition.id == position_id,
        )
        .first()
    )
    return row[0] if row else None


def _lookup_function_code(
    db: Session, district_code: str, function_id: Optional[int]
) -> Optional[str]:
    if not function_id:
        return None
    row = (
        db.query(WorkforceCriticalFunction.function_code)
        .filter(
            WorkforceCriticalFunction.district_code == district_code,
            WorkforceCriticalFunction.id == function_id,
        )
        .first()
    )
    return row[0] if row else None


def _sync_employee_ref(
    db: Session, district_code: str, cleaned: Dict[str, Any]
) -> None:
    if cleaned.get("employee_id"):
        code = _lookup_employee_code(db, district_code, cleaned.get("employee_id"))
        if code:
            cleaned["employee_code"] = code
    elif cleaned.get("employee_code"):
        cleaned["employee_id"] = _resolve_employee_id(
            db, district_code, cleaned.get("employee_code")
        )


def _sync_position_ref(
    db: Session, district_code: str, cleaned: Dict[str, Any], *, id_key: str, code_key: str
) -> None:
    if cleaned.get(id_key):
        code = _lookup_position_code(db, district_code, cleaned.get(id_key))
        if code:
            cleaned[code_key] = code
    elif cleaned.get(code_key):
        cleaned[id_key] = _resolve_position_id(db, district_code, cleaned.get(code_key))


def _sync_function_ref(
    db: Session, district_code: str, cleaned: Dict[str, Any]
) -> None:
    if cleaned.get("function_id"):
        code = _lookup_function_code(db, district_code, cleaned.get("function_id"))
        if code:
            cleaned["function_code"] = code
    elif cleaned.get("function_code"):
        cleaned["function_id"] = _resolve_function_id(
            db, district_code, cleaned.get("function_code")
        )


def _post_process_row(
    db: Session, entity_type: str, cleaned: Dict[str, Any]
) -> Dict[str, Any]:
    """Resolve cross-entity FKs and keep parallel code columns in sync."""
    district_code = cleaned.get("district_code")
    if entity_type == "positions":
        _sync_position_ref(
            db,
            district_code,
            cleaned,
            id_key="reports_to_position_id",
            code_key="reports_to_position_code",
        )
    elif entity_type == "employees":
        username = cleaned.pop("linked_aquasafe_username", None)
        cleaned["linked_aquasafe_user_id"] = _resolve_user_id(db, username)
        _sync_position_ref(
            db, district_code, cleaned, id_key="position_id", code_key="position_code"
        )
    elif entity_type == "certifications":
        _sync_employee_ref(db, district_code, cleaned)
    elif entity_type == "role_coverage":
        _sync_employee_ref(db, district_code, cleaned)
        _sync_function_ref(db, district_code, cleaned)
    elif entity_type == "succession_candidates":
        _sync_employee_ref(db, district_code, cleaned)
        _sync_position_ref(
            db,
            district_code,
            cleaned,
            id_key="target_position_id",
            code_key="target_position_code",
        )
        if cleaned.get("mentor_employee_id"):
            mentor_code = _lookup_employee_code(
                db, district_code, cleaned.get("mentor_employee_id")
            )
            if mentor_code:
                cleaned["mentor_employee_code"] = mentor_code
        elif cleaned.get("mentor_employee_code"):
            cleaned["mentor_employee_id"] = _resolve_employee_id(
                db, district_code, cleaned.get("mentor_employee_code")
            )
    elif entity_type == "knowledge_artifacts":
        _sync_function_ref(db, district_code, cleaned)
        if cleaned.get("source_employee_id"):
            source_code = _lookup_employee_code(
                db, district_code, cleaned.get("source_employee_id")
            )
            if source_code:
                cleaned["source_employee_code"] = source_code
        elif cleaned.get("source_employee_code"):
            cleaned["source_employee_id"] = _resolve_employee_id(
                db, district_code, cleaned.get("source_employee_code")
            )
    elif entity_type == "transition_milestones":
        _sync_position_ref(
            db, district_code, cleaned, id_key="position_id", code_key="position_code"
        )
        if cleaned.get("owner_employee_id"):
            owner_code = _lookup_employee_code(
                db, district_code, cleaned.get("owner_employee_id")
            )
            if owner_code:
                cleaned["owner_employee_code"] = owner_code
        elif cleaned.get("owner_employee_code"):
            cleaned["owner_employee_id"] = _resolve_employee_id(
                db, district_code, cleaned.get("owner_employee_code")
            )
    return cleaned


def _upsert_row(
    db: Session, spec: _EntitySpec, cleaned: Dict[str, Any]
) -> None:
    filt = _build_natural_key_filter(spec, cleaned)
    query = db.query(spec.model)
    for col, value in filt.items():
        query = query.filter(getattr(spec.model, col) == value)
    existing = query.first()
    if existing is None:
        db.add(spec.model(**cleaned))
        return
    for column_name, value in cleaned.items():
        if hasattr(existing, column_name):
            setattr(existing, column_name, value)


def _ingest(
    db: Session,
    *,
    entity_type: str,
    rows: List[Dict[str, Any]],
    target_district: Optional[str],
    commit: bool,
) -> Tuple[Dict[str, Any], List[_RowIssue]]:
    if entity_type not in _SPECS:
        raise WorkforceImportError(
            f"unknown entity_type '{entity_type}', expected one of {ENTITY_TYPES}"
        )
    spec = _SPECS[entity_type]

    valid_rows: List[Dict[str, Any]] = []
    issues: List[_RowIssue] = []

    for idx, raw in enumerate(rows):
        cleaned, row_issues = _validate_row(spec, idx, raw, target_district)
        if row_issues:
            issues.extend(row_issues)
            continue
        valid_rows.append(cleaned)

    if commit and valid_rows:
        for cleaned in valid_rows:
            cleaned = _post_process_row(db, entity_type, cleaned)
            _upsert_row(db, spec, cleaned)

    summary = {
        "total_rows": len(rows),
        "valid_rows": len(valid_rows),
        "invalid_rows": len(rows) - len(valid_rows),
        "promoted_rows": len(valid_rows) if commit else 0,
    }
    return summary, issues


def ingest_workforce_rows(
    db: Session,
    *,
    entity_type: str,
    rows: List[Dict[str, Any]],
    target_district: Optional[str],
    commit: bool,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Public adapter for ingesting in-memory rows (e.g. wizard payloads).

    Uses the same ``_validate_row`` -> ``_post_process_row`` -> ``_upsert_row``
    pipeline the CSV importer uses. Caller is responsible for transaction
    commit.
    """
    summary, issues = _ingest(
        db,
        entity_type=entity_type,
        rows=rows,
        target_district=target_district,
        commit=commit,
    )
    return summary, [issue.to_dict() for issue in issues]


# Public list of accepted entity types in the recommended ingest order
# (parents before dependents). Wizard publish uses this order automatically.
ENTITY_TYPE_ORDER: Tuple[str, ...] = (
    "positions",
    "employees",
    "critical_functions",
    "certifications",
    "role_coverage",
    "succession_candidates",
    "knowledge_artifacts",
    "transition_milestones",
)


def preview_workforce_csv(
    db: Session,
    *,
    entity_type: str,
    content: bytes,
    target_district: Optional[str],
) -> Dict[str, Any]:
    """Validate the CSV without writing anything. Returns a preview dict."""
    rows = _decode_csv(content)
    summary, issues = _ingest(
        db,
        entity_type=entity_type,
        rows=rows,
        target_district=target_district,
        commit=False,
    )
    return {
        "entity_type": entity_type,
        "district_code": target_district,
        "total_rows": summary["total_rows"],
        "valid_rows": summary["valid_rows"],
        "invalid_rows": summary["invalid_rows"],
        "sample_rows": rows[:5],
        "issues": [issue.to_dict() for issue in issues[:50]],
    }


def import_workforce_csv(
    db: Session,
    *,
    entity_type: str,
    content: bytes,
    filename: Optional[str],
    target_district: Optional[str],
    submitted_by_user_id: Optional[int],
    commit: bool = True,
) -> Dict[str, Any]:
    """Stage and (optionally) promote a workforce CSV upload.

    Always creates a ``WorkforceImportBatch`` row so reviewers have a permanent
    record of the upload, even when commit is false.
    """
    rows = _decode_csv(content)
    if not rows:
        raise WorkforceImportError("CSV is empty")

    if not target_district:
        first = rows[0].get("district_code")
        if first:
            target_district = first

    if not target_district:
        raise WorkforceImportError(
            "target_district is required (either as query parameter or as a non-empty district_code column)"
        )

    summary, issues = _ingest(
        db,
        entity_type=entity_type,
        rows=rows,
        target_district=target_district,
        commit=commit,
    )

    status = "staged"
    if commit:
        if summary["invalid_rows"] == 0:
            status = "promoted"
        elif summary["valid_rows"] > 0:
            status = "partial"
        else:
            status = "rejected"

    batch = WorkforceImportBatch(
        district_code=target_district,
        entity_type=entity_type,
        original_filename=filename,
        submitted_by_user_id=submitted_by_user_id,
        total_rows=summary["total_rows"],
        rows_valid=summary["valid_rows"],
        rows_invalid=summary["invalid_rows"],
        rows_promoted=summary["promoted_rows"],
        status=status,
        validation_summary=json.dumps(
            {
                "issues": [issue.to_dict() for issue in issues[:200]],
                "summary": summary,
            },
            default=str,
        ),
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    return {
        "batch_id": batch.id,
        "entity_type": entity_type,
        "district_code": target_district,
        "status": status,
        "total_rows": summary["total_rows"],
        "rows_valid": summary["valid_rows"],
        "rows_invalid": summary["invalid_rows"],
        "rows_promoted": summary["promoted_rows"],
        "issues": [issue.to_dict() for issue in issues[:200]],
    }
