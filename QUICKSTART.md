# Quick Start

Get a town node running in about 5 minutes.

## 1. Configure

Edit `config.env`:

```env
APP_TYPE=transit                 # transit | fishing | travel
TOWN_NAME="Your Town Name"
TOWN_ID="your_town_id"
INITIAL_LATITUDE=20.9674         # town center
INITIAL_LONGITUDE=-89.5926
MAX_BOUNDS="20.9000,-89.7000,21.0500,-89.4500"
WELCOME_MESSAGE="Welcome to our town!"
DEFAULT_LANGUAGE=es              # es | en | maya
```

## 2. Start

```bash
./scripts/start.sh
```

This regenerates `pb_public/config.json`, builds the images and starts all
services, including the one-shot PocketBase collection setup.

## 3. Open

Open http://localhost in your browser and allow location access.

## Verify

```bash
docker compose ps                  # all services Up
curl http://localhost/config.json  # your settings as JSON
curl http://localhost/api/health   # PocketBase health via the proxy
curl http://localhost/api/rtm/health  # RTM hook health
```

## Go public (optional)

1. Create a Cloudflare tunnel (login + `cloudflared tunnel create ...`), or use a
   Zero Trust token.
2. Put the token in `config.env`: `CLOUDFLARE_TUNNEL_TOKEN="..."`.
3. Run `./scripts/start.sh` again; the tunnel container exposes the app at your
   `PUBLIC_URL`.

## Raspberry Pi

```bash
sudo ./scripts/raspberry-pi/setup.sh
sudo cp scripts/raspberry-pi/auto-start.sh /etc/init.d/mapping-engine
sudo update-rc.d mapping-engine defaults
```

See `scripts/raspberry-pi/README.md` for details.

## Troubleshooting

- Setup failed: `docker compose run --rm setup`
- Logs: `./scripts/logs.sh`
- Docs: `README.md`
