#!/bin/bash
# 🏖️ Local Development Setup Script
# Run this from your laptop's regular terminal (NOT from browser)

set -e

echo "🏖️ Setting up local development environment..."

# Get project directory
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Check Docker access
echo "🔍 Checking Docker..."
if ! docker info &>/dev/null; then
    echo "❌ Docker not accessible!"
    echo ""
    echo "To fix this:"
    echo "1. Run: sudo usermod -aG docker $USER"
    echo "2. Log out and log back in"
    echo "3. Then run this script again"
    exit 1
fi

echo "✅ Docker is accessible"

# Generate config
echo "⚙️  Generating config.json..."
sh scripts/generate-config.sh config.env > pb_public/config.json

# Create data directories
echo "📁 Creating data directories..."
mkdir -p pb_data pb_hooks pb_migrations

# Build and start
echo "🚀 Starting sandbox..."
docker compose up -d --build

# Wait for startup
sleep 5

# Show status
echo ""
echo "✅ Sandbox is ready!"
docker compose ps

echo ""
echo "🌐 Access at: http://localhost:8082"
echo "📊 Admin at:  http://localhost:8091/_/"
echo "   User: sandbox@yucatanmx.com"
echo "   Pass: sandbox123"
echo ""
echo "💡 Live development:"
echo "   • Edit pb_public/*.html/js/css → refresh browser"
echo "   • Edit config.env → regenerate config + docker compose restart frontend"
echo "   • Edit pb_hooks/*.pb.js → docker compose restart backend"
