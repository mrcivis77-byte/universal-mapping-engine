# Beach Sandbox Development Guide 🏖️

## Quick Start (Step by Step)

### Step 1: Open Terminal on Your Laptop

Open your regular terminal (NOT from browser). Navigate to the project:

```bash
cd ~/Beach/The_Beach
```

### Step 2: Check Docker is Working

```bash
docker --version
# Should show: Docker version 29.1.3 (or similar)

docker compose version
# Should show: Docker Compose version v2.27.1 (or similar)

docker info
# Should show Docker system info WITHOUT permission denied
```

**If you get "permission denied":**
```bash
sudo usermod -aG docker $USER
# Then LOGOUT and LOG back in (important!)
```

### Step 3: Start the Sandbox

```bash
cd ~/Beach/The_Beach
./scripts/start.sh
```

### Step 4: Open in Browser

Go to: http://localhost:8082

Or on your phone/device connected to same Wi-Fi:
http://192.168.1.75:8082

### Step 5: Login to Admin

Go to: http://localhost:8091/_/

- Email: sandbox@yucatanmx.com
- Password: sandbox123

---

## Live Development Workflow

### Frontend Files (HTML/CSS/JS)
- Location: `pb_public/` and subdirectories
- Live reload: Just save and refresh browser
- No container restart needed!

### Configuration Changes
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

### See What's Running
```bash
docker compose ps
docker compose logs -f    # Follow logs
docker compose logs frontend  # Just frontend logs
docker compose logs backend   # Just backend logs
```

### Stop Everything
```bash
docker compose down
```

---

## Deploying to Mini-PC (192.168.1.75)

### Option A: Copy Files Directly
1. Copy all files to your mini-PC at `/home/mrc77/The_Beach/`
2. Install Docker on mini-PC
3. SSH into mini-PC and run:
```bash
cd /home/mrc77/The_Beach
./scripts/start.sh
```

### Option B: Sync with rsync
From your laptop:
```bash
rsync -av --exclude='.git' ~/Beach/The_Beach/ mrc77@192.168.1.75:/home/mrc77/The_Beach/
```

Then SSH into mini-PC:
```bash
ssh mrc77@192.168.1.75
cd /home/mrc77/The_Beach
./scripts/start.sh
```

---

## Common Tasks

### Regenerate All App Configs
```bash
for app in bus moto drive fishing parque; do 
  ./scripts/generate-config.sh config.env > pb_public/config.$app.json
done
docker compose restart frontend
```

### Check Database
```bash
# Open PocketBase admin UI
# Or use SQLite directly:
sqlite3 pb_data_sandbox/data.db "SELECT * FROM users LIMIT 5;"
```

### Restart Specific Container
```bash
docker compose restart frontend
docker compose restart backend
```

### View Real-time Updates
- Open browser dev tools (F12)
- Go to Network tab
- Enable "WS" (WebSocket) filter
- See real-time data streaming