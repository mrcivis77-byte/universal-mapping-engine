#!/bin/sh
# Runs as /docker-entrypoint.d/40-generate-config.sh inside the nginx
# container (mounted read-only). Regenerates config.json at every boot
# so container restarts always ship the latest config.env values.
set -eu

SRC="${CONFIG_ENV_PATH:-/config.env}"
DEST="/usr/share/nginx/html/config.json"

if [ ! -f "$SRC" ]; then
  echo "[entrypoint] config.env not found at $SRC; skipping config generation"
  exit 0
fi

if [ ! -f "/scripts/generate-config.sh" ]; then
  echo "[entrypoint] generate-config.sh not found; skipping config generation"
  exit 0
fi

sh /scripts/generate-config.sh "$SRC" > "$DEST"
echo "[entrypoint] generated $DEST from $(basename "$SRC")"

sh /scripts/generate-configs.sh
