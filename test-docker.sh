#!/bin/bash
# Test if Docker is working

echo "🧪 Testing Docker setup..."
echo ""

echo "1. Docker CLI version:"
docker --version 2>&1 || echo "   ❌ Docker not installed"

echo ""
echo "2. Docker Compose version:"
docker compose version 2>&1 || echo "   ❌ Docker Compose not installed"

echo ""
echo "3. Docker daemon status:"
docker info 2>&1 | head -10 || echo "   ❌ Cannot connect to Docker daemon"

echo ""
echo "4. User groups (check for 'docker'):"
groups | grep docker && echo "   ✅ You're in the docker group" || echo "   ⚠️  You're NOT in the docker group"

echo ""
echo "If you see permission denied errors above, run:"
echo "   sudo usermod -aG docker $USER"
echo "Then LOGOUT and LOG back in for changes to take effect."
