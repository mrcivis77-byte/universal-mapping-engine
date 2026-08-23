# Universal Real-Time Mapping Engine

A modular, reusable mapping platform for local community apps in Mexico: mototaxi
and bus transit, fishing boat tracking, and travel maps with hidden gems and
cultural attractions. One codebase, configured per town through a single
`config.env` file, deployed with Docker Compose (PocketBase + Nginx + Node).

## Features

- Multi-app support: transit, fishing, travel from one codebase
- Real-time GPS tracking with smooth marker updates (PocketBase realtime/WebSocket)
- Cross-town hand-off: when a traveler leaves one town's bounds, the map live-switches
  to the nearest town network without a page reload
- Cultural attraction proximity alerts (Mayan pyramids, Olmec heads, cenotes, ...)
- Crowd-sourced hidden gems with image uploads
- Lightweight JS i18n for Spanish, English and Maya
- One-command deployment via Docker Compose
- Runs on x86 servers and ARM64 Raspberry Pi (Docker images are multi-arch)

## Quick start

### Prerequisites

- Docker Engine 24+ with the Compose plugin
- A web browser with geolocation for the live GPS features

### Run

```bash
cd universal-mapping-engine
./scripts/start.sh
```

That regenerates `pb_public/config.json` from `config.env`, builds the images and
starts `backend` (PocketBase), `frontend` (Nginx), `setup` (one-shot collection
creation), `heartbeat` (announces this node to the central registry) and, if you
set a Cloudflare token, `tunnel`.

Open http://localhost in your browser.

Useful helpers:

```bash
./scripts/stop.sh          # stop everything
./scripts/logs.sh          # follow all logs
docker compose run --rm setup   # re-run PocketBase collection setup
```

## Configuration

Everything is driven by `config.env`. The shell script `scripts/generate-config.sh`
publishes a safe subset of it as `pb_public/config.json`, which the frontend reads
at boot (`pb_public/js/config.js`).

Key settings:

| Key | Purpose |
| --- | --- |
| `APP_TYPE` | `transit`, `fishing` or `travel` |
| `TOWN_NAME`, `TOWN_ID` | Identity of this node |
| `INITIAL_LATITUDE`, `INITIAL_LONGITUDE`, `MAP_ZOOM_LEVEL` | Initial map view |
| `MAX_BOUNDS` | `sw_lat,sw_lng,ne_lat,ne_lng`; restricts map rendering and hand-off region |
| `WELCOME_MESSAGE` | Banner shown to travelers entering the zone |
| `PUBLIC_URL` | Public URL of this node (tunnel/custom domain) |
| `API_BASE_URL` | PocketBase base URL; empty = same origin via the Nginx `/api` proxy |
| `CENTRAL_REGISTRY_URL` | Central hub base URL; the heartbeat posts to `/api/heartbeat` |
| `CLOUDFLARE_TUNNEL_ID`, `CLOUDFLARE_TUNNEL_TOKEN` | Public exposure via Cloudflare Tunnel (token is optional) |
| `PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD` | PocketBase superuser used by the setup container |
| `DEFAULT_LANGUAGE` | `es`, `en` or `maya` |
| `CULTURAL_LANDMARKS` | Single-line JSON array of fixed landmarks on the travel map |
| `ENABLE_*` | Feature toggles (hand-off, hidden gems, proximity alerts, realtime) |
| `GPS_UPDATE_INTERVAL`, `MAP_SYNC_INTERVAL`, `MAX_*_DISPLAY` | Performance tuning |

## App types

**Transit (mototaxis & buses)** - `APP_TYPE=transit`. Drivers publish live
positions to the `drivers` collection; passengers see them moving on the map.
Vehicle types come from `TRANSIT_VEHICLE_TYPES`.

**Fishing (boat tracking)** - `APP_TYPE=fishing`. Vessels publish positions to
`vessels` with status (fishing, returning, docked, emergency). Types from
`FISHING_VESSEL_TYPES`.

**Travel (hidden gems & attractions)** - `APP_TYPE=travel`. Cultural attractions
in `attractions` trigger proximity alerts when the traveler gets within
`TRAVEL_PROXIMITY_RADIUS`. Long-press the map to submit a hidden gem (title,
description, photo, rarity) to `hidden_gems`.

## Exposing publicly (Cloudflare Tunnel)

Simplest path (used by `docker-compose.yml`):

1. `cloudflared tunnel login` (on any machine with the binary)
2. Create a tunnel and a DNS route, or use a token from Zero Trust.
3. Set `CLOUDFLARE_TUNNEL_TOKEN` (and `CLOUDFLARE_TUNNEL_ID`) in `config.env`.
4. `./scripts/start.sh` - the tunnel container starts automatically and exposes
   `PUBLIC_URL` through Nginx.

A named-tunnel `config.yml` template lives at `config/cloudflare/config.yml`.

## Central hub (yucatanmx.com)

Every node heartbeats to the central registry (see `central-hub/` for a reference
FastAPI + SQLite implementation). It stores each active town node and answers
`/api/nearest-town`, which `pb_public/js/handoff.js` uses to live-switch towns.
Nodes that stop beating for 15 minutes are considered offline.

## Architecture

```
frontend (Nginx)  ->  serves pb_public + /config.json + proxies /api
                        /api/collections, /api/files, /api/rtm/*, /api/realtime -> backend
                        /api/heartbeat, /api/nearest-town, /api/towns, /api/health -> hub
backend (PocketBase)  ->  REST + realtime; pb_data volume; pb_hooks for
                          /api/rtm/health, /api/rtm/combined, /api/rtm/config
hub (FastAPI)     ->  central registry (central-hub/): heartbeats + nearest-town
setup (Node)      ->  one-shot: creates collections, superuser, test data
heartbeat (Node)  ->  POSTs node state to the local hub (CENTRAL_REGISTRY_URL override)
tunnel (cloudflared) -> exposes this PC at yucatanmx.com via Cloudflare Tunnel
```

The hub runs on the same PC that hosts yucatanmx.com. When the frontend performs
a cross-town hand-off it queries the hub's `/api/nearest-town`; every node on the
network heartbeats to the hub through its own domain.

## Project structure

```
universal-mapping-engine/
├── config.env                  # Master configuration (source of truth)
├── docker-compose.yml          # Service orchestration
├── Dockerfile                  # Frontend image (Nginx + config generation)
├── config/
│   ├── nginx/default.conf      # Nginx server config
│   ├── cloudflare/config.yml   # Named-tunnel template
│   └── schema/pocketbase-schema.json  # Reference collection schema
├── docker/
│   ├── nginx-entrypoint.sh     # Generates /config.json at container boot
│   └── tunnel-entrypoint.sh    # Starts cloudflared only when token set
├── pb_hooks/                   # PocketBase JS hooks (superuser bootstrap, RTM API)
├── pb_public/                  # Frontend (index.html, js/, css/, locales/, images/)
├── scripts/
│   ├── generate-config.sh      # config.env -> config.json
│   ├── start.sh / stop.sh / logs.sh
│   ├── setup-pocketbase.mjs    # Collection creation
│   ├── init-pocketbase.sh      # Wrapper: docker compose run --rm setup
│   ├── heartbeat.js            # Central registry announcer
│   └── raspberry-pi/           # auto-start init script + setup guide
└── central-hub/                # Reference central registry (FastAPI)
```

## Raspberry Pi deployment

The images are multi-arch (including `linux/arm64`). See
`scripts/raspberry-pi/README.md`. Short version:

```bash
sudo ./scripts/raspberry-pi/setup.sh        # installs Docker + init script
sudo cp scripts/raspberry-pi/auto-start.sh /etc/init.d/mapping-engine
sudo update-rc.d mapping-engine defaults
```

## Maintenance

```bash
./scripts/stop.sh
./scripts/start.sh                          # rebuild + restart
tar -czf backup-$(date +%Y%m%d).tar.gz pb_data/   # backup
```

## Security

- Change `PB_SUPERUSER_PASSWORD` before deploying publicly.
- Use Cloudflare Tunnel (HTTPS) rather than exposing port 80.
- Firewall: only the Nginx port (80) and optionally 8090 must be reachable.
- Public collection rules are read-only for anonymous users; only record
  owners can update their own driver/vessel/gem records.

## Troubleshooting

- **Collections not created**: `docker compose run --rm setup` and check its logs.
- **Map blank / config missing**: confirm `curl http://localhost/config.json` returns
  JSON; `scripts/start.sh` regenerates it.
- **GPS requires HTTPS**: geolocation needs a secure context (or localhost).
- **High CPU**: raise `GPS_UPDATE_INTERVAL` and `MAP_SYNC_INTERVAL` in `config.env`.
