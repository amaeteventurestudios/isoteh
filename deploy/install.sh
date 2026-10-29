#!/usr/bin/env bash
# Runs on the shared server (sent by .github/workflows/deploy.yml). Installs the ad server next to the games without
# touching their code or data:
#   - its own Node in /opt/isoteh-node, code in /opt/isoteh/app, service isoteh on 127.0.0.1:8400
#   - data (the database and ad images) in /var/lib/isoteh, backed up nightly to /var/backups/isoteh (14 days kept)
#   - settings and secrets in /etc/isoteh/isoteh.env (made once on the server; never in the repo or in chat)
#   - its web address in the shared Caddy: ADS_DOMAIN once that name points here, and always ads.<server-ip>.sslip.io
# Optional keys arrive in /tmp/isoteh-keys.env (from GitHub secrets) and are moved into the env file. Safe to run again.
set -euo pipefail
APP=/opt/isoteh/app NODE_DIR=/opt/isoteh-node ETC=/etc/isoteh ENVF=/etc/isoteh/isoteh.env DATA=/var/lib/isoteh PORT=8400 NODE_V=v22.22.0
HOST_IP=${HOST_IP:?}
SPARE="ads.${HOST_IP//./-}.sslip.io" MAIN_DNS=${ADS_DOMAIN:-}

id isoteh >/dev/null 2>&1 || sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin isoteh
case "$(uname -m)" in aarch64|arm64) NARCH=arm64 ;; *) NARCH=x64 ;; esac
if [ "$("$NODE_DIR/bin/node" --version 2>/dev/null)" != "$NODE_V" ]; then
  curl -fsSL "https://nodejs.org/dist/$NODE_V/node-$NODE_V-linux-$NARCH.tar.xz" -o /tmp/bb-node.tar.xz
  sudo rm -rf "$NODE_DIR" && sudo mkdir -p "$NODE_DIR" && sudo tar -xJf /tmp/bb-node.tar.xz -C "$NODE_DIR" --strip-components=1 && rm -f /tmp/bb-node.tar.xz
fi
sudo rm -rf "$APP.new" && sudo mkdir -p "$APP.new" && sudo tar -xzf /tmp/isoteh.tgz -C "$APP.new" && rm -f /tmp/isoteh.tgz
sudo rm -rf "$APP.old"; [ -d "$APP" ] && sudo mv "$APP" "$APP.old"; sudo mv "$APP.new" "$APP"; sudo rm -rf "$APP.old"
sudo chown -R root:root "$APP" && sudo chmod -R go-w "$APP"
sudo install -d -m 750 -o isoteh -g isoteh "$DATA"

sudo install -d -m 750 -o root -g isoteh "$ETC"
if ! sudo test -f "$ENVF"; then
  sudo install -m 640 -o root -g isoteh /dev/null "$ENVF"
  sudo tee "$ENVF" >/dev/null <<ENV
# The ad server on this server. Made by deploy/install.sh; secrets stay here (never in the repo or in chat).
ISOTEH_ENV=production
ISOTEH_SECRET=$(openssl rand -hex 32)
ISOTEH_HOST=127.0.0.1
ISOTEH_PORT=$PORT
ISOTEH_DATA=$DATA
ENV
fi
setkv() { sudo sed -i "/^$1=/d" "$ENVF"; printf '%s=%s\n' "$1" "$2" | sudo tee -a "$ENVF" >/dev/null; }
NAMES=("$SPARE")
[ -n "$MAIN_DNS" ] && [ "$(getent ahostsv4 "$MAIN_DNS" 2>/dev/null | awk 'NR==1{print $1}')" = "$HOST_IP" ] && NAMES=("$MAIN_DNS" "$SPARE")
setkv ISOTEH_PUBLIC_URL "https://${NAMES[0]}"
if [ -f /tmp/isoteh-keys.env ]; then
  while IFS='=' read -r k v; do [ -n "$v" ] && setkv "$k" "$v"; done < <(grep -E '^(ISOTEH_BRAND|ISOTEH_ADMIN_EMAIL|ISOTEH_PAY_INSTRUCTIONS|ISOTEH_FEE_BPS|PAYSTACK_SECRET_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET)=' /tmp/isoteh-keys.env || true)
  rm -f /tmp/isoteh-keys.env
fi

sudo tee /etc/systemd/system/isoteh.service >/dev/null <<UNIT
[Unit]
Description=Isoteh ad server
After=network.target
[Service]
User=isoteh
Group=isoteh
EnvironmentFile=$ENVF
WorkingDirectory=$APP
ExecStart=$NODE_DIR/bin/node --experimental-sqlite --disable-warning=ExperimentalWarning $APP/server.mjs
Restart=always
RestartSec=2
MemoryMax=512M
CPUQuota=50%
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
UNIT

# nightly backup: SQLite's own online copy plus the ad images
sudo install -d -m 750 /var/backups/isoteh
sudo tee /etc/cron.daily/isoteh-backup >/dev/null <<'CRON'
#!/bin/sh
set -e
D=$(date +%F); B=/var/backups/isoteh
/opt/isoteh-node/bin/node --experimental-sqlite --disable-warning=ExperimentalWarning -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/var/lib/isoteh/isoteh.db').exec(\"VACUUM INTO '$B/isoteh-$D.db'\")"
tar -czf "$B/creatives-$D.tgz" -C /var/lib/isoteh creatives 2>/dev/null || true
find "$B" -type f -mtime +14 -delete
CRON
sudo chmod 755 /etc/cron.daily/isoteh-backup

# the shared Caddy: one site file of our own
if [ -d /etc/caddy/sites ]; then
  printf '%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:%s\n}\n' "$(IFS=,; echo "${NAMES[*]}" | sed 's/,/, /g')" "$PORT" | sudo tee /etc/caddy/sites/isoteh.caddy >/dev/null
  sudo systemctl reload caddy || true
fi

sudo systemctl daemon-reload
sudo systemctl enable --now isoteh
sudo systemctl restart isoteh
for i in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://127.0.0.1:$PORT/healthz" && echo " isoteh up at https://${NAMES[0]}"
