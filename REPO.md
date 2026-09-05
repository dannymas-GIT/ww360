# Water Workforce 360 (WW360)

Product repository split from AquaSafe on 2026-09-05.

- **GitHub:** https://github.com/dannymas-GIT/ww360
- **Branches:** `develop` → `staging` → `main`
- **Mission Control profile:** `pipeline/apps/ww360.yaml` in TheHelm
- **Local path:** `/opt/projects/saas-repos/ww360`
- **Deploy dir (VM):** `/opt/projects/ww360`
- **Integration:** AquaSafe remains IdP; see `docs/ww360-integration-contract.md` in TheHelm

Do not commit `.env` or secrets. Production env stays on the host / Key Vault only.

## Staging VM setup (`ww360.aquasafe-solutions.us`)

**Two places for config:**

| Layer | Where | Purpose |
|-------|--------|---------|
| Mission Control | `~/.openclaw/openclaw.env` | Source of truth: `WW360_*`, Azure IDs, integration tokens |
| Runtime on VM | `/opt/projects/ww360/.env` | Docker Compose secrets (synced from openclaw) |

**Deploy from Mission Control** (recommended while `develop` has local fixes):

```bash
bash /opt/projects/workspace/scripts/ww360/deploy-staging.sh
```

**Deploy via git on the VM** (after code is pushed to GitHub):

```bash
ssh azureuser@$WW360_STAGING_HOST
cd /opt/projects/ww360
git fetch origin
git checkout staging   # or develop
git pull origin staging
docker compose -f docker-compose.azure.yml up -d --build
```

**Env only** (no code sync):

```bash
bash /opt/projects/workspace/scripts/ww360/sync-staging-env.sh
```

**Checklist:** DNS A `ww360` → VM IP · certbot for `ww360.aquasafe-solutions.us` · `verify_azure_env.sh` WW360 section · AquaSafe integration → `docs/ww360-aquasafe-staging-env.example`

## Login (interim standalone)

WW360 issues its own JWT until AquaSafe handoff is deployed on staging:

- URL: `https://ww360.aquasafe-solutions.us/login`
- Seed user: `jingrao-aman-OWW` (`platform_admin` + `oww_partner`)
- Set `WW360_SEED_ADMIN_PASSWORD` in `openclaw.env`, then on VM: `docker compose exec backend python scripts/seed_ww360_admin.py`

## Nginx IP whitelist

Same allowlist as AquaSafe staging (Mission Control health + office IPs):

```bash
bash /opt/projects/workspace/scripts/ww360/sync-nginx-whitelist.sh
# On VM after pull:
bash scripts/staging/apply-host-nginx.sh
```

## SDWIS landscape

- Nightly EPA state refresh (03:00 UTC) for `WW360_SDWIS_STATES` (default `NY`)
- On-demand: `POST /api/v1/sdwis/refresh-state?state=NY` (platform_admin)
- Executive dashboard section: `GET /api/v1/sdwis/workforce-insights?state=NY`
- Last verified refresh: **26,704** NY systems (2026-09-05)

## Design system

Primitives live under `frontend/src/components/ww360/` (hero, section, KPI tiles, chips, empty states). Formatters: `frontend/src/lib/format.ts`. Applied across SDWIS, admin, continuity, and OWW executive dashboard. See TheHelm runbook `docs/ww360-extraction-runbook.md` § Design system.

## Document Studio (`/studio`)

Rich-content authoring for the One Water Workforce program (briefs, cohort plans, EPA quarterly narratives, invitations, newsletters). Ported from AquaSafe's studio, scoped to folders + editor + versions + import/export.

- **Backend:** `backend/app/api/v1/endpoints/doc_studio.py` → `/api/v1/doc-studio/*` (access, stats, folders, documents, versions, `export/{markdown|html|pdf|docx}`, import, assets). Service `app/services/doc_studio_service.py`; export/import `app/services/doc_studio_export_service.py` (reportlab PDF, python-docx). Models `app/models/doc_document.py` (`doc_folders`, `doc_documents`, `doc_versions`, `doc_assets`) — schema patched idempotently on startup via `ensure_doc_studio_schema` (no Alembic).
- **Scopes:** program partners + platform admins share the `program` library (default folders seeded on first visit); district users get a per-district library. Authoring roles: `AUTHOR_ROLES`; publishing: `PUBLISH_ROLES`. Feature flag `WW360_DOC_STUDIO_ENABLED` (default true).
- **Saves:** autosave ~2.5s after typing updates the working copy only; **Save** / Ctrl+S cuts a numbered version when content differs from the last version; **Publish** and **Restore** always create versions. Version cap 60 (`MAX_VERSIONS`; publish/restore never pruned).
- **Frontend:** `frontend/src/pages/studio/DocumentStudioPage.tsx` (3-pane), `components/doc-studio/*` (TipTap `StudioEditor`, `FolderTree`, `DocumentList`, `VersionHistoryPanel`, `NewDocumentDialog`), templates `config/studioTemplates.ts`, client `services/docStudioService.ts`. Nav: **Content → Document Studio**.
- **Tours:** reusable `components/ww360/Ww360TourOverlay.tsx` drives both the OWW dashboard tour and the Studio tour (`pages/studio/studioTourContent.ts`; keys `ww360-studio-tour-dismissed` / `-step`). Tour slides scroll `[data-tour]` targets clear of the card.
- **QA:** Playwright `frontend/e2e/doc_studio.spec.ts` (manifest suite `doc-studio`), `test.md` § Document Studio.
