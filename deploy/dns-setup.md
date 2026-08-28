# 🌊 Beach Sandbox DNS Configuration
## Point beach.yucatanmx.com to your Mini PC

### Option 1: Cloudflare Tunnel (Recommended)

The simplest way to expose your app securely:

1. **Install cloudflared on your mini PC:**
```bash
# Download
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Authenticate
cloudflared tunnel login
```

2. **Create a tunnel:**
```bash
cloudflared tunnel create beach-sandbox
cloudflared tunnel route dns beach-sandbox beach.yucatanmx.com
```

3. **Create tunnel config** (`~/.cloudflared/config.yml`):
```yaml
tunnel: beach-sandbox
credentials-file: /home/mcivis77/.cloudflared/beach-sandbox.json

ingress:
  - hostname: beach.yucatanmx.com
    service: http://localhost:80
  - service: http_status:404
```

4. **Run the tunnel:**
```bash
cloudflared tunnel run beach-sandbox
```

### Option 2: Manual DNS + Nginx

1. **Update DNS A record:**
   - Point `beach.yucatanmx.com` to your mini PC's IP (`192.168.1.75`)
   - Log into your DNS provider's control panel
   - Add A record: `beach.yucatanmx.com → 192.168.1.75`

2. **Update Nginx config** (in `config/nginx/default.conf`):
```nginx
server {
    listen 80;
    server_name beach.yucatanmx.com;
    
    # Your existing config...
}
```

3. **Restart nginx:**
```bash
docker-compose restart frontend
```

### Option 3: /etc/hosts (For Local Testing)

If you just need it for testing from your local network:

1. **Edit hosts file on each device:**
```bash
# On Linux/Mac:
sudo nano /etc/hosts

# Add this line:
192.168.1.75 beach.yucatanmx.com

# On Windows:
notepad C:\Windows\System32\drivers\etc\hosts
```

### Option 4: Caddy Reverse Proxy (Auto SSL)

1. **Create Caddyfile** (`Caddyfile` in project root):
```
beach.yucatanmx.com {
    reverse_proxy localhost:80
    tls youremail@example.com
}
```

2. **Run Caddy:**
```bash
caddy run
```

### 🔐 HTTPS (Important!)

Once DNS is set up, your app will work at:
- **HTTP**: `http://beach.yucatanmx.com` (redirects to HTTPS)
- **HTTPS**: `https://beach.yucatanmx.com`

### 🧪 Test It Works

After DNS propagates (can take 5-30 minutes):
```bash
# Test from any device:
curl -I https://beach.yucatanmx.com

# Or visit in browser:
https://beach.yucatanmx.com
```

### 🚀 Deployment Commands

```bash
# On your mini PC
ssh mcivis77@192.168.1.75
cd /home/mrc77/Desktop/Backup\ Projects/universal-mapping-engine

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose pull
docker-compose up -d

# Check status
docker-compose logs -f
```

### ⚡ Quick Start Script

```bash
# Run this on your mini PC
chmod +x scripts/fix-connection.sh
./scripts/fix-connection.sh
```

### Need DNS Help?

If you don't manage the yucatanmx.com domain DNS:
1. Get a free subdomain from:
   - freenom.com (free .tk, .ml, .ga domains)
   - No-IP.com (free dynamic DNS)
   - DuckDNS.org (free subdomain)

2. Point your app to that domain in `config.env`:
```
PUBLIC_URL="https://your-subdomain.duckdns.org"
API_BASE_URL="https://your-subdomain.duckdns.org"
```

3. Regenerate config:
```bash
sh scripts/generate-config.sh config.env > pb_public/config.json
```