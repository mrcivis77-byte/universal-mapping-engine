# The Beach Sandbox 🏖️

This is your testing sandbox for the Universal Mapping Engine at beach.yucatanmx.com. Everything here is isolated from your production environment.

## Quick Start

### Start the Sandbox
```bash
cd ~/The_Beach
./start-sandbox.sh
```

### Stop the Sandbox
```bash
cd ~/The_Beach
./stop-sandbox.sh
```

### Check Status
```bash
cd ~/The_Beach
./status.sh
```

## Access Points

- **Sandbox Frontend**: https://beach.yucatanmx.com
- **Local Access**: http://192.168.1.75:8082
- **PocketBase Admin**: http://192.168.1.75:8091/_/
- **Admin Credentials**: sandbox@yucatanmx.com / sandbox123

## Key Differences from Production

1. **Port Isolation**: 
   - Sandbox uses port 8082 (vs production port 80)
   - PocketBase uses port 8091 (vs production port 8090)

2. **Domain Isolation**:
   - Sandbox uses beach.yucatanmx.com subdomain
   - Production uses main yucatanmx.com domain

3. **Database Isolation**:
   - Uses `pb_data_sandbox` directory (completely separate from production)

4. **Container Names**:
   - All containers have `_sandbox` suffix to avoid conflicts

5. **Network Isolation**:
   - Uses `sandbox_network` instead of `app_network`

6. **Credentials**:
   - Separate admin account for testing

## Cloudflare Tunnel Setup

To enable the beach.yucatanmx.com domain, you need to:

1. Create a new Cloudflare tunnel for the sandbox
2. Add beach.yucatanmx.com as a hostname in the tunnel configuration
3. Update the tunnel credentials in config.env:
   ```
   CLOUDFLARE_TUNNEL_ID="your-tunnel-id"
   CLOUDFLARE_TUNNEL_TOKEN="your-tunnel-token"
   ```
4. Uncomment the tunnel service in docker-compose.yml

## Testing Apps

To test specific apps, you can generate their configs:

```bash
# Generate config for a specific app
./scripts/generate-config.sh config.env config/apps/bus.env > pb_public/config.bus.json

# Generate all app configs
for app in bus moto drive fishing parque; do ./scripts/generate-config.sh config.env config/apps/$app.env > pb_public/config.$app.json; done
```

Then restart the frontend:
```bash
docker compose restart frontend
```

## Development Workflow

1. Make changes to code/config in The_Beach directory
2. Restart affected containers:
   ```bash
   docker compose restart frontend
   docker compose restart backend
   ```
3. Test at https://beach.yucatanmx.com or http://192.168.1.75:8082
4. Once satisfied, copy changes to production directory

## Clean Start

To completely reset the sandbox (delete all data):
```bash
cd ~/The_Beach
docker compose down -v
rm -rf pb_data_sandbox
mkdir pb_data_sandbox
docker compose up -d
```

## Troubleshooting

Check logs:
```bash
docker compose logs -f
```

Check specific container:
```bash
docker compose logs frontend
docker compose logs backend
```

## Current Apps Available

- bus (Community Bus)
- fishing (Pesca)
- moto (Mototaxi)
- drive (Drive)
- parque (Parque)

Each has its own config file in `config/apps/` directory.

## Important Notes

- This sandbox runs on the same server as production but is completely isolated
- The sandbox uses a different subdomain (beach.yucatanmx.com) to avoid conflicts
- Cloudflare tunnel needs to be configured separately for the sandbox domain
- Stop production containers before starting sandbox if there are any port conflicts
- Use `docker compose` (space) instead of `docker-compose` (hyphen) for newer Docker versions