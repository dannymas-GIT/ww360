#!/usr/bin/env bash
# Export workforce domain data from AquaSafe Postgres (run during freeze window).
set -euo pipefail

AQ_HOST="${AQ_POSTGRES_HOST:-127.0.0.1}"
AQ_PORT="${AQ_POSTGRES_PORT:-5433}"
AQ_USER="${AQ_POSTGRES_USER:-aquasafeuser}"
AQ_DB="${AQ_POSTGRES_DB:-aquasafe}"
OUT="${1:-/tmp/ww360-workforce-data.sql}"

export PGPASSWORD="${AQ_POSTGRES_PASSWORD:?Set AQ_POSTGRES_PASSWORD}"

TABLES=(
  workforce_positions workforce_employees workforce_certifications
  workforce_critical_functions workforce_role_coverage workforce_succession_candidates
  workforce_knowledge_artifacts workforce_transition_milestones workforce_planning_sessions
  workforce_import_batches workforce_ceu_records workforce_ceu_vouchers
  workforce_training_courses workforce_scheduled_trainings workforce_training_enrollments
  workforce_training_sync_logs workforce_organizations organization_district_memberships
)

ARGS=()
for t in "${TABLES[@]}"; do ARGS+=(-t "$t"); done

pg_dump -h "$AQ_HOST" -p "$AQ_PORT" -U "$AQ_USER" -d "$AQ_DB" --data-only "${ARGS[@]}" > "$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT") bytes)"
