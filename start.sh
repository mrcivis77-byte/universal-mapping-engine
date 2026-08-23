#!/bin/sh
# Start the full RTM stack.
set -eu
cd "$(dirname "$0")"

mkdir -p pb_data pb_hooks pb_migrations config/cloudflare

# Regenerate config.json locally too (mirrors what the nginx entrypoint does)
if [ -f config.env ] && [ -f scripts/generate-config.sh ]; then
  sh scripts/generate-config.sh config.env > pb_public/config.json
fi

docker compose up -d --build
