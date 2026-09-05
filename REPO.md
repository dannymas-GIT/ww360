# Water Workforce 360 (WW360)

Product repository split from AquaSafe on 2026-09-05.

- **GitHub:** https://github.com/dannymas-GIT/ww360
- **Branches:** `develop` → `staging` → `main`
- **Mission Control profile:** `pipeline/apps/ww360.yaml` in TheHelm
- **Local path:** `/opt/projects/saas-repos/ww360`
- **Deploy dir (VM):** `/opt/projects/ww360`
- **Integration:** AquaSafe remains IdP; see `docs/ww360-integration-contract.md` in TheHelm

Do not commit `.env` or secrets. Production env stays on the host / Key Vault only.
