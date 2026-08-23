# Central Hub (yucatanmx.com)

Reference implementation of the RTM central registry. It receives heartbeats
from every town node and answers `nearest-town` queries so a visitor's map can
hand off from one town to the next without reloading the page.

## Endpoints

| Method | Path                | Purpose                                    |
| ------ | ------------------- | ------------------------------------------ |
| GET    | `/api/health`       | Liveness probe                             |
| POST   | `/api/heartbeat`    | Node announces itself (driven by `scripts/heartbeat.js` in each node) |
| GET    | `/api/towns`        | List active town nodes (stale nodes dropped after 15 min) |
| POST   | `/api/nearest-town` | Given `{latitude, longitude, current_town}`, return the closest active node's `town_id/town_name/tunnel_url/...` |

## Run

```bash
cd central-hub
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

Data is stored in a single SQLite file `central_hub.db`.

## Deploy

In this repository the hub is already wired up as the `hub` Docker service
(`docker/Dockerfile.hub`) and is reachable on the node's own domain through
nginx at `/api/heartbeat`, `/api/nearest-town`, `/api/towns` and `/api/health`.
The node that hosts yucatanmx.com points its own heartbeat at
`http://frontend`; every other town points `CENTRAL_REGISTRY_URL` at
`https://yucatanmx.com`.
