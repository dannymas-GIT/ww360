#!/usr/bin/env python3
"""Backfill oww_stripe_entitlements from Stripe (read-only restricted key).

Usage:
  cd backend && python ../scripts/stripe/backfill_oww_entitlements.py --dry-run
  cd backend && python ../scripts/stripe/backfill_oww_entitlements.py

Never calls live Stripe in CI — pass --fixture path/to.json for offline runs.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace


def _bootstrap_path() -> None:
    backend = Path(__file__).resolve().parents[2] / "backend"
    sys.path.insert(0, str(backend))


def _fixture_lister(fixture_path: Path):
    raw = json.loads(fixture_path.read_text(encoding="utf-8"))
    subscriptions = raw.get("subscriptions") or raw.get("data") or []

    def list_subscriptions(**kwargs):
        # Single page for fixtures
        return SimpleNamespace(data=subscriptions, has_more=False)

    return list_subscriptions


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill OWW Stripe entitlements")
    parser.add_argument("--dry-run", action="store_true", help="List eligible subs without writing")
    parser.add_argument(
        "--fixture",
        type=str,
        default="",
        help="Offline JSON fixture (CI / local without Stripe key)",
    )
    args = parser.parse_args()
    _bootstrap_path()

    from app.db.database import SessionLocal
    from app.services.stripe_reconcile_service import reconcile_from_stripe

    list_subscriptions = None
    if args.fixture:
        list_subscriptions = _fixture_lister(Path(args.fixture))
    elif not (os.getenv("OWW_STRIPE_RESTRICTED_KEY") or "").strip():
        print(
            "OWW_STRIPE_RESTRICTED_KEY not set. Use --fixture for offline dry-run.",
            file=sys.stderr,
        )
        if args.dry_run:
            # Synthetic empty dry-run still succeeds for CI smoke.
            print(json.dumps({"ok": True, "dry_run": True, "seen": 0, "would_upsert": 0}))
            return 0
        return 2

    db = SessionLocal()
    try:
        stats = reconcile_from_stripe(
            db, dry_run=args.dry_run, list_subscriptions=list_subscriptions
        )
        print(json.dumps({"ok": True, **stats}, default=str))
        return 0 if stats.get("errors", 0) == 0 else 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
