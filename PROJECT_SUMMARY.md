# Universal Real-Time Mapping Engine - Project Summary

A single Docker-based codebase that powers local community apps across Mexico:
mototaxi/bus transit tracking, fishing vessel monitoring, and travel maps with
cultural attractions and crowd-sourced hidden gems. Each town deploys its own
node, configured only through `config.env`.

## Architecture

```
frontend (Nginx)
  |- serves pb_public/ (index.html, js/, css/, locales/, images/)
  |- serves /config.json  (generated from config.env by generate-config.sh)
  |- proxies /api -> backend:8090  (includes PocketBase REST + realtime)
  '- /health + /config.json no-cache
backend (PocketBase, ghcr.io/muchobien/pocketbase)
  |- REST + realtime over the /api route
  |- pb_hooks/: 00_bootstrap.pb.js (superuser bootstrap), rtm_api.pb.js
  |    (/api/rtm/health, /api/rtm/combined, /api/rtm/config)
  '- volumes: pb_data, pb_public, pb_hooks, pb_migrations
setup (Node, one-shot)  -> creates collections via setup-pocketbase.mjs
heartbeat (Node)        -> POSTs node state to CENTRAL_REGISTRY_URL/api/heartbeat
tunnel (cloudflared)    -> optional public exposure when CLOUDFLARE_TUNNEL_TOKEN set
```

Images are multi-arch (x86_64 and arm64), so the same stack runs on an Ubuntu
mini-PC or a Raspberry Pi 4/5.

## Frontend modules (pb_public/js)

- `config.js` - loads `/config.json` into `window.APP_CONFIG`, exposes `RTM_CONFIG_READY`
- `i18n.js` - Spanish / English / Maya translations (es.json, en.json, maya.json)
- `map.js` - Leaflet map, tile providers, SVG markers, bounds, marker pooling
- `realtime.js` - PocketBase SDK (0.26.0, jsdelivr) + WebSocket subscriptions
- `handoff.js` - live cross-town hand-off via the central registry `nearest-town` API
- `travel-map.js` - theme-park styling, cultural attraction markers, proximity alerts
- `hidden-gems.js` - long-press gem submission with photo upload, gem listing

## Database (collections)

towns, users, drivers, vessels, hidden_gems, attractions, network_stats.
Relations: drivers/vessels/hidden_gems/attractions/network_stats -> towns;
hidden_gems -> drivers/vessels; attractions -> hidden_gem. All public read rules;
owners can update their own records. `config/schema/pocketbase-schema.json`
documents the shape; `scripts/setup-pocketbase.mjs` creates it.

## Configuration pipeline

`config.env` -> `scripts/generate-config.sh` -> `pb_public/config.json`
(generated again by the frontend container at boot via docker/nginx-entrypoint.sh).

Key settings: `APP_TYPE` (transit|fishing|travel), `TOWN_NAME/TOWN_ID`,
map center/bounds, `WELCOME_MESSAGE`, `PUBLIC_URL`, `API_BASE_URL` (empty =
same-origin via the nginx proxy), `CENTRAL_REGISTRY_URL`, Cloudflare tunnel
token, `PB_SUPERUSER_EMAIL/PASSWORD`, `DEFAULT_LANGUAGE`, `ENABLE_*` toggles,
performance and rate-limit knobs.

## Deploy

```bash
./scripts/start.sh      # regenerate config.json, build, start all services
./scripts/stop.sh
./scripts/logs.sh
```

Raspberry Pi: `scripts/raspberry-pi/setup.sh` plus the `mapping-engine` init
script (heartbeat and tunnel now run as containers, so no host services needed).

Central registry: `central-hub/` is a reference FastAPI + SQLite implementation
of `POST /api/heartbeat`, `GET /api/towns`, `POST /api/nearest-town`, intended
for yucatanmx.com.

## Status

Code complete and ready for deployment. Pending: remote deployment to the
MR.C77HUB PC (192.168.1.85) after Docker is installed there.
