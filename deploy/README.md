# 🏖️ Deploying Your Beach Sandbox to Mini PC

Your Beach Sandbox is now configured for: **https://beach.yucatanmx.com**

## Quick Start

### 1. Start Docker Services
```bash
# Start Docker daemon if not running
sudo systemctl start docker

# Or if using Docker Desktop
dockerd &

# Verify Docker is running
docker ps
```

### 2. Deploy Your App
```bash
# Navigate to your project
cd /home/mrc77/Desktop/Backup Projects/universal-mapping-engine/

# Run quick fix script
./scripts/fix-connection.sh

# Or manual deployment
docker-compose up -d
```

### 3. Access Your App
Your app will be available at:
- **Main**: `https://beach.yucatanmx.com`
- **API**: `https://beach.yucatanmx.com/api`
- **Admin Panel**: `https://beach.yucatanmx.com/_panel`
- **Bidding Dashboard**: `https://beach.yucatanmx.com/admin/bidding-dashboard.html`

## Domain Configuration

✅ Domain: `beach.yucatanmx.com`
✅ Protocol: HTTPS (recommended)
✅ Port: 80 (HTTP) → redirects to HTTPS

### DNS Setup Options:

**Option A: Use existing DNS (if you control yucatanmx.com)**
- Point `beach.yucatanmx.com` A record to `192.168.1.75`
- Wait 5-30 minutes for propagation

**Option B: Cloudflare Tunnel (Recommended)**
- See `deploy/dns-setup.md` for step-by-step

**Option C: Local testing only**
- Add to `/etc/hosts`: `192.168.1.75 beach.yucatanmx.com`