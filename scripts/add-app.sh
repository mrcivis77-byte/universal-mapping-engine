#!/usr/bin/env bash
# ============================================================
# add-app.sh — add a new transit app to the Universal Mapping Engine
#
# Creates a new app end-to-end across every touchpoint, so an app can
# never be "half-added" (the drive bug: nginx had it, tunnel didn't).
#
# Touchpoints covered:
#   1. config/apps/<app>.env           override file
#   2. scripts/generate-configs.sh     app list
#   3. config/nginx/default.conf       nginx server block
#   4. config/cloudflared/config.yml   tunnel ingress route
#   5. pb_public/config.<app>.json     generated config
#   6. pb_public/images/marker-<app>.svg   map marker
#   7. pb_public/landing/index.html    portal card
#   8. pb_public/js/dashboard.js       dashboard app entry
#   9. pb_public/js/map.js             icon registration
#  10. pb_public/locales/{en,es}.json  dashboard label
#
# Usage:
#   ./scripts/add-app.sh drive [options]
#
# Options:
#   --domain <host>     public hostname (default: <app>.yucatanmx.com)
#   --title <name>      landing card title (default: capitalized app id)
#   --desc <text>       landing card description
#   --vehicle <type>    TRANSIT_VEHICLE_TYPES (default: <app>)
#   --welcome <msg>     welcome message
#   --img <path>        landing image (default: images/<app>.png)
#   --deploy            scp files to the server and restart the stack
#   --host <ip>         server ip for --deploy (default: 192.168.1.75)
#   --user <user>       server user for --deploy (default: mcivis77)
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

# ------------------------------------------------------------
# Parse args
# ------------------------------------------------------------
APP=""
DOMAIN=""
TITLE=""
DESC=""
VEHICLE=""
WELCOME=""
IMG=""
DEPLOY=0
HOST="192.168.1.75"
USER="mcivis77"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)  DOMAIN="$2";  shift 2 ;;
    --title)   TITLE="$2";   shift 2 ;;
    --desc)    DESC="$2";    shift 2 ;;
    --vehicle) VEHICLE="$2"; shift 2 ;;
    --welcome) WELCOME="$2"; shift 2 ;;
    --img)     IMG="$2";     shift 2 ;;
    --deploy)  DEPLOY=1;     shift ;;
    --host)    HOST="$2";    shift 2 ;;
    --user)    USER="$2";    shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' ; exit 0 ;;
    *)
      if [[ -z "$APP" ]]; then APP="$1"; shift;
      else echo "Unknown arg: $1"; exit 1; fi ;;
  esac
done

if [[ -z "$APP" ]]; then
  echo "ERROR: app id required. Usage: ./scripts/add-app.sh <app> [options]"; exit 1
fi

# Validate app id (alphanumeric only, no dots/spaces)
if ! [[ "$APP" =~ ^[a-z0-9_-]+$ ]]; then
  echo "ERROR: app id must be lowercase alphanumeric (got: '$APP')"; exit 1
fi

# Defaults derived from app id
DOMAIN="${DOMAIN:-$APP.yucatanmx.com}"
TITLE="${TITLE:-${APP^}}"
VEHICLE="${VEHICLE:-$APP}"
WELCOME="${WELCOME:-Bienvenido a ${APP^} de Merida}"
IMG="${IMG:-images/$APP.png}"
DESC="${DESC:-Servicio de transporte en tiempo real}"

# Server-side paths
SRV="~/$USER/universal-mapping-engine"

# ------------------------------------------------------------
# Guard: refuse to clobber an existing app
# ------------------------------------------------------------
if [[ -f "config/apps/$APP.env" ]]; then
  echo "ERROR: app '$APP' already exists (config/apps/$APP.env). Aborting."
  exit 1
fi

echo "==> Adding app: $APP (domain: $DOMAIN, vehicle: $VEHICLE)"

# ------------------------------------------------------------
# 1. App override file
# ------------------------------------------------------------
cat > "config/apps/$APP.env" <<EOF
# $TITLE app overrides (merged over config.env by generate-configs.sh)
APP_TYPE=transit
TRANSIT_VEHICLE_TYPES=$VEHICLE
WELCOME_MESSAGE="$WELCOME"
ENABLE_HIDDEN_GEMS=false
ENABLE_PROXIMITY_ALERTS=false
APP_ID=$APP
EOF
echo "   1. config/apps/$APP.env  -> created"

# ------------------------------------------------------------
# 2. generate-configs.sh app list
# ------------------------------------------------------------
if ! grep -q "\b$APP\b" scripts/generate-configs.sh; then
  sed -i "s/^apps=\"\${CONFIG_APPS:-\\(.*\\)}\"/apps=\"\${CONFIG_APPS:-\1 $APP}\"/" scripts/generate-configs.sh
  echo "   2. scripts/generate-configs.sh -> added $APP"
else
  echo "   2. scripts/generate-configs.sh -> already present"
fi

# ------------------------------------------------------------
# 3. nginx server block (insert before '# Fishing app')
# ------------------------------------------------------------
if ! grep -q "server_name $DOMAIN" config/nginx/default.conf; then
  python3 - "$DOMAIN" "$APP" <<'PY'
import sys, io
host, app = sys.argv[1], sys.argv[2]
p = 'config/nginx/default.conf'
s = open(p).read()
block = f"""
# {app.title()} app
server {{
    listen 80;
    server_name {host};
    root /usr/share/nginx/html;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location = /config.json {{
        alias /usr/share/nginx/html/config.{app}.json;
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }}

    location / {{
        try_files $uri $uri/ /index.html;
    }}

    include /etc/nginx/conf.d/rtm-snippet;
}}
"""
marker = "\n# Fishing app"
assert marker in s, "marker not found"
s = s.replace(marker, block + marker, 1)
open(p, 'w').write(s)
PY
  echo "   3. config/nginx/default.conf -> added $DOMAIN"
else
  echo "   3. config/nginx/default.conf -> already present"
fi

# ------------------------------------------------------------
# 4. tunnel ingress route
# ------------------------------------------------------------
if ! grep -q "hostname: $DOMAIN" config/cloudflared/config.yml; then
  python3 - "$DOMAIN" <<'PY'
import sys
host = sys.argv[1]
p = 'config/cloudflared/config.yml'
s = open(p).read()
entry = f"""  - hostname: {host}
    service: http://nginx_frontend:80
"""
marker = "  - hostname: fishing.yucatanmx.com"
assert marker in s, "marker not found"
s = s.replace(marker, entry + marker, 1)
open(p, 'w').write(s)
PY
  echo "   4. config/cloudflared/config.yml -> added $DOMAIN"
else
  echo "   4. config/cloudflared/config.yml -> already present"
fi

# ------------------------------------------------------------
# 5. Generate config.<app>.json (same pipeline as server boot)
# ------------------------------------------------------------
{
  cat config.env
  cat "config/apps/$APP.env"
} | awk -F= '
  $0 !~ /^[[:space:]]*#/ && NF > 1 {
    key=$1; sub(/^[[:space:]]+/, "", key); sub(/[[:space:]]+$/, "", key);
    rest=$0; sub(/^[^=]*=/, "", rest);
    map[key]=key "=" rest
  }
  END { for (k in map) print map[k] }
' | sh scripts/generate-config.sh /dev/stdin > "pb_public/config.$APP.json"
echo "   5. pb_public/config.$APP.json -> generated"

# ------------------------------------------------------------
# 6. Map marker SVG (drive-style blue car; override with your own)
# ------------------------------------------------------------
if [[ ! -f "pb_public/images/marker-$APP.svg" ]]; then
  cat > "pb_public/images/marker-$APP.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="30" fill="#2563eb"/>
  <circle cx="32" cy="32" r="30" fill="none" stroke="#ffffff" stroke-width="3"/>
  <path d="M14 42l3.5-10a4 4 0 0 1 3.8-2.8h21.4a4 4 0 0 1 3.8 2.8l3.5 10" fill="#fef3c7"/>
  <rect x="18" y="31" width="6" height="6" rx="1" fill="#1f2937"/>
  <rect x="30" y="31" width="6" height="6" rx="1" fill="#1f2937"/>
  <rect x="42" y="31" width="6" height="6" rx="1" fill="#1f2937"/>
  <circle cx="18" cy="46" r="4" fill="#1f2937"/>
  <circle cx="46" cy="46" r="4" fill="#1f2937"/>
</svg>
SVG
  echo "   6. pb_public/images/marker-$APP.svg -> created (placeholder)"
else
  echo "   6. pb_public/images/marker-$APP.svg -> already present"
fi

# ------------------------------------------------------------
# 7. Landing page card
# ------------------------------------------------------------
if ! grep -q "https://$DOMAIN" pb_public/landing/index.html; then
  python3 - "$APP" "$DOMAIN" "$IMG" "$TITLE" "$DESC" <<'PY'
import sys
app, host, img, title, desc = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
p = 'pb_public/landing/index.html'
s = open(p).read()
card = f'''
            <a class="card" href="https://{host}">
                <img src="/{img}" alt="" />
                <h2>{title}</h2>
                <p>{desc}</p>
            </a>
'''
marker = '            <a class="card" href="https://fishing.yucatanmx.com">'
assert marker in s, "marker not found"
s = s.replace(marker, card + marker, 1)
open(p, 'w').write(s)
PY
  echo "   7. pb_public/landing/index.html -> added $TITLE card"
else
  echo "   7. pb_public/landing/index.html -> already present"
fi

# ------------------------------------------------------------
# 8. Dashboard app entry
# ------------------------------------------------------------
if ! grep -q "id: '$APP'" pb_public/js/dashboard.js; then
  python3 - "$APP" <<'PY'
import sys
app = sys.argv[1]
p = 'pb_public/js/dashboard.js'
s = open(p).read()
# insert alphabetically-ish before the fishing entry
entry = f"    {{ id: '{app}', color: '#8b5cf6' }},\n"
marker = "    { id: 'fishing', color: '#0ea5e9' },\n"
assert marker in s, "marker not found"
s = s.replace(marker, entry + marker, 1)
open(p, 'w').write(s)
PY
  echo "   8. pb_public/js/dashboard.js -> added $APP"
else
  echo "   8. pb_public/js/dashboard.js -> already present"
fi

# ------------------------------------------------------------
# 9. map.js icon registration
# ------------------------------------------------------------
if ! grep -q "$APP: {" pb_public/js/map.js; then
  python3 - "$APP" <<'PY'
import sys
app = sys.argv[1]
p = 'pb_public/js/map.js'
s = open(p).read()
entry = f"""                {app}: {{
                    iconUrl: '/images/marker-{app}.svg',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                    popupAnchor: [0, -18]
                }},
"""
marker = "                customer: {"
assert marker in s, "marker not found"
s = s.replace(marker, entry + marker, 1)
open(p, 'w').write(s)
PY
  echo "   9. pb_public/js/map.js -> added $APP icon"
else
  echo "   9. pb_public/js/map.js -> already present"
fi

# ------------------------------------------------------------
# 10. Locale labels (en.json, es.json)
# ------------------------------------------------------------
for lang in en es; do
  if ! grep -q "app_$APP" "pb_public/locales/$lang.json"; then
    python3 - "$lang" "$APP" "$TITLE" <<'PY'
import sys, json
lang, app, title = sys.argv[1], sys.argv[2], sys.argv[3]
p = f'pb_public/locales/{lang}.json'
d = json.load(open(p))
# give each language a sensible label
label = title if lang == 'en' else title
d.setdefault('dashboard', {})['app_' + app] = label
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2)
open(p, 'a').write('\n')
PY
    echo "  10. pb_public/locales/$lang.json -> added app_$APP"
  else
    echo "  10. pb_public/locales/$lang.json -> already present"
  fi
done

echo
echo "==> Local changes complete for app '$APP'."
echo "    To go live, deploy to the server:"
echo "      ./scripts/add-app.sh $APP --deploy"

# ------------------------------------------------------------
# Deploy
# ------------------------------------------------------------
if [[ "$DEPLOY" == "1" ]]; then
  echo
  echo "==> Deploying to $USER@$HOST ..."
  FILES=(
    "config/apps/$APP.env"
    "scripts/generate-configs.sh"
    "config/nginx/default.conf"
    "config/cloudflared/config.yml"
    "pb_public/config.$APP.json"
    "pb_public/images/marker-$APP.svg"
    "pb_public/landing/index.html"
    "pb_public/js/dashboard.js"
    "pb_public/js/map.js"
    "pb_public/locales/en.json"
    "pb_public/locales/es.json"
  )
  for f in "${FILES[@]}"; do
    # preserve relative structure on the server
    rel="${f#*/}"   # strip leading ./ (already relative)
    ssh "$USER@$HOST" "mkdir -p \"$SRV/${rel%/*}\""
    scp "$f" "$USER@$HOST:$SRV/$rel"
    echo "   - $rel"
  done

  echo
  echo "==> Restarting stack on $HOST ..."
  ssh "$USER@$HOST" "cd $SRV && docker compose up -d --build"
  echo
  echo "==> Restarting tunnel for new DNS route ..."
  ssh "$USER@$HOST" "cd $SRV && docker compose restart tunnel"

  echo
  echo "==> Verifying https://$DOMAIN/config.json ..."
  sleep 10
  curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://$DOMAIN/config.json" || echo "(could not reach from here)"
  echo
  echo "==> App '$APP' deployed. Check the Cloudflare dashboard to confirm the DNS record for $DOMAIN exists."
fi