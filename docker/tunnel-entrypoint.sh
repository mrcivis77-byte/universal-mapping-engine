#!/bin/sh
# Start cloudflared only when a tunnel token is configured.
# CLOUDFLARE_TUNNEL_TOKEN comes from config.env via docker compose env_file.
set -eu

if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  echo "[tunnel] CLOUDFLARE_TUNNEL_TOKEN set; writing credentials from token"
  printf '%s' "${CLOUDFLARE_TUNNEL_TOKEN}" | base64 -d \
    | jq '{AccountTag: .a, TunnelSecret: .s, TunnelID: .t}' \
    > /tmp/cf-credentials.json
  chmod 600 /tmp/cf-credentials.json
  echo "[tunnel] starting cloudflared with local ingress config"
  exec cloudflared tunnel --no-autoupdate --config /etc/cloudflared/config.yml run
fi

# Disabled: keep the container alive (restart: unless-stopped would otherwise
# loop forever on exit) without consuming resources.
echo "[tunnel] CLOUDFLARE_TUNNEL_TOKEN not set; tunnel disabled"
while true; do sleep 3600; done
