#!/usr/bin/env bash
# Bootstrap WW360 Azure VM (Docker, nginx, certbot, deploy dir).
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/projects/ww360}"
DOMAIN="${DOMAIN:-staging.waterworkforce360.org}"

sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git

sudo usermod -aG docker "$USER" || true
sudo mkdir -p "$DEPLOY_DIR" /var/log/nginx
sudo chown -R "$USER:$USER" "$DEPLOY_DIR"

# Host nginx terminates TLS; containers bind localhost only (see docker-compose.azure.yml)
sudo tee "/etc/nginx/sites-available/${DOMAIN}" >/dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} waterworkforce360.org www.waterworkforce360.org;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl http2;
    server_name ${DOMAIN} waterworkforce360.org www.waterworkforce360.org;
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:8002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

echo "Bootstrap complete. Next:"
echo "  1. sudo certbot certonly --nginx -d ${DOMAIN}"
echo "  2. sudo ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/"
echo "  3. clone ww360 repo to ${DEPLOY_DIR} and docker compose up"
