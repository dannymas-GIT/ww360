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
