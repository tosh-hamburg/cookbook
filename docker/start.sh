#!/usr/bin/env bash
# Startskript des kombinierten App-Containers (Backend + MCP-Server + nginx).
#
# Läuft bei jedem Containerstart: installiert die Abhängigkeiten in die
# Named Volumes, baut alle drei Pakete aus dem eingehängten Quellcode, spielt
# offene Datenbankmigrationen ein und startet dann die drei Prozesse. Stirbt
# einer davon, beendet sich der Container und Docker startet ihn neu.
#
# Portbelegung im Container:
#   nginx    :80    liefert frontend/dist aus und verteilt /api, /mcp, /.well-known/oauth-*
#   backend  :4002  Express-API (zusätzlich nach außen veröffentlicht für api.cookbook.gout-diary.com)
#   mcp      :4003  MCP-Server, nur intern über nginx erreichbar
set -euo pipefail

APP_DIR="${APP_DIR:-/app}"
BACKEND_PORT="${PORT:-4002}"
MCP_PORT="${MCP_HTTP_PORT:-4003}"

log() { printf '\n==> %s\n' "$*"; }

log "Systempakete (nginx für die Auslieferung, openssl für Prisma)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends nginx openssl >/dev/null
rm -rf /var/lib/apt/lists/*

# --include=dev, weil NODE_ENV=production sonst TypeScript/Vite weglässt —
# die werden aber zum Bauen gebraucht.
log "Backend: Abhängigkeiten, Prisma-Client, Build"
cd "$APP_DIR/backend"
npm ci --include=dev --no-audit --no-fund
npx prisma generate
npm run build

log "Backend: offene Migrationen einspielen"
npx prisma migrate deploy

log "MCP-Server: Abhängigkeiten, Build"
cd "$APP_DIR/mcp"
npm ci --include=dev --no-audit --no-fund
npm run build

log "Frontend: Abhängigkeiten, Build"
cd "$APP_DIR/frontend"
npm ci --include=dev --no-audit --no-fund
npm run build

log "nginx konfigurieren"
# Debian-nginx lädt conf.d/*.conf und sites-enabled/*; letzteres bringt einen
# Default-Server auf Port 80 mit, der unserem in die Quere käme.
rm -f /etc/nginx/sites-enabled/default
# Die Synology-Freigabe ist nur per ACL freigegeben; im Container tragen die
# Dateien Modus 000 und sind allein für root lesbar. Debian startet die
# nginx-Worker als www-data - die kämen nicht an frontend/dist heran.
sed -i 's/^user .*;/user root;/' /etc/nginx/nginx.conf
ln -sf "$APP_DIR/frontend/nginx.conf" /etc/nginx/conf.d/default.conf
ln -sf "$APP_DIR/frontend/proxy-headers.inc" /etc/nginx/conf.d/proxy-headers.inc
nginx -t

log "Prozesse starten"
cd "$APP_DIR/backend"
PORT="$BACKEND_PORT" node dist/index.js &
BACKEND_PID=$!

cd "$APP_DIR/mcp"
MCP_HTTP_PORT="$MCP_PORT" node dist/index.js &
MCP_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

shutdown() {
  log "Beende Prozesse"
  kill "$BACKEND_PID" "$MCP_PID" "$NGINX_PID" 2>/dev/null || true
  wait || true
}
trap shutdown TERM INT

# Endet, sobald der erste Prozess stirbt; der Exit-Code ungleich 0 lässt
# Docker (restart: unless-stopped) den Container neu starten.
STATUS=0
wait -n "$BACKEND_PID" "$MCP_PID" "$NGINX_PID" || STATUS=$?
log "Ein Prozess hat sich beendet (Status $STATUS) – Container wird beendet"
shutdown
exit 1
