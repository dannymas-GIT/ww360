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

### Demo accounts (national + NJ)

```bash
docker compose exec backend python scripts/seed_national_nj_demo.py
# optional: WW360_SEED_NATIONAL_PASSWORD / WW360_SEED_NJ_PASSWORD
```

| Username | Default password | Role | Dashboard to try |
|----------|------------------|------|------------------|
| `ww360-national` | `ChangeMe-National!` | `platform_admin` | Executive overview + **Primacy state** switcher (NY ↔ NJ) + Admin → Jurisdictions |
| `nj-state-admin` | `ChangeMe-NJ!` | `state_admin` | NJ executive overview / landscape (pack-driven copy) + `program:NJ` Document Studio |
| `wb-admin` | `ChangeMe-NJ!` | `district_admin` | Woodbridge district home, continuity vacancy (MAINT-1), admin alerts |
| `wb-manager` | `ChangeMe-NJ!` | `workforce_manager` | Continuity succession board, documentation **review queue**, CE renewals |
| `wb-operator-1` | `ChangeMe-NJ!` | `workforce_operator` | Operator home, CEU log, assigned documentation tasks |

Demo district: **WBWD** — Township of Woodbridge Water Department (NJ). Includes positions, employees, critical functions, succession candidates, CEU, certifications, notifications, and NJ program Studio samples.

### Persona switcher (impersonation)

```bash
docker compose exec backend python scripts/seed_demo_personas.py
# optional: WW360_SEED_DEMO_PASSWORD (default ChangeMe-Demo!)
```

Jenny (`jingrao-aman-OWW`) and other platform/state admins see **View as role** in the app shell. Read-only **preview** is default; **act-as** (writes allowed, audited) requires `platform_admin` + reason.

**Kitchen Sink** (sidebar toggle, default **off**): simplified role workspace with KPIs, charts, Document Studio, and a guided **Role tour**. Turn on to reveal the full navigation and executive tool set.

| Tier | Example username | Default home (preview) |
|------|------------------|------------------------|
| National | `us-epa-workforce-lead`, `aquasafe-admin` | `/national` simplified workspace |
| Regional | `epa-r2-opcert-coordinator` | `/national` or `/dashboard` |
| State partner | `jingrao-aman-OWW`, `ny-nysawwa-executive` | `/dashboard` simplified OWW story |
| Regulator | `ny-doh-opcert-manager` | `/dashboard` + OpCert panel |
| Utility | `hf-operator-1`, `mcwa-chief-operator` | District / operator home |

**Data modes:** every KPI/chart shows **Live**, **Sample** (illustrative demo pack), or **Mixed**. Live public adapters (SDWIS, BLS, national API) take precedence when fresh; illustrative packs (`frontend/src/data/demoMetrics/`) fill gaps and are labeled with source ids.

### Customize home (panel library)

Available to **all authenticated roles**. Sidebar **Customize home** opens the panel library (building blocks — not “widgets”).

- **API:** `GET /api/v1/workspace/modules`, `GET|PUT|DELETE /api/v1/workspace/layout`
- Layouts are stored in Postgres (`workspace_customizations`) per user + workspace profile (+ optional persona key).
- Preview mode can browse the library but cannot save; exit preview first.
- Guided tour covers: identify KPIs → match to panels → save.

### Federal job listings (USAJOBS)

Available to **all authenticated users** via sidebar **Careers → Job openings** (`/jobs`).

- **Page:** Multi-source careers hub — USAJOBS live today; OWW job board and utility Continuity vacancies marked coming soon
- **API:** `GET /api/v1/jobs/federal?state=NY&limit=12`
- **Source:** [USAJOBS Search API](https://developer.usajobs.gov/) — federal announcements only
- **Env:** `USAJOBS_API_KEY` and `USAJOBS_USER_AGENT` (email used when requesting the key) in `openclaw.env`, synced to VM `.env`

Request a free API key at https://developer.usajobs.gov/APIRequest/Index . Without the key, the UI shows a configuration notice (no fabricated listings).

APIs: `GET /api/v1/impersonation/personas`, `POST /impersonation/start`, `POST /impersonation/stop`, `GET /impersonation/sessions` (audit, platform_admin).

### National KPI layer

- **Frontend:** `/national` (US overview), `/national/states/:st` (state scorecard). Nav **National → US overview** for `platform_admin` and `national_observer`.
- **API:** `GET /api/v1/national/overview`, `GET /national/states/{st}`, `GET /state/{st}/workforce`, `GET /state/{st}/continuity`, `GET/POST/PATCH /kpis`, `GET /kpis/brief.pdf`
- **Data:** EPA ECHO SDWA bulk nightly (`WW360_SDWIS_STATES=ALL`), BLS/Projections Central labor, NYSDOH operator roster (aggregate), DWSRF allotments YAML, Grants.gov pipeline, LCRR/UCMR curated metrics.
- **Scheduler:** SDWIS 03:00 UTC, national metrics 04:00 UTC.

### Microsoft / Google SSO (login + Document Studio drives)

Login supports **Continue with Microsoft** and **Continue with Google** when OAuth apps are configured. Consent requests identity **and** drive scopes in one flow; successful SSO:

1. Matches an **existing** WW360 user by email (no auto-provision — invite users first and set `users.email`).
2. Mints the WW360 JWT.
3. Upserts a `DocLibraryConnection` for the user's Studio scope so External library / custody can reuse the same refresh token (no second connect for that provider).

**Env** (same apps as Document Studio; optional `AUTH_SSO_*` overrides):

| Variable | Purpose |
|----------|---------|
| `DOC_STUDIO_MS_CLIENT_ID` / `SECRET` / `TENANT_ID` | Microsoft Entra app (SSO + OneDrive/SharePoint) |
| `DOC_STUDIO_GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth client (SSO + Drive) |
| `AUTH_SSO_REDIRECT_URI` | Optional; default `https://<APP_DOMAIN>/login` |

Register redirect URIs on each IdP:

- SSO: `https://ww360.aquasafe-solutions.us/login` (and local `http://localhost:…/login`)
- Studio library connect (still supported): `https://ww360.aquasafe-solutions.us/studio`

APIs: `GET /api/v1/auth/sso/providers`, `GET /api/v1/auth/sso/auth-url`, `POST /api/v1/auth/sso/callback`.

## Nginx IP whitelist

Same allowlist as AquaSafe staging (Mission Control health + office IPs):

```bash
bash /opt/projects/workspace/scripts/ww360/sync-nginx-whitelist.sh
# On VM after pull:
bash scripts/staging/apply-host-nginx.sh
```

## SDWIS landscape

- Nightly EPA refresh (03:00 UTC) for `WW360_SDWIS_STATES` (default **`ALL`** — bulk ECHO download with per-state API fallback)
- National metrics refresh (04:00 UTC): labor market, DWSRF, NY roster aggregates, KPI snapshots
- On-demand: `POST /api/v1/sdwis/refresh-state?state=NY` (platform_admin)
- Executive dashboard section: `GET /api/v1/sdwis/workforce-insights?state=NY`

## Design system

Primitives live under `frontend/src/components/ww360/` (hero, section, KPI tiles, chips, empty states). Formatters: `frontend/src/lib/format.ts`. Applied across SDWIS, admin, continuity, and OWW executive dashboard. See TheHelm runbook `docs/ww360-extraction-runbook.md` § Design system.

## Document Studio (`/studio`)

Rich-content authoring for the One Water Workforce program (briefs, cohort plans, EPA quarterly narratives, invitations, newsletters). Ported from AquaSafe's studio, scoped to folders + editor + versions + import/export + **external cloud libraries** (OneDrive/SharePoint, Google Drive, Dropbox) with custody transfer.

- **Backend:** `backend/app/api/v1/endpoints/doc_studio.py` → `/api/v1/doc-studio/*` (access, stats, folders, documents, versions, `export/{markdown|html|pdf|docx}`, import, assets, **`/library/*`**, **`/custody/*`**). Service `app/services/doc_studio_service.py`; export/import `app/services/doc_studio_export_service.py` (reportlab PDF, python-docx). External providers `app/services/external_library_provider.py`; custody `app/services/doc_custody_service.py` + `doc_custody_policy.py`. Models `app/models/doc_document.py` (`doc_folders`, `doc_documents`, `doc_versions`, `doc_assets`, **`doc_library_connections`**, **`doc_external_refs`**, **`doc_custody_*`**) — schema patched idempotently on startup via `ensure_doc_studio_schema` (no Alembic). OAuth tokens encrypted via Fernet keyed from `JWT_SECRET_KEY` (`app/utils/token_encryption.py`).
- **Scopes:** state-keyed program libraries (`program:NY`, `program:NJ`, …) for `state_admin` / `oww_partner` + platform admins; district users get a per-district library. Legacy `program` scope migrates to `program:NY` via `backend/scripts/db/migrate_program_scope_to_state.py`. Authoring roles: `AUTHOR_ROLES`; publishing: `PUBLISH_ROLES`; custody transfer: `CUSTODY_TRANSFER_ROLES` (publishers + district/workforce managers). Feature flag `WW360_DOC_STUDIO_ENABLED` (default true).
- **External libraries:** Connect OneDrive/SharePoint, Google Drive, or Dropbox from **External library** (authors). Browse/import/link files; set default folder for custody. Remote root folder **WW360 Document Studio** with subfolders Workforce & succession, Compliance, Operations, Imported. **Transfer custody** (managers/partners) uploads eligible docs to connected storage after policy acknowledgment; local bytes purged after retention window (`POST /custody/purge-due` for scheduled purge).
- **OAuth env (staging/production in `openclaw.env`, synced by `scripts/ww360/sync-staging-env.sh`):** `DOC_STUDIO_MS_CLIENT_ID`, `DOC_STUDIO_MS_CLIENT_SECRET`, `DOC_STUDIO_MS_TENANT_ID` (default `common`), `DOC_STUDIO_GOOGLE_CLIENT_ID`, `DOC_STUDIO_GOOGLE_CLIENT_SECRET`, `DOC_STUDIO_DROPBOX_APP_KEY`, `DOC_STUDIO_DROPBOX_APP_SECRET`, optional `DOC_STUDIO_OAUTH_REDIRECT_URI` (default `https://<APP_DOMAIN>/studio`), optional `AUTH_SSO_REDIRECT_URI` (default `https://<APP_DOMAIN>/login`). Register **both** `/login` (SSO) and `/studio` (library-only connect) redirect URIs with Microsoft and Google. SSO login reuses the same client secrets and seeds `DocLibraryConnection` from the login tokens.
- **Saves:** autosave ~2.5s after typing updates the working copy only; **Save** / Ctrl+S cuts a numbered version when content differs from the last version; **Publish** and **Restore** always create versions. Version cap 60 (`MAX_VERSIONS`; publish/restore never pruned).
- **Frontend:** `frontend/src/pages/studio/DocumentStudioPage.tsx` (3-pane), `components/doc-studio/*` (TipTap `StudioEditor`, `FolderTree`, `DocumentList`, `VersionHistoryPanel`, `NewDocumentDialog`, `TutorialPlayer`), `components/tutorial/*` (recorder session, step editor, annotator), `context/TutorialRecorderContext.tsx`, templates `config/studioTemplates.ts`, client `services/docStudioService.ts`. Nav: **Content → Document Studio**.
- **Tutorial Studio:** Authors use **Record tutorial** (header) to capture walkthroughs in five modes — screen, screen + camera, camera, voice-only, or **screenshots-only** (WW360 addition). Flow: record → review/edit steps + annotations → AI generate guide (`POST /api/v1/doc-studio/tutorials/generate`) → publish as `doc_type: tutorial` with `tutorial_data` JSONB (steps, optional video asset). In-editor `TutorialPlayer` for playback; re-record updates the open tutorial doc.
- **Tours:** reusable `components/ww360/Ww360TourOverlay.tsx` drives both the OWW dashboard tour and the Studio tour (`pages/studio/studioTourContent.ts`; keys `ww360-studio-tour-dismissed` / `-step`). Tour slides scroll `[data-tour]` targets clear of the card. Studio tour includes Record tutorial + recording modes slides.
- **QA:** Playwright `frontend/e2e/doc_studio.spec.ts` (manifest suite `doc-studio`), `test.md` § Document Studio.

## National platform + state primacy (Phase 1, 2026-09)

Shared SaaS deployment with **national** `platform_admin` and **state primacy** orgs (`workforce_organizations.state_code`). Content packs live in `backend/app/jurisdictions/packs/{ST}.yaml` (exec/landscape/landing/tour copy). NY labor/CEU (Subpart 5-4, DOH-352) unchanged.

| Role | Scope |
|------|--------|
| `platform_admin` | All states; state switcher in app shell; Admin → Jurisdictions |
| `state_admin` | One org / state; exec + landscape + `program:{state}` Doc Studio |
| `oww_partner` | Compat alias for NY `state_admin` |

- **API:** `GET /api/v1/jurisdictions`, `GET /api/v1/jurisdictions/{state}/pack`, `POST /api/v1/auth/active-state`, `GET/PATCH /api/v1/admin/jurisdictions/*`
- **Public landing:** `GET /api/v1/public/ww360/jurisdictions/{state}/pack` + `/?state=NJ`
- **Seeds:** `python backend/scripts/db/seed_jurisdiction_orgs.py` (NY_OWW + NJ stub + demo `nj-state-admin`)
- **Migrate Doc Studio scope:** `python backend/scripts/db/migrate_program_scope_to_state.py`
- **QA:** `frontend/e2e/jurisdiction_primacy.spec.ts`

## Hudson Falls mock district (HFWD)

Demo NY utility for district role UX, documentation tasks, and manager review queue.

- **Seed:** `python backend/scripts/seed_hudson_falls_district.py` (env `WW360_SEED_DISTRICT_PASSWORD`, default `ChangeMe-HFWD!`).
- **Users:** `hf-admin`, `hf-manager`, `hf-operator-1`, `hf-operator-2` — all bound to district `HFWD` via `users.district_memberships`.
- **Dashboards:** `/dashboard` lands on district manager or operator home by role; OWW partners still see the executive dashboard.
- **Documentation tasks:** `POST /api/v1/documentation-tasks/*` — auto-created when primary/backup role coverage is assigned to a linked operator. Operators submit tutorials for review (`review_state=submitted`); managers approve/publish.
- **Notifications:** in-app bell + email (`EMAIL_ENABLED`) via daily APScheduler job; workforce alert scanner fills cert/retirement/CEU alerts.
- **QA:** Playwright `frontend/e2e/district_roles.spec.ts` (manifest suite `district-roles`).

## Digital reach (`/analytics`)

GA4 site traffic + Search Console organic SEO for three properties: **Water Workforce 360** (self), **onewaterworkforce.org**, and **Learning Stream**. OWW and Learning Stream use rich illustrative fixtures until live adapters connect; WW360 can overlay live GA4 when configured.

- **Frontend:** `frontend/src/pages/analytics/DigitalReachPage.tsx` — property tabs, range picker (30d / quarter / 12mo), KPI rows, trend charts, channels, pages, queries, geo, conversions, insights. Executive dashboard teaser at `[data-tour="digital-teaser"]` links here. Nav: **Reporting → Digital reach**.
- **Client instrumentation:** `frontend/src/lib/ga4.ts` loads gtag only when `VITE_GA4_MEASUREMENT_ID` is set at build time. Events: `page_view` (SPA routes + public landing), `access_request_submitted`, `tour_completed`, `sdwis_viewed`, `studio_published`. **No PII** in event params.
- **Backend:** `GET /api/v1/analytics/digital?property=&range=` and `GET /api/v1/analytics/digital/teaser` (partner/admin). Fixtures in `app/services/digital_analytics_fixtures.py`; optional live WW360 GA block via `GA4_PROPERTY_ID` + `GA4_ACCESS_TOKEN` (`app/services/ga4_data_service.py`).
- **Env (optional live WW360 GA4):** `VITE_GA4_MEASUREMENT_ID` (frontend build), `GA4_PROPERTY_ID`, `GA4_ACCESS_TOKEN` (backend Data API bearer). Verify Search Console for the public host separately; SEO fixtures cover the Jenny walkthrough until GSC is wired.
- **Privacy:** IP-whitelisted staging may run without a cookie banner. Before enabling Measurement ID on public `waterworkforce360.org`, add consent appropriate for NY/state ownership transfer.
- **QA:** Playwright `frontend/e2e/digital_reach.spec.ts` (manifest suite `digital-reach`), `test.md` § Digital Reach Analytics.
