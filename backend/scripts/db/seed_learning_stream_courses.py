#!/usr/bin/env python3
"""Seed mock Learning Stream catalog courses and optional district sessions."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal
from app.services.workforce_succession.learning_stream_seed import (
    seed_learning_stream_catalog,
    seed_learning_stream_district_sessions,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Learning Stream mock training courses")
    parser.add_argument(
        "--district",
        help="Also create district scheduled sessions for this district code (e.g. WW360)",
    )
    args = parser.parse_args()
    db = SessionLocal()
    try:
        added, updated = seed_learning_stream_catalog(db)
        sessions = 0
        if args.district:
            sessions = seed_learning_stream_district_sessions(
                db, district_code=args.district.strip()
            )
        print(
            f"Learning Stream seed complete: catalog +{added}/~{updated}, "
            f"district_sessions={sessions}"
        )
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
