#!/usr/bin/env bash
# Bootstrap WW360 Azure VM (Docker, nginx, certbot, deploy dir).
# Default staging URL: ww360.aquasafe-solutions.us (AquaSafe DNS you control).
# HTTP-first nginx — run certbot after DNS A record points at this VM.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/projects/ww360}"
DOMAIN="${DOMAIN:-ww360.aquasafe-solutions.us}"

sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git

sudo usermod -aG docker "$USER" || true
sudo mkdir -p "$DEPLOY_DIR" /var/log/nginx /var/www/html
sudo chown -R "$USER:$USER" "$DEPLOY_DIR"

# HTTP-only until Let's Encrypt cert exists (certbot --nginx upgrades this vhost)
sudo tee "/etc/nginx/sites-available/${DOMAIN}" >/dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location /api/ {
        proxy_pass http://127.0.0.1:8002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

sudo ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "Bootstrap complete for ${DOMAIN}."
echo "Next:"
echo "  1. DNS A record: ${DOMAIN} -> $(curl -sS -H Metadata:true --connect-timeout 2 http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text 2>/dev/null || echo '<this-vm-public-ip>')"
echo "  2. sudo certbot --nginx -d ${DOMAIN}"
echo "  3. clone ww360 repo to ${DEPLOY_DIR} and docker compose -f docker-compose.azure.yml up -d"
