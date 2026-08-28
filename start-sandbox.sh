#!/bin/bash
# 🏖️ The Beach Sandbox Startup Script
# This script starts the sandbox environment for testing

cd "$(dirname "$0")"

echo ""
echo "🏖️  Starting The Beach Sandbox..."
echo "=================================="
echo ""
echo "📍 URLs:"
echo "   • Frontend:    https://beach.yucatanmx.com"
echo "   • Local:       http://localhost:8082"
echo "   • Admin:       http://localhost:8091/_/"
echo ""
echo "👤 Admin credentials:"
echo "   sandbox@yucatanmx.com / sandbox123"
echo ""
echo "🔄 Live Development:"
echo "   - Edit HTML/CSS/JS → refresh browser"
echo "   - Edit config.env  → run generate-config.sh then restart frontend"
echo "   - Edit hooks       → restart backend"
echo ""

# Check if we need to generate config
if [ -f config.env ]; then
  echo "⚙️  Generating config.json..."
  sh scripts/generate-config.sh config.env > pb_public/config.json 2>/dev/null || echo "   (config.json already exists or no changes)"
fi

# Create data directories
mkdir -p pb_data pb_hooks pb_migrations config/cloudflared 2>/dev/null

# Start Docker Compose
echo ""
echo "🚀 Starting containers..."
if docker compose up -d --build 2>/dev/null; then
  echo ""
  echo "✅ Sandbox started successfully!"
  echo ""
  docker compose ps
else
  echo ""
  echo "❌ Failed to start Docker containers"
  echo ""
  echo "Troubleshooting:"
  echo "1. Check Docker is running: docker info"
  echo "2. Check permissions: groups | grep docker"
  echo "3. If needed: sudo usermod -aG docker \$USER"
  echo ""
  echo "   Then log out and log back in, then run this script again."
  exit 1
fi

echo ""
echo "📊 Quick commands:"
echo "   Logs:    docker compose logs -f"
echo "   Stop:    docker compose down"
echo "   Restart: docker compose restart &lt;service&gt;"