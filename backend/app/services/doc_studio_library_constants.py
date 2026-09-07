"""External library + custody constants for WW360 Document Studio."""

from __future__ import annotations

from app.models.doc_document import PROGRAM_SCOPE

REMOTE_STUDIO_ROOT_NAME = "WW360 Document Studio"

# Remote folders seeded under the studio root on connect.
CUSTODY_DESTINATION_FOLDERS = (
    "Workforce & succession",
    "Compliance",
    "Operations",
    "Imported",
)

# Local folders whose documents may be custody-transferred.
CUSTODY_ELIGIBLE_FOLDERS = frozenset(
    {
        "Workforce & succession",
        "Compliance",
        "Operations",
    }
)

# Folders that never leave WW360 via custody (tutorials, shift logs, templates, etc.).
CUSTODY_INELIGIBLE_FOLDERS = frozenset(
    {
        "Tutorials",
        "Shift logs",
        "Templates",
        "Training & CE",
        "Training & cohorts",
        "Program briefs",
        "Grant reporting",
        "Outreach",
    }
)


def resolve_owner(scope: str) -> tuple[str, str]:
    """Map studio scope → library owner_type + owner_code."""
    if scope == PROGRAM_SCOPE:
        return "program", PROGRAM_SCOPE
    return "district", scope


def is_custody_transferable_folder(name: str | None) -> bool:
    n = (name or "").strip()
    if not n:
        return False
    if n in CUSTODY_INELIGIBLE_FOLDERS:
        return False
    return n in CUSTODY_ELIGIBLE_FOLDERS
