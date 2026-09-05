#!/usr/bin/env python3
"""Verify workforce data parity between AquaSafe and WW360 after migration."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from typing import Any

import httpx
import psycopg2

WORKFORCE_TABLES = [
    "workforce_positions",
    "workforce_employees",
    "workforce_certifications",
    "workforce_critical_functions",
    "workforce_role_coverage",
    "workforce_succession_candidates",
    "workforce_knowledge_artifacts",
    "workforce_transition_milestones",
    "workforce_planning_sessions",
    "workforce_import_batches",
    "workforce_ceu_records",
    "workforce_ceu_vouchers",
    "workforce_training_courses",
    "workforce_scheduled_trainings",
    "workforce_training_enrollments",
    "workforce_training_sync_logs",
    "workforce_organizations",
    "organization_district_memberships",
]


def table_checksum(conn, table: str) -> tuple[int, str]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM {table}")  # noqa: S608
        count = cur.fetchone()[0]
        cur.execute(f"SELECT md5(string_agg(t::text, '')) FROM (SELECT * FROM {table} ORDER BY 1) t")  # noqa: S608
        row = cur.fetchone()
        digest = row[0] if row and row[0] else hashlib.md5(b"").hexdigest()
    return count, digest


def compare_dbs(aq_dsn: str, ww_dsn: str) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    aq = psycopg2.connect(aq_dsn)
    ww = psycopg2.connect(ww_dsn)
    try:
        for table in WORKFORCE_TABLES:
            try:
                aq_count, aq_sum = table_checksum(aq, table)
                ww_count, ww_sum = table_checksum(ww, table)
            except Exception as exc:
                issues.append({"table": table, "error": str(exc)})
                continue
            if aq_count != ww_count or aq_sum != ww_sum:
                issues.append(
                    {
                        "table": table,
                        "aquasafe": {"count": aq_count, "checksum": aq_sum},
                        "ww360": {"count": ww_count, "checksum": ww_sum},
                    }
                )
    finally:
        aq.close()
        ww.close()
    return issues


def sample_api_parity(aq_url: str, ww_url: str, district: str) -> dict[str, Any]:
    with httpx.Client(timeout=30.0) as client:
        aq = client.get(f"{aq_url.rstrip('/')}/api/v1/workforce-succession/continuity/{district}")
        ww = client.get(f"{ww_url.rstrip('/')}/api/v1/districts/{district}/workforce-summary")
    return {
        "aquasafe_status": aq.status_code,
        "ww360_status": ww.status_code,
        "ww360_body": ww.json() if ww.status_code == 200 else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--aquasafe-dsn", required=True)
    parser.add_argument("--ww360-dsn", required=True)
    parser.add_argument("--aquasafe-url", default="http://127.0.0.1:8001")
    parser.add_argument("--ww360-url", default="http://127.0.0.1:8002")
    parser.add_argument("--district", default="WW360")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    issues = compare_dbs(args.aquasafe_dsn, args.ww360_dsn)
    api = sample_api_parity(args.aquasafe_url, args.ww360_url, args.district)
    report = {"table_issues": issues, "api_sample": api, "ok": len(issues) == 0}

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Table mismatches: {len(issues)}")
        for item in issues:
            print(f"  - {item}")
        print(f"API sample: {api}")

    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
