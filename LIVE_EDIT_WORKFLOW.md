# 🏖️ Beach Sandbox - Live Edit Workflow

## Quick Setup (Run on Mini-PC at 192.168.1.75)

```bash
# SSH into your mini-PC
ssh mcivis77@192.168.1.75

# Stop any existing sandbox container
docker stop nginx_frontend_sandbox 2>/dev/null || true
docker rm nginx_frontend_sandbox 2>/dev/null || true

# Create sandbox directory
mkdir -p /home/mcivis77/The_Beach
cd /home/mcivis77/The_Beach
```

## From Your Laptop (Development Machine)

### 1. Sync Files to Mini-PC

```bash
rsync -av --exclude='.git' --exclude='node_modules' --exclude='host_backup_*' \
  /home/mrc77/Beach/The_Beach/ mcivis77@192.168.1.75:/home/mcivis77/The_Beach/
```

### 2. SSH to Mini-PC and Start Sandbox

```bash
ssh mcivis77@192.168.1.75 'cd /home/mrc77/The_Beach && \
  mkdir -p pb_data && \
  sh scripts/generate-config.sh config.env > pb_public/config.json && \
  docker compose up -d --build'
```

## Live Development Workflow

### Access the Sandbox
- **Frontend**: http://192.168.1.75:8082/
- **Admin**: http://192.168.1.75:8091/_/ (sandbox@yucatanmx.com / sandbox123)

### Edit Files (Choose One Method)

#### Method A: SFTP (GUI - Easier)
1. Open FileZilla or your file manager
2. Connect to: `sftp://mcivis77@192.168.1.75/home/mcivis77/The_Beach/`
3. Edit files directly, save to mini-PC
4. Refresh browser to see changes

#### Method B: Sync from Laptop
```bash
# After editing files on your laptop, sync them:
rsync -av --exclude='.git' --exclude='node_modules' \
  /home/mrc77/Beach/The_Beach/ mcivis77@192.168.1.75:/home/mcivis77/The_Beach/
```

### Restart Containers After Changes

```bash
# SSH to mini-PC (or from laptop):
ssh mcivis77@192.168.1.75

# Check what you changed and restart:
cd /home/mcivis77/The_Beach

# For frontend changes (HTML/CSS/JS):
docker compose restart frontend

# For backend hook changes:
docker compose restart backend

# For config changes:
sh scripts/generate-config.sh config.env > pb_public/config.json
docker compose restart frontend

# See all running containers:
docker compose ps
```

## Live Reload Behavior

| Files Changed | Action Required |
|---------------|-----------------|
| `pb_public/*.html` | Just refresh browser |
| `pb_public/js/*.js` | Just refresh browser |
| `pb_public/css/*.css` | Just refresh browser |
| `config.env` | Regenerate config + restart frontend |
| `pb_hooks/*.pb.js` | Restart backend |
| `pb_migrations/` | Restart backend |

## Quick Commands Summary

```bash
# SSH to mini-PC
ssh mcivis77@192.168.1.75

# See all containers
docker ps -a

# Check sandbox status
docker compose -f The_Beach/docker-compose.yml ps

# See logs
docker compose logs -f

# Stop sandbox
docker compose down

# Full reset (nuclear option)
docker compose down -v
rm -rf pb_data
docker compose up -d
```

## Deployment to Live Site

Once you're satisfied with changes in the sandbox:

```bash
# On mini-PC:
cd /home/mcivis77/universal-mapping-engine

# Stop the production container temporarily
docker stop pocketbase_backend
docker stop nginx_frontend   # or whatever your production frontend is called

# Copy files from sandbox
rsync -av /home/mcivis77/The_Beach/pb_public/ /home/mcivis77/universal-mapping-engine/pb_public/
rsync -av /home/mcivis77/The_Beach/pb_hooks/ /home/mcivis77/universal-mapping-engine/pb_hooks/
rsync -av /home/mcivis77/The_Beach/config.env /home/mcivis77/universal-mapping-engine/config.env

# Regenerate config for production
cd /home/mcivis77/universal-mapping-engine
sh scripts/generate-config.sh config.env > pb_public/config.json

# Restart production containers
docker start pocketbase_backend
# Recreate production frontend if needed
```