#!/bin/bash
# 🏖️ Start the Beach Sandbox for Development
# This script starts your local sandbox for testing changes

set -e

cd "$(dirname "$0")/.."

echo ""
echo "🏖️  Starting Beach Sandbox..."
echo "🎯 Target: http://192.168.1.75:8082"
echo "🗄️  Admin:  http://192.168.1.75:8091/_/"
echo "     User: sandbox@yucatanmx.com"
echo "     Pass: sandbox123"
echo ""

# Generate config from config.env
echo "⚙️  Generating config.json..."
if [ -f config.env ] && [ -f scripts/generate-config.sh ]; then
  sh scripts/generate-config.sh config.env > pb_public/config.json
  echo "   ✅ Config generated"
else
  echo "   ❌ Missing config.env or generate-config.sh"
  exit 1
fi

# Create necessary directories
echo "📁 Creating data directories..."
mkdir -p pb_data pb_hooks pb_migrations config/cloudflared

# Check if Docker is available
echo "🐳 Checking Docker..."
if ! docker compose version &>/dev/null; then
  echo "   ❌ Docker Compose not found!"
  echo "   Please install Docker Compose:"
  echo "   curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose"
  echo "   chmod +x ~/.docker/cli-plugins/docker-compose"
  exit 1
fi

# Start containers
echo ""
echo "🚀 Starting containers..."
docker compose up -d --build

# Wait a moment
sleep 3

# Show status
echo ""
echo "✅ Sandbox started!"
echo ""
docker compose ps

echo ""
echo "👀 Live View Info:"
echo "   Frontend: http://localhost:8082 (or http://192.168.1.75:8082)"
echo "   Admin:    http://localhost:8091/_/"
echo ""
echo "🔄 To see live updates:"
echo "   - Edit files in pb_public/ js/ or css/ → refresh browser"
echo "   - Edit config.env → run: ./scripts/generate-config.sh config.env > pb_public/config.json && docker compose restart frontend"
echo "   - Edit hooks → run: docker compose restart backend"
echo ""
echo "🛑 To stop:  docker compose down"
echo "📊 Logs:     docker compose logs -f"