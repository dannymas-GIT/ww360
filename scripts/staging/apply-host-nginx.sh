#!/usr/bin/env bash
# Apply WW360 host nginx (staging VM). Run from repo root after git pull.
# Optional: WHITELIST_SRC=path/to/aquasafe-staging-ip-whitelist.conf

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

DOMAIN="${WW360_APP_DOMAIN:-ww360.aquasafe-solutions.us}"
WHITELIST_DEST="/etc/nginx/snippets/aquasafe-staging-ip-whitelist.conf"

if [[ -n "${WHITELIST_SRC:-}" && -f "$WHITELIST_SRC" ]]; then
  sudo cp "$WHITELIST_SRC" "$WHITELIST_DEST"
  echo "Installed whitelist from WHITELIST_SRC"
elif [[ ! -f "$WHITELIST_DEST" ]]; then
  sudo cp nginx/snippets/aquasafe-staging-ip-whitelist.conf.example "$WHITELIST_DEST"
  echo "Installed whitelist template — edit $WHITELIST_DEST to add office IPs."
fi

SITE="ww360-staging"
EXAMPLE="nginx/sites-available/ww360-staging.conf.example"
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [[ -f "$EXAMPLE" ]]; then
  sudo cp "$EXAMPLE" "/etc/nginx/sites-available/$SITE"
  if [[ -f "$CERT" ]]; then
    sudo ln -sf "/etc/nginx/sites-available/$SITE" "/etc/nginx/sites-enabled/$SITE"
    echo "Enabled $SITE (TLS cert present)."
  else
    echo "Cert not found at $CERT — enable site manually after certbot."
  fi
fi

sudo mkdir -p /var/www/html/.well-known/acme-challenge
sudo nginx -t
sudo systemctl reload nginx
echo "WW360 host nginx reloaded."
