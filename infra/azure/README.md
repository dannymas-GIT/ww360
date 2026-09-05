# AquaSafe Azure Infrastructure (Bicep)

Modular Bicep templates for AquaSafe environments. Deploy from repo root or from this directory.

**Which subscription?** V2 staging and V2 production should use **separate** Azure subscriptions for accounting—see [docs/architecture/AZURE_SUBSCRIPTION_MAP.md](../../docs/architecture/AZURE_SUBSCRIPTION_MAP.md). Run `az account set --subscription ...` before each deployment.

## Modules

| Module      | Purpose |
|------------|---------|
| `modules/network.bicep`  | VNet, subnet, NSG (SSH restricted, HTTP/HTTPS allowed) |
| `modules/vm.bicep`       | Ubuntu VM with public IP (Docker host) |
| `modules/storage.bicep`  | Storage account + `aquasafe-backups` container |
| `modules/keyvault.bicep` | Key Vault for secrets |
| `modules/acr.bicep`      | Azure Container Registry |
| `modules/postgres.bicep` | PostgreSQL Flexible Server (Phase 3; requires delegated subnet) |

## Deploy (main: network + VM + storage + Key Vault + ACR)

**Wrapper script** (from repo root, after `az login`):

```bash
export RG=aquasafe-staging-rg ENVIRONMENT=staging NAME_PREFIX=aquasafe
./scripts/azure/deploy-main.sh
```

Or manually:

```bash
# From infra/azure or repo root
az deployment group create \
  --resource-group aquasafe-staging-rg \
  --template-file main.bicep \
  --parameters environment=staging namePrefix=aquasafe sshPublicKey="$(cat ~/.ssh/id_rsa.pub)"
```

Validate templates locally without Azure auth (Docker):

```bash
docker run --rm -v "$(pwd)/infra/azure:/work" -w /work mcr.microsoft.com/azure-cli az bicep build --file main.bicep
```

Optional parameters: `sshSourceAddressPrefix` (e.g. `100.64.0.0/10` for Tailscale), `vmSize`, `keyVaultAccessPolicyObjectId`.

## CI: push images to ACR

After ACR exists, add GitHub secrets `AZURE_CREDENTIALS` and `ACR_LOGIN_SERVER`, then use [`.github/workflows/build-push-acr.yml`](../../.github/workflows/build-push-acr.yml) (runs on push to `staging` / `main` or manual dispatch).

## Postgres (Phase 3)

PostgreSQL Flexible Server requires a **delegated subnet**. `main-with-postgres.bicep` wires `network-with-pg-subnet` + `postgres` module. Deploy with `./scripts/azure/deploy-with-postgres.sh` (see [PHASE3_MANAGED_POSTGRES_RUNBOOK.md](../../docs/architecture/PHASE3_MANAGED_POSTGRES_RUNBOOK.md)).

## Outputs

After deployment:

- `vmPublicFqdn` / `vmPublicIp`: SSH and point your domain here.
- `storageAccountName`: Use in backup script (`AZURE_STORAGE_ACCOUNT`).
- `keyVaultUri`: Set `AZURE_KEY_VAULT_URL` in app config.
- `acrLoginServer`: Use for `docker push` and in compose (image pull).
