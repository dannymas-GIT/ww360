#!/usr/bin/env bash
# Deploy infra/azure/main.bicep to an existing resource group (network, VM, storage, Key Vault, ACR).
# Prerequisites: az login, WW360 subscription selected, resource group created, SSH public key.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE="$REPO_ROOT/infra/azure/main.bicep"

RG="${RG:-ww360-staging-rg}"
ENVIRONMENT="${ENVIRONMENT:-staging}"
NAME_PREFIX="${NAME_PREFIX:-ww360}"
SSH_KEY_FILE="${SSH_PUBLIC_KEY_FILE:-$HOME/.ssh/id_ed25519.pub}"
if [[ ! -f "$SSH_KEY_FILE" ]]; then
  SSH_KEY_FILE="${SSH_PUBLIC_KEY_FILE:-$HOME/.ssh/id_rsa.pub}"
fi
VM_SIZE="${VM_SIZE:-Standard_D2s_v5}"
KV_OBJECT_ID="${KEY_VAULT_ACCESS_POLICY_OBJECT_ID:-}"
SSH_SOURCE_ADDRESS_PREFIX="${SSH_SOURCE_ADDRESS_PREFIX:-*}"

if [[ ! -f "$SSH_KEY_FILE" ]]; then
  echo "error: SSH public key not found (set SSH_PUBLIC_KEY_FILE)" >&2
  exit 1
fi

SSH_KEY="$(cat "$SSH_KEY_FILE")"

EXTRA=()
if [[ -n "$KV_OBJECT_ID" ]]; then
  EXTRA+=(--parameters "keyVaultAccessPolicyObjectId=$KV_OBJECT_ID")
fi

echo "Deploying to RG=$RG environment=$ENVIRONMENT prefix=$NAME_PREFIX vmSize=$VM_SIZE"
az deployment group create \
  --resource-group "$RG" \
  --template-file "$TEMPLATE" \
  --parameters \
    environment="$ENVIRONMENT" \
    namePrefix="$NAME_PREFIX" \
    sshPublicKey="$SSH_KEY" \
    vmSize="$VM_SIZE" \
    sshSourceAddressPrefix="$SSH_SOURCE_ADDRESS_PREFIX" \
  "${EXTRA[@]}"

echo "Done. Outputs: vmPublicFqdn, vmPublicIp, storageAccountName, keyVaultUri, acrLoginServer, acrName"
