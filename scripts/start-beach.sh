#!/bin/bash
# 🏖️ Start your Beach Sandbox

echo "🏖️ Starting Beach Sandbox..."
echo ""

# Check if Docker is running
if ! docker info &>/dev/null; then
    echo "⚠️ Docker is not running. Attempting to start..."
    sudo systemctl start docker 2>/dev/null || dockerd &
    sleep 2
fi

# Navigate to project directory
cd "$(dirname "$0")/.."

# Pull latest images
echo "📥 Pulling latest images..."
docker-compose pull 2>/dev/null || echo "(No images to pull)"

# Build the app
echo "🔨 Building application..."
docker-compose build 2>/dev/null || echo "(Using cached images)"

# Start containers
echo "🚀 Starting containers..."
docker-compose up -d

echo ""
echo "✅ Beach Sandbox is now running!"
echo ""
echo "🌐 Access your app at:"
echo "   http://localhost:8080"
echo ""
echo "📊 API endpoint:"
echo "   http://localhost:8090/api"
echo ""
echo "🔄 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop the sandbox:"
echo "   docker-compose down"