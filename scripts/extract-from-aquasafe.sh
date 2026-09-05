#!/usr/bin/env bash
# Extract WW360 + workforce domain files from AquaSafe git refs (read-only).
set -euo pipefail

AQ_REPO="${AQ_REPO:-/opt/projects/aquasafeV2}"
AQ_REF="${AQ_REF:-origin/host/staging-ww360}"
WW_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

extract() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  if git -C "$AQ_REPO" cat-file -e "${AQ_REF}:${src}" 2>/dev/null; then
    git -C "$AQ_REPO" show "${AQ_REF}:${src}" > "$dest"
    echo "  + $src"
  else
    echo "  skip (missing): $src" >&2
  fi
}

echo "Extracting from ${AQ_REPO}@${AQ_REF} -> ${WW_ROOT}"

# Backend — workforce domain
for f in \
  backend/app/models/workforce_succession.py \
  backend/app/models/workforce_organization.py \
  backend/app/services/workforce_succession/__init__.py \
  backend/app/services/workforce_succession/alert_scanner.py \
  backend/app/services/workforce_succession/analytics.py \
  backend/app/services/workforce_succession/ceu_requirements.py \
  backend/app/services/workforce_succession/ceu_service.py \
  backend/app/services/workforce_succession/crud_service.py \
  backend/app/services/workforce_succession/doh352_service.py \
  backend/app/services/workforce_succession/importer.py \
  backend/app/services/workforce_succession/learning_stream_seed.py \
  backend/app/services/workforce_succession/operator_scope.py \
  backend/app/services/workforce_succession/planning_session_service.py \
  backend/app/services/workforce_succession/scheduled_training_service.py \
  backend/app/services/workforce_succession/training_catalog_regions.py \
  backend/app/services/workforce_succession/training_enrollment_service.py \
  backend/app/services/workforce_succession/training_scraper.py \
  backend/app/services/workforce_succession/workforce_alert_settings.py \
  backend/app/services/workforce_succession/workforce_training_settings.py \
  backend/app/api/endpoints/workforce_crud_routes.py \
  backend/app/api/endpoints/workforce_succession.py \
  backend/app/api/v1/endpoints/ww360_public.py \
  backend/app/db/base_class.py \
  backend/scripts/db/seed_oww_partner_exec.py \
  backend/scripts/db/seed_learning_stream_courses.py \
  backend/scripts/db/seed_ny_oww_organization.py
do
  extract "$f" "${WW_ROOT}/$f"
done

# Frontend — WW360 + OWW + continuity entry
for f in \
  frontend/src/pages/workforce360/Workforce360AccessForm.tsx \
  frontend/src/pages/workforce360/Workforce360Landing.css \
  frontend/src/pages/workforce360/Workforce360Landing.tsx \
  frontend/src/pages/workforce360/ww360LandingSlides.ts \
  frontend/src/pages/oww/OwwExecutiveDashboard.tsx \
  frontend/src/pages/oww/OwwTourOverlay.tsx \
  frontend/src/pages/oww/owwMockData.ts \
  frontend/src/pages/oww/owwPrivileges.ts \
  frontend/src/pages/oww/owwTourContent.ts \
  frontend/src/pages/WorkforceContinuityPage.tsx \
  frontend/src/utils/brandHost.ts \
  frontend/e2e/oww_exec_dashboard.spec.ts
do
  extract "$f" "${WW_ROOT}/$f"
done

# Public assets
for f in \
  frontend/public/workforce-360-logo.png \
  frontend/public/workforce-360-favicon.png
do
  git -C "$AQ_REPO" show "${AQ_REF}:${f}" > "${WW_ROOT}/$f" 2>/dev/null && echo "  + $f (binary)" || true
done

# Nginx template
extract nginx/sites-available/waterworkforce360-staging.conf.example \
  "${WW_ROOT}/nginx/sites-available/waterworkforce360-staging.conf.example"

echo "Done. Review and run apply_preflight_overlay from mission-control if needed."
