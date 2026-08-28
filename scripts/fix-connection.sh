#!/bin/bash
# 🔧 Fix connection issues - Beach Sandbox Edition

echo "🔧 Fixing Beach Sandbox connection..."
echo ""

# Check if Docker is running
echo "1. Checking Docker status..."
if ! docker info &>/dev/null; then
    echo "   ❌ Docker is not running"
    echo "   Starting Docker..."
    sudo systemctl start docker 2>/dev/null || dockerd &
    sleep 3
else
    echo "   ✓ Docker is running"
fi

# Navigate to project
cd "$(dirname "$0")/.."

# Stop any existing containers
echo ""
echo "2. Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Clear any stale processes
echo ""
echo "3. Cleaning up..."
docker system prune -f 2>/dev/null || true

# Rebuild images
echo ""
echo "4. Building containers..."
docker-compose build

# Start containers
echo ""
echo "5. Starting containers..."
docker-compose up -d

# Wait for services to start
sleep 5

# Check if services are running
echo ""
echo "6. Verifying services..."
if docker-compose ps | grep -q "Up"; then
    echo "   ✓ Containers are running"
else
    echo "   ❌ Some containers failed to start"
    docker-compose logs --tail=20
fi

# Show status
echo ""
echo "7. Service Status:"
docker-compose ps

# Get IP address
MINI_PC_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✅ Beach Sandbox is ready!"
echo ""
echo "🌐 Access at:"
echo "   Frontend: http://localhost:80  or http://$MINI_PC_IP:80"
echo "   API:      http://localhost:8090/api"
echo "   Admin:    http://localhost:8090/_panel"
echo ""
echo "💡 Test from another device:"
echo "   http://$MINI_PC_IP:80"