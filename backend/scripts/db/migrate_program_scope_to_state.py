#!/usr/bin/env python3
"""Migrate legacy Document Studio ``program`` scope to ``program:NY``.

Handles the common case where ``program:NY`` already has empty default folders
(created on first visit) while sample docs still live under legacy ``program``.

Steps:
  1. Ensure default folders exist under program:NY
  2. Remap each legacy document's folder_id to the NY folder with the same name
  3. Update scope on documents / versions / assets / library tables
  4. Delete leftover empty legacy ``program`` folders
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))

from sqlalchemy import text  # noqa: E402

from app.db.database import SessionLocal, init_db  # noqa: E402
from app.models.doc_document import (  # noqa: E402
    DocAsset,
    DocDocument,
    DocFolder,
    program_scope_for_state,
)
from app.services.doc_studio_seeds import folders_for_scope  # noqa: E402

LEGACY = "program"
TARGET = program_scope_for_state("NY")

# Only tables that actually have a document-studio `scope` column.
# (doc_library_connections.scopes is OAuth scopes text, not program scope.)
OTHER_TABLES = (
    "doc_custody_transfers",
)


def _ensure_target_folders(db, dry_run: bool) -> dict[str, str]:
    """Return name → folder_id for TARGET scope, creating defaults if needed."""
    existing = {
        f.name: f.id
        for f in db.query(DocFolder).filter(DocFolder.scope == TARGET).all()
    }
    for idx, (name, desc) in enumerate(folders_for_scope(TARGET)):
        if name in existing:
            continue
        print(f"  create folder {TARGET}/{name!r}")
        if dry_run:
            existing[name] = f"dry-run-{name}"
            continue
        folder = DocFolder(
            scope=TARGET,
            name=name,
            description=desc,
            sort_order=idx,
            is_system=True,
            created_by=None,
        )
        db.add(folder)
        db.flush()
        existing[name] = folder.id
    return existing


def migrate(dry_run: bool = False) -> None:
    init_db()
    db = SessionLocal()
    try:
        legacy_docs = (
            db.query(DocDocument).filter(DocDocument.scope == LEGACY).all()
        )
        legacy_folders = {
            f.id: f
            for f in db.query(DocFolder).filter(DocFolder.scope == LEGACY).all()
        }
        print(f"Legacy scope {LEGACY!r}: {len(legacy_folders)} folders, {len(legacy_docs)} docs")
        print(f"Target scope {TARGET!r}")

        target_folders = _ensure_target_folders(db, dry_run=dry_run)

        moved = 0
        for doc in legacy_docs:
            old_folder = legacy_folders.get(doc.folder_id) if doc.folder_id else None
            new_folder_id = None
            if old_folder and old_folder.name in target_folders:
                new_folder_id = target_folders[old_folder.name]
            elif target_folders:
                # Fallback: first program folder
                new_folder_id = next(iter(target_folders.values()))

            print(
                f"  doc {doc.title!r}: folder "
                f"{old_folder.name if old_folder else None!r} → "
                f"{new_folder_id}"
            )
            if dry_run:
                moved += 1
                continue

            doc.scope = TARGET
            if new_folder_id and not str(new_folder_id).startswith("dry-run-"):
                doc.folder_id = new_folder_id

            # doc_versions has no scope column; assets do.
            db.query(DocAsset).filter(DocAsset.document_id == doc.id).update(
                {"scope": TARGET}, synchronize_session=False
            )
            moved += 1

        # Remap any orphan assets still on legacy scope
        if not dry_run:
            db.execute(
                text("UPDATE doc_assets SET scope = :t WHERE scope = :l"),
                {"t": TARGET, "l": LEGACY},
            )

        for table in OTHER_TABLES:
            try:
                if dry_run:
                    count = db.execute(
                        text(f"SELECT COUNT(*) FROM {table} WHERE scope = :l"),
                        {"l": LEGACY},
                    ).scalar()
                    print(f"  {table}: would update {count} rows")
                else:
                    result = db.execute(
                        text(f"UPDATE {table} SET scope = :t WHERE scope = :l"),
                        {"t": TARGET, "l": LEGACY},
                    )
                    print(f"  {table}: updated {result.rowcount} rows")
            except Exception as exc:
                print(f"  {table}: skipped ({exc})")

        # Drop leftover empty legacy folders (docs already remapped)
        if not dry_run:
            for folder in list(legacy_folders.values()):
                still = (
                    db.query(DocDocument)
                    .filter(DocDocument.folder_id == folder.id)
                    .count()
                )
                if still == 0:
                    print(f"  delete empty legacy folder {folder.name!r}")
                    db.delete(folder)
            # Any remaining legacy folders: force-rename scope if somehow still referenced
            db.execute(
                text("UPDATE doc_folders SET scope = :t WHERE scope = :l"),
                {"t": TARGET, "l": LEGACY},
            )
            # Deduplicate folders with same name under TARGET (keep oldest / prefer system)
            rows = db.query(DocFolder).filter(DocFolder.scope == TARGET).order_by(DocFolder.created_at).all()
            seen: dict[str, str] = {}
            for f in rows:
                if f.name not in seen:
                    seen[f.name] = f.id
                    continue
                keep_id = seen[f.name]
                print(f"  merge duplicate folder {f.name!r}: {f.id} → {keep_id}")
                db.query(DocDocument).filter(DocDocument.folder_id == f.id).update(
                    {"folder_id": keep_id}, synchronize_session=False
                )
                db.delete(f)

            db.commit()

        print(f"Moved {moved} documents to {TARGET}. Done.")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
