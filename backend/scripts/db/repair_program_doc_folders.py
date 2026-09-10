#!/usr/bin/env python3
"""Repair Document Studio docs whose folder_id points at deleted folders.

Maps known sample titles (and title heuristics) into the live program:{state}
folder tree so docs show up inside folders again.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))

from app.db.database import SessionLocal, init_db  # noqa: E402
from app.models.doc_document import DocDocument, DocFolder, program_scope_for_state  # noqa: E402
from app.services.doc_studio_seeds import folders_for_scope  # noqa: E402

# Exact titles from seed_doc_studio_samples.py → folder name
TITLE_TO_FOLDER: dict[str, str] = {
    "Sample — Capital Region workforce brief (Q3)": "Program briefs",
    "Sample — Statewide quarterly update (FY26 Q1)": "Program briefs",
    "Sample — Regional workforce brief": "Program briefs",
    "Sample — Albany Grade II spring cohort plan": "Training & cohorts",
    "Sample — Distribution CE renewal course outline": "Training & cohorts",
    "Sample — EPA Area 3 quarterly narrative (FY26 Q1)": "Grant reporting",
    "Sample — Success story: Maria from Rensselaer County": "Grant reporting",
    "Sample — Invitation: Village of Hudson Falls": "Outreach",
    "Sample — Partner newsletter (September)": "Outreach",
    "Sample — Job profile: Grade II Treatment Operator": "Outreach",
    "Sample — How to enroll a utility in WW360": "Tutorials",
    "Sample — SOP: Weekly distribution flushing check": "Operations",
    "Sample — Succession memo: Chief Operator (Finger Lakes)": "Operations",
    "Sample — Meeting notes: Training calendar sync": "Operations",
    "Sample — New hire onboarding checklist": "Operations",
    "Sample — Board workforce update": "Operations",
    "Sample — Shift handoff notes": "Operations",
    "Sample — Daily rounds log": "Operations",
    "Sample — Annual CE & training plan": "Training & cohorts",
    "Sample — Filter backwash SOP": "Operations",
    # NJ demo seeds
    "Central Jersey workforce brief (sample)": "Program briefs",
    "Woodbridge succession cohort plan (sample)": "Training & cohorts",
}


def _guess_folder(title: str) -> str:
    if title in TITLE_TO_FOLDER:
        return TITLE_TO_FOLDER[title]
    t = title.lower()
    if any(k in t for k in ("brief", "quarterly update", "statewide")):
        return "Program briefs"
    if any(k in t for k in ("cohort", "course", "training", "ceu", "ce ")):
        return "Training & cohorts"
    if any(k in t for k in ("epa", "grant", "success story", "narrative")):
        return "Grant reporting"
    if any(k in t for k in ("invitation", "newsletter", "job profile", "outreach")):
        return "Outreach"
    if any(k in t for k in ("tutorial", "how to", "enroll")):
        return "Tutorials"
    if "template" in t:
        return "Templates"
    return "Operations"


def _ensure_folders(db, scope: str) -> dict[str, str]:
    existing = {
        f.name: f.id
        for f in db.query(DocFolder).filter(DocFolder.scope == scope).all()
    }
    for idx, (name, desc) in enumerate(folders_for_scope(scope)):
        if name in existing:
            continue
        folder = DocFolder(
            scope=scope,
            name=name,
            description=desc,
            sort_order=idx,
            is_system=True,
        )
        db.add(folder)
        db.flush()
        existing[name] = folder.id
        print(f"  created folder {scope}/{name!r}")
    return existing


def repair(scope: str, dry_run: bool = False) -> None:
    init_db()
    db = SessionLocal()
    try:
        folders = _ensure_folders(db, scope)
        live_ids = set(folders.values())
        docs = db.query(DocDocument).filter(DocDocument.scope == scope).all()
        fixed = 0
        for doc in docs:
            if doc.folder_id and doc.folder_id in live_ids:
                continue
            folder_name = _guess_folder(doc.title or "")
            new_id = folders.get(folder_name) or folders.get("Operations")
            print(
                f"  refile {doc.title!r}: {doc.folder_id!r} → {folder_name!r} ({new_id})"
            )
            if not dry_run and new_id:
                doc.folder_id = new_id
                fixed += 1
            elif dry_run:
                fixed += 1
        if not dry_run:
            db.commit()
        print(f"Refiled {fixed} documents under {scope}.")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", default="NY", help="State code for program:{state} scope")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    repair(program_scope_for_state(args.state), dry_run=args.dry_run)


if __name__ == "__main__":
    main()
