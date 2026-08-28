#!/bin/bash
# The Beach Sandbox Status Check

cd ~/The_Beach

echo "🏖️  The Beach Sandbox Status"
echo "============================"
echo ""

# Check if Docker Compose is running
if docker compose ps | grep -q "Up"; then
    echo "✅ Sandbox containers are running"
    echo ""
    echo "Running containers:"
    docker compose ps
    echo ""
    echo "📍 Access points:"
    echo "  Frontend: https://beach.yucatanmx.com"
    echo "  Local access: http://192.168.1.75:8082"
    echo "  PocketBase Admin: http://192.168.1.75:8091/_/"
    echo "  Admin: sandbox@yucatanmx.com / sandbox123"
else
    echo "❌ Sandbox containers are not running"
    echo ""
    echo "Start the sandbox with: ./start-sandbox.sh"
fi