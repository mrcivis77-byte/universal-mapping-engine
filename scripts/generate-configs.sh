#!/bin/sh
# Generate per-app config JSON files by merging the master config.env with
# each app's override file (config/apps/<app>.env). Overrides win.
# Produces /usr/share/nginx/html/config.<app>.json for each app.
# Busybox/POSIX safe: no arrays, no bashisms.
set -eu

BASE="${CONFIG_BASE_PATH:-/config.env}"
APPS_DIR="${CONFIG_APPS_DIR:-/config/apps}"
OUT_DIR="${1:-/usr/share/nginx/html}"
GENERATE="${GENERATE_SCRIPT:-/scripts/generate-config.sh}"

if [ ! -f "$BASE" ]; then
  echo "[configs] config.env not found at $BASE; skipping app configs"
  exit 0
fi

if [ ! -f "$GENERATE" ]; then
  echo "[configs] generate-config.sh not found; skipping app configs"
  exit 0
fi

apps="${CONFIG_APPS:-bus moto drive fishing parque}"

emit_app() {
  app="$1"
  override="${APPS_DIR}/${app}.env"
  out="${OUT_DIR}/config.${app}.json"

  {
    cat "$BASE"
    if [ -f "$override" ]; then
      cat "$override"
    else
      echo "[configs] no override file $override; using base config only" >&2
    fi
  } | awk -F= '
    $0 !~ /^[[:space:]]*#/ && NF > 1 {
      key=$1
      sub(/^[[:space:]]+/, "", key)
      sub(/[[:space:]]+$/, "", key)
      rest=$0
      sub(/^[^=]*=/, "", rest)
      map[key]=key "=" rest
    }
    END { for (k in map) print map[k] }
  ' | sh "$GENERATE" /dev/stdin > "$out"

  echo "[configs] generated $out"
}

for app in $apps; do
  emit_app "$app"
done
