#!/usr/bin/env bash
# Import workforce dump into WW360 Postgres.
set -euo pipefail

IN="${1:?Usage: import_workforce_to_ww360.sh dump.sql}"
WW_HOST="${WW_POSTGRES_HOST:-127.0.0.1}"
WW_PORT="${WW_POSTGRES_PORT:-5434}"
WW_USER="${WW_POSTGRES_USER:-ww360}"
WW_DB="${WW_POSTGRES_DB:-ww360}"

export PGPASSWORD="${WW_POSTGRES_PASSWORD:?Set WW_POSTGRES_PASSWORD}"
psql -h "$WW_HOST" -p "$WW_PORT" -U "$WW_USER" -d "$WW_DB" -f "$IN"
echo "Import complete. Run verify_workforce_parity.py next."
