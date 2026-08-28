#!/bin/bash
# The Beach Sandbox Stop Script
# This script stops the sandbox environment

cd ~/The_Beach

echo "🛑 Stopping The Beach Sandbox..."

# Stop Docker Compose
docker compose down

echo ""
echo "✅ Sandbox stopped successfully!"
echo "🧹 Clean up everything with: docker compose down -v"