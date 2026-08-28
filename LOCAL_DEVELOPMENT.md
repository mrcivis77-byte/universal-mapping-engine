# Local Development Setup - Run Docker on Your Laptop

## Prerequisites

1. **Install Docker** on your laptop (if not already):
   - Visit https://docs.docker.com/get-docker/
   - Download Docker Desktop for your OS

2. **Add your user to the docker group**:
   ```bash
   # On Linux:
   sudo usermod -aG docker $USER
   
   # Then LOGOUT and LOG BACK IN for changes to take effect
   
   # On macOS/Windows - Docker Desktop handles this automatically
   ```

3. **Verify Docker is working**:
   ```bash
   docker --version
   docker compose version
   docker info  # Should NOT show "permission denied"
   ```

## Starting the Sandbox Locally

```bash
cd ~/Beach/The_Beach

# Generate config from config.env
sh scripts/generate-config.sh config.env > pb_public/config.json

# Start the sandbox
docker compose up -d --build

# Check it's running
docker compose ps
```

## Access Your Local Sandbox

- **Frontend**: http://localhost:8082/
- **Admin**: http://localhost:8091/_/
- **Credentials**: sandbox@yucatanmx.com / sandbox123

## Live Development Workflow

### Frontend Changes (HTML/CSS/JS)
Files in `pb_public/` are served directly by nginx. Just save and refresh:
- Edit `pb_public/index.html`
- Edit `pb_public/js/*.js`
- Edit `pb_public/css/*.css`
- Refresh browser: http://localhost:8082/

### Config Changes
When you edit `config.env`:
```bash
# Regenerate config.json
sh scripts/generate-config.sh config.env > pb_public/config.json

# Restart frontend
docker compose restart frontend
```

### Backend Hook Changes
When you edit files in `pb_hooks/`:
```bash
docker compose restart backend
```

## Seeing Changes Like "Live Web"

The config uses `localhost:8082` but if you want to see it as if on a real domain:

### Option A: Use `/etc/hosts` (localhost)
```bash
# Add to /etc/hosts:
echo "127.0.0.1 beach.yucatanmx.com" | sudo tee -a /etc/hosts
```

Then access: http://beach.yucatanmx.com:8082/

### Option B: Use XIP.FD (real domain)
```bash
# Get your IP and use xip.io:
# If your IP is 192.168.1.100, use: http://192.168.1.100.xip.io
```

## Deployment to Live Site

When ready to deploy:

```bash
# 1. SSH to mini-PC
ssh mcivis77@192.168.1.75

# 2. On mini-PC, stop production temporarily
cd /home/mcivis77/universal-mapping-engine
docker compose stop frontend backend

# 3. Copy tested files from laptop to mini-PC
rsync -av --exclude='.git' --exclude='node_modules' \
  ~/Beach/The_Beach/ mcivis77@192.168.1.75:/home/mcivis77/universal-mapping-engine/

# 4. On mini-PC, regenerate config for production
cd /home/mcivis77/universal-mapping-engine
# Edit config.env for production settings
sh scripts/generate-config.sh config.env > pb_public/config.json

# 5. Restart production
docker compose up -d
```

## Docker Commands Cheat Sheet

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Restart one service
docker compose restart frontend

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f frontend

# Check status
docker compose ps

# Rebuild images
docker compose build
```