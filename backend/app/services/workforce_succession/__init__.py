"""Workforce succession service package.

Modules in this package implement the AquaSafe Workforce Continuity Service
described in ``docs/workforce_succession/``: CSV intake with district-aligned
staging, continuity analytics, and certification-expiration alert scanning.
"""

from .importer import (
    ENTITY_TYPES,
    ENTITY_TYPE_ORDER,
    WorkforceImportError,
    import_workforce_csv,
    ingest_workforce_rows,
    preview_workforce_csv,
)
from .analytics import compute_continuity_response
from .alert_scanner import ScanResult, scan_all_districts, scan_district
from .planning_session_service import (
    PlanningSessionConflict,
    PlanningSessionNotFound,
    abandon_planning_session,
    create_planning_session,
    get_active_draft,
    get_or_create_planning_session,
    get_planning_session,
    list_planning_sessions,
    parse_session_payload,
    publish_planning_session,
    update_planning_session,
    validate_planning_session,
)

__all__ = [
    "ENTITY_TYPES",
    "ENTITY_TYPE_ORDER",
    "WorkforceImportError",
    "import_workforce_csv",
    "ingest_workforce_rows",
    "preview_workforce_csv",
    "compute_continuity_response",
    "ScanResult",
    "scan_district",
    "scan_all_districts",
    "PlanningSessionConflict",
    "PlanningSessionNotFound",
    "abandon_planning_session",
    "create_planning_session",
    "get_active_draft",
    "get_or_create_planning_session",
    "get_planning_session",
    "parse_session_payload",
    "list_planning_sessions",
    "publish_planning_session",
    "update_planning_session",
    "validate_planning_session",
]
